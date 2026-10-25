import { expect, test } from '@playwright/test'
import { deviceOptions, expectFitsScreen, expectTouchTarget, linkIn, screenshotter, waitForEmail } from './helpers'

const PASSWORD = 'correct-horse-battery'

test('an organizer runs an event from their phone', async ({ page, browser }, testInfo) => {
  const run = `${Date.now().toString(36)}${testInfo.project.name}`
  const host = { name: 'Maya Host', email: `host-${run}@example.com` }
  const door = { name: 'Dan Door', email: `door-${run}@example.com` }
  const buyer = { first: `Ana${run}`, name: `Ana${run} Lopez`, email: `ana-${run}@example.com` }
  const eventName = `Harvest Supper ${run}`
  const shot = screenshotter(page, testInfo)
  const tabs = page.getByRole('navigation', { name: 'Event' })
  let eventUrl = ''
  let ticketUrl = ''

  await test.step('sign up and confirm the email address', async () => {
    await page.goto('/signup')
    await expectFitsScreen(page)
    await page.getByLabel('Your name').fill(host.name)
    await page.getByLabel('Email').fill(host.email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible()

    const email = await waitForEmail((text) => text.includes(host.email) && text.includes('Confirm email'))
    await page.goto(linkIn(email, '/api/auth/verify-email'))
    await expect(page).toHaveURL(/\/events$/)
    await expect(page.getByText('Create your first event')).toBeVisible()
    await expectFitsScreen(page)
    await shot('01-events-empty')
  })

  await test.step('create an event', async () => {
    await page.getByRole('link', { name: 'Create event' }).click()
    await page.getByLabel('Name').fill(eventName)
    await page.getByLabel('Date & time').fill('2026-11-14T18:30')
    await page.getByLabel('Location').fill('Community Hall, 12 Main St')
    const create = page.getByRole('button', { name: 'Create event' })
    await expect(create).toBeInViewport()
    await expectFitsScreen(page)
    await shot('02-create-event')
    await create.click()

    await expect(page).toHaveURL(/\/events\/[a-z0-9]+\/guests$/)
    eventUrl = page.url().replace(/\/guests$/, '')
    await expect(page.getByText('No guests yet')).toBeVisible()
    await expect(page.getByText('Saturday, November 14 · 6:30 PM')).toBeVisible()
    for (const tab of ['Sell', 'Guests', 'Check in', 'Settings']) {
      await expectTouchTarget(tabs.getByRole('link', { name: tab }))
    }
  })

  await test.step('sell two tickets for cash', async () => {
    await tabs.getByRole('link', { name: 'Sell' }).click()
    await page.getByRole('textbox', { name: 'Name' }).fill(buyer.name)
    await page.getByRole('textbox', { name: /^Email/ }).fill(buyer.email)
    await page.getByRole('button', { name: 'One more ticket' }).click()
    const confirm = page.getByRole('button', { name: 'Confirm $20.00 · 2 tickets' })
    await expect(confirm).toBeInViewport()
    await expectTouchTarget(page.getByRole('button', { name: 'One more ticket' }))
    await expectFitsScreen(page)
    await shot('03-sell')
    await confirm.click()

    await expect(page.getByText('Sale recorded: $20.00 cash')).toBeVisible()
    await expect(page.getByText(`Tickets emailed to ${buyer.email}.`)).toBeVisible()
    await expect(page.getByRole('img', { name: /^QR code for ticket/ })).toHaveCount(2)
    await expectFitsScreen(page)
    await shot('04-sale-recorded')

    const email = await waitForEmail((text) => text.includes(`You're in, ${buyer.first}!`))
    expect(email).toContain(eventName)
    expect(email).toContain('Saturday, November 14 · 6:30 PM')
    ticketUrl = linkIn(email, '/t/')
  })

  await test.step('check a guest in at the door', async () => {
    await tabs.getByRole('link', { name: 'Check in' }).click()
    await expect(page.getByRole('button', { name: 'Start scanning' })).toBeVisible()
    await page.getByRole('searchbox', { name: 'Find a guest' }).fill(buyer.first)
    const checkIn = page.getByRole('button', { name: 'Check in' }).first()
    await expectTouchTarget(checkIn)
    await checkIn.click()
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
    await expect(page.getByText('Recently checked in')).toBeVisible()
    await expect(page.getByText('1 / 2', { exact: true })).toBeVisible()
    await expectFitsScreen(page)
    await shot('05-check-in')
  })

  await test.step('see who has arrived on the guest list', async () => {
    await tabs.getByRole('link', { name: 'Guests' }).click()
    const row = page.getByRole('link', { name: new RegExp(buyer.name) })
    await expect(row).toContainText('1/2 in')
    await expectTouchTarget(row)
    await page.getByRole('radio', { name: 'Arrived', exact: true }).click()
    await expect(row).toBeVisible()
    await expectFitsScreen(page)
    await shot('06-guests')
    await page.getByRole('searchbox', { name: 'Search guests' }).fill('nobody-matches-this')
    await expect(page.getByText(/No guests match/)).toBeVisible()
  })

  await test.step('the emailed ticket opens without an account', async () => {
    const guest = await browser.newContext(deviceOptions(testInfo))
    const guestPage = await guest.newPage()
    await guestPage.goto(ticketUrl)
    await expect(guestPage.getByRole('heading', { name: eventName })).toBeVisible()
    await expect(guestPage.getByText('Saturday, November 14')).toBeVisible()
    await expect(guestPage.getByText(buyer.name)).toBeVisible()
    await expect(guestPage.getByRole('region', { name: 'Staff controls' })).toHaveCount(0)
    await expectFitsScreen(guestPage)
    await shot('07-ticket', guestPage)

    const forgedPage = await guest.newPage()
    await forgedPage.goto(ticketUrl.slice(0, -1) + (ticketUrl.endsWith('A') ? 'B' : 'A'))
    await expect(forgedPage.getByText('Ticket not found')).toBeVisible()
    await guest.close()
  })

  await test.step('invite door staff, who can only check guests in', async () => {
    await tabs.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await expectFitsScreen(page)
    await shot('08-settings')
    await page.getByRole('link', { name: /^Team/ }).click()
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible()
    await page.getByLabel('Name').fill(door.name)
    await page.getByLabel('Email').fill(door.email)
    await page.getByRole('button', { name: 'Send invite' }).click()
    await expect(page.getByText(`Invited ${door.email}.`)).toBeVisible()
    await expectFitsScreen(page)
    await shot('09-team')

    const invite = await waitForEmail((text) => text.includes(door.email) && text.includes(eventName))
    const doorContext = await browser.newContext(deviceOptions(testInfo))
    const doorPage = await doorContext.newPage()
    await doorPage.goto(linkIn(invite, '/api/auth/reset-password/'))
    await doorPage.getByLabel('New password').fill(PASSWORD)
    await doorPage.getByLabel('Confirm password').fill(PASSWORD)
    await doorPage.getByRole('button', { name: 'Save password' }).click()
    await expect(doorPage.getByText('Your password is set')).toBeVisible()
    await doorPage.getByLabel('Email').fill(door.email)
    await doorPage.getByLabel('Password').fill(PASSWORD)
    await doorPage.getByRole('button', { name: 'Sign in' }).click()

    await expect(doorPage).toHaveURL(/\/events$/)
    await doorPage.getByRole('link', { name: new RegExp(eventName) }).click()
    await expect(doorPage).toHaveURL(/\/check-in$/)
    await expect(doorPage.getByRole('navigation', { name: 'Event' })).toHaveCount(0)
    await shot('10-door-staff', doorPage)
    await doorPage.goto(`${eventUrl}/guests`)
    await expect(doorPage).toHaveURL(/\/check-in$/)
    await doorContext.close()
  })

  await test.step('sign out from the account sheet', async () => {
    await page.getByRole('button', { name: 'Account' }).click()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })
})

test('signed-out visitors are sent to sign in', async ({ page }) => {
  await page.goto('/events')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expectFitsScreen(page)
})
