import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, type BrowserContextOptions, type Locator, type Page, type TestInfo } from '@playwright/test'

const EMAIL_DIR = '.cloudflare/tmp/email'

async function emailFiles(): Promise<string[]> {
  const files: { path: string; mtime: number }[] = []
  for (const instance of await readdir(EMAIL_DIR).catch(() => [])) {
    const dir = join(EMAIL_DIR, instance, 'email-text')
    for (const name of await readdir(dir).catch(() => [])) {
      const path = join(dir, name)
      files.push({ path, mtime: (await stat(path)).mtimeMs })
    }
  }
  return files.sort((a, b) => b.mtime - a.mtime).map((f) => f.path)
}

export async function waitForEmail(matches: (text: string) => boolean, timeout = 15_000): Promise<string> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    for (const file of await emailFiles()) {
      const text = await readFile(file, 'utf8')
      if (matches(text)) return text
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Expected email was not sent')
}

export function linkIn(text: string, path: string): string {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`https?://[^\\s/]+${escaped}\\S*`).exec(text)
  if (!match) throw new Error(`No ${path} link in email`)
  return match[0]
}

export async function expectFitsScreen(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0)
}

export async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box, 'element is rendered').not.toBeNull()
  expect(box!.height, 'touch target height').toBeGreaterThanOrEqual(44)
  expect(box!.width, 'touch target width').toBeGreaterThanOrEqual(44)
}

export function deviceOptions(testInfo: TestInfo): BrowserContextOptions {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } = testInfo.project.use
  return { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL }
}

export async function settle(page: Page) {
  await page.waitForLoadState('load')
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      ),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]),
  )
}

export async function chromeProblems(page: Page): Promise<string[]> {
  await settle(page)
  return page.evaluate(() => {
    type Sides = { top: boolean; right: boolean; bottom: boolean; left: boolean }
    type Box = {
      el: Element
      rect: DOMRect
      lines: Sides
      ring: boolean
      border: boolean
      shadow: boolean
      separator: boolean
      layer: Element | null
    }
    const CONTROLS =
      'button, a, input, textarea, select, [role=button], [role=tab], [role=checkbox], [role=radio], [role=switch], [data-slot=badge], [data-slot=avatar], [data-slot=input-group], [data-slot=button-group-text], [data-slot=toggle-group-item]'

    const alpha = (color: string) => {
      if (!color || color === 'transparent') return 0
      const slash = /\/\s*([\d.]+)(%?)\s*\)$/.exec(color)
      if (slash) return parseFloat(slash[1]) / (slash[2] ? 100 : 1)
      const rgba = /^rgba\(([^)]+)\)$/.exec(color)
      return rgba ? parseFloat(rgba[1].split(',')[3]) : 1
    }
    const splitTop = (value: string) => {
      const parts: string[] = []
      let depth = 0
      let start = 0
      for (let i = 0; i < value.length; i++) {
        if (value[i] === '(') depth++
        else if (value[i] === ')') depth--
        else if (value[i] === ',' && depth === 0) {
          parts.push(value.slice(start, i))
          start = i + 1
        }
      }
      parts.push(value.slice(start))
      return parts.map((p) => p.trim())
    }
    const shadows = (value: string) => {
      const out = { ring: false, elevation: false }
      if (value === 'none') return out
      for (const part of splitTop(value)) {
        const color = /(rgba?|oklab|oklch|lab|lch|color|hsla?)\([^)]*\)/.exec(part)?.[0] ?? 'black'
        if (alpha(color) === 0 || part.includes('inset')) continue
        const [x = 0, y = 0, blur = 0, spread = 0] = part
          .replace(color, '')
          .trim()
          .split(/\s+/)
          .map((n) => parseFloat(n) || 0)
        if (blur > 0 || x !== 0 || y !== 0) out.elevation = true
        else if (spread > 0) out.ring = true
      }
      return out
    }
    const describe = (el: Element) => {
      const slot = el.getAttribute('data-slot')
      const cls = (el.getAttribute('class') ?? '').split(/\s+/).slice(0, 4).join('.')
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
      return `<${el.tagName.toLowerCase()}${slot ? ` ${slot}` : ''}${cls ? ` .${cls}` : ''}> "${text}"`
    }

    const boxes = new Map<Element, Box>()
    for (const el of document.querySelectorAll('body *')) {
      if (el.matches(':focus, :focus-visible')) continue
      const rect = el.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) continue
      const cs = getComputedStyle(el)
      if (cs.visibility !== 'visible') continue
      const side = (name: 'top' | 'right' | 'bottom' | 'left') =>
        parseFloat(cs.getPropertyValue(`border-${name}-width`)) > 0 &&
        !['none', 'hidden'].includes(cs.getPropertyValue(`border-${name}-style`)) &&
        alpha(cs.getPropertyValue(`border-${name}-color`)) > 0
      const border = { top: side('top'), right: side('right'), bottom: side('bottom'), left: side('left') }
      const shadow = shadows(cs.boxShadow)
      const ring = shadow.ring && !(el.matches(CONTROLS) && el.matches(':focus-within'))
      const elevation = shadow.elevation
      const separator =
        (el.matches('[role=separator], [data-slot=separator]') || rect.width <= 2 || rect.height <= 2) &&
        alpha(cs.backgroundColor) > 0
      const lines = {
        top: border.top || ring || separator,
        right: border.right || ring || separator,
        bottom: border.bottom || ring || separator,
        left: border.left || ring || separator,
      }
      const hasBorder = Object.values(border).some(Boolean)
      if (!hasBorder && !ring && !elevation && !separator) continue
      let layer: Element | null = null
      for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) {
        if (['fixed', 'sticky'].includes(getComputedStyle(p).position)) {
          layer = p
          break
        }
      }
      boxes.set(el, { el, rect, lines, ring, border: hasBorder, shadow: elevation, separator, layer })
    }

    const problems = new Set<string>()
    const sides = (b: Box) => {
      const on = (['top', 'right', 'bottom', 'left'] as const).filter((k) => b.lines[k]).join(',')
      return ` [${on}${b.ring ? ' ring' : ''} ${getComputedStyle(b.el).boxShadow} ${b.rect.left.toFixed(1)}-${b.rect.right.toFixed(1)}]`
    }
    const surface = (b: Box) => {
      if (b.separator) return false
      const framed = b.shadow || b.ring || (b.lines.top && b.lines.right && b.lines.bottom && b.lines.left)
      if (!framed || (b.rect.width <= 64 && b.rect.height <= 64)) return false
      return !b.el.matches(CONTROLS) || b.shadow || b.ring
    }
    const ancestorBox = (el: Element, test: (b: Box) => boolean) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const b = boxes.get(p)
        if (b && test(b)) return b
      }
      return undefined
    }

    for (const b of boxes.values()) {
      if (b.border && b.ring) problems.add(`border and ring on one element: ${describe(b.el)}`)
      if (b.shadow) {
        const outer = ancestorBox(b.el, (a) => a.shadow)
        if (outer) problems.add(`shadow inside shadow: ${describe(b.el)} in ${describe(outer.el)}`)
      }
      if (surface(b)) {
        const outer = ancestorBox(b.el, surface)
        if (outer && !(b.shadow && outer.shadow))
          problems.add(`box inside box: ${describe(b.el)} in ${describe(outer.el)}`)
      }
    }

    const list = [...boxes.values()]
    const near = (a: number, b: number) => Math.abs(a - b) <= 1.5
    const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 2
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        if (a.layer !== b.layer) continue
        const nested = a.el.contains(b.el) || b.el.contains(a.el)
        const [outer, inner] = a.el.contains(b.el) ? [a, b] : [b, a]
        const A = a.rect
        const B = b.rect
        const vertical = overlap(A.top, A.bottom, B.top, B.bottom)
        const horizontal = overlap(A.left, A.right, B.left, B.right)
        let hit = false
        if (nested) {
          const O = outer.rect
          const I = inner.rect
          hit =
            (horizontal && near(O.top, I.top) && outer.lines.top && inner.lines.top) ||
            (horizontal && near(O.bottom, I.bottom) && outer.lines.bottom && inner.lines.bottom) ||
            (vertical && near(O.left, I.left) && outer.lines.left && inner.lines.left) ||
            (vertical && near(O.right, I.right) && outer.lines.right && inner.lines.right)
        } else {
          hit =
            (vertical && near(A.right, B.left) && a.lines.right && b.lines.left) ||
            (vertical && near(B.right, A.left) && b.lines.right && a.lines.left) ||
            (horizontal && near(A.bottom, B.top) && a.lines.bottom && b.lines.top) ||
            (horizontal && near(B.bottom, A.top) && b.lines.bottom && a.lines.top)
        }
        if (hit) problems.add(`touching lines: ${describe(a.el)}${sides(a)} and ${describe(b.el)}${sides(b)}`)
      }
    }
    return [...problems]
  })
}

export async function expectCleanChrome(page: Page) {
  expect.soft(await chromeProblems(page), 'double borders or shadows').toEqual([])
}

export function screenshotter(page: Page, testInfo: TestInfo) {
  return async (name: string, target: Page = page) => {
    await expectCleanChrome(target)
    await target.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true })
  }
}
