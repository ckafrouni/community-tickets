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

export function screenshotter(page: Page, testInfo: TestInfo) {
  return (name: string, target: Page = page) =>
    target.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true })
}
