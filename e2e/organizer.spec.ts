import { expect, test } from '@playwright/test'
import { deviceOptions, expectFitsScreen, expectTouchTarget, linkIn, screenshotter, waitForEmail } from './helpers'

const PASSWORD = 'correct-horse-battery'
const EVENT_YEAR = new Date().getFullYear() + 1
const EVENT_DAY = new Date(Date.UTC(EVENT_YEAR, 10, 14)).toLocaleDateString('en', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

test('an organizer runs an event from their phone', async ({ page, browser }, testInfo) => {
  const run = `${Date.now().toString(36)}${testInfo.project.name}`
  const host = { name: 'Maya Host', email: `host-${run}@example.com` }
  const volunteer = { name: 'Val Volunteer', email: `volunteer-${run}@example.com` }
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
    await page.getByLabel('Date', { exact: true }).click()
    await page.getByRole('combobox', { name: /month/i }).selectOption('10')
    await page.getByRole('combobox', { name: /year/i }).selectOption(String(EVENT_YEAR))
    await page.getByRole('button', { name: new RegExp(`November 14(th)?, ${EVENT_YEAR}`) }).click()
    await page.getByLabel('Time').fill('18:30')
    await page.getByLabel('Location').fill('Community Hall, 12 Main St')
    const create = page.getByRole('button', { name: 'Create event' })
    await expect(create).toBeInViewport()
    await expectFitsScreen(page)
    await shot('02-create-event')
    await create.click()

    await expect(page).toHaveURL(/\/events\/[a-z0-9]+\/guests$/)
    eventUrl = page.url().replace(/\/guests$/, '')
    await expect(page.getByText('No guests yet')).toBeVisible()
    await expect(page.getByText(`${EVENT_DAY} · 6:30 PM`)).toBeVisible()
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
    expect(email).toContain(`${EVENT_DAY} · 6:30 PM`)
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
    await page.getByRole('button', { name: 'Arrived', exact: true }).click()
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
    await expect(guestPage.getByText(EVENT_DAY)).toBeVisible()
    await expect(guestPage.getByText(buyer.name)).toBeVisible()
    await expect(guestPage.getByRole('region', { name: 'Staff controls' })).toHaveCount(0)
    await expectFitsScreen(guestPage)
    await shot('07-ticket', guestPage)

    const forgedPage = await guest.newPage()
    await forgedPage.goto(ticketUrl.slice(0, -1) + (ticketUrl.endsWith('A') ? 'B' : 'A'))
    await expect(forgedPage.getByText('Ticket not found')).toBeVisible()
    await guest.close()
  })

  await test.step('invite a volunteer, who can only check guests in', async () => {
    await tabs.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await expectFitsScreen(page)
    await shot('08-settings')
    await page.getByRole('link', { name: /^Team/ }).click()
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible()
    await page.getByLabel('Name').fill(volunteer.name)
    await page.getByLabel('Email').fill(volunteer.email)
    await page.getByRole('button', { name: 'Send invite' }).click()
    await expect(page.getByText(`Invited ${volunteer.email}.`)).toBeVisible()
    await expectFitsScreen(page)
    await shot('09-team')

    const invite = await waitForEmail((text) => text.includes(volunteer.email) && text.includes(eventName))
    const volunteerContext = await browser.newContext(deviceOptions(testInfo))
    const volunteerPage = await volunteerContext.newPage()
    await volunteerPage.goto(linkIn(invite, '/api/auth/reset-password/'))
    await volunteerPage.getByLabel('New password').fill(PASSWORD)
    await volunteerPage.getByLabel('Confirm password').fill(PASSWORD)
    await volunteerPage.getByRole('button', { name: 'Save password' }).click()
    await expect(volunteerPage.getByText('Your password is set')).toBeVisible()
    await volunteerPage.getByLabel('Email').fill(volunteer.email)
    await volunteerPage.getByLabel('Password').fill(PASSWORD)
    await volunteerPage.getByRole('button', { name: 'Sign in' }).click()

    await expect(volunteerPage).toHaveURL(/\/events$/)
    await volunteerPage.getByRole('link', { name: new RegExp(eventName) }).click()
    await expect(volunteerPage).toHaveURL(/\/check-in$/)
    await expect(volunteerPage.getByRole('navigation', { name: 'Event' })).toHaveCount(0)
    await shot('10-volunteer', volunteerPage)
    await volunteerPage.goto(`${eventUrl}/guests`).catch((error: Error) => {
      if (!/interrupted by another navigation/.test(error.message)) throw error
    })
    await expect(volunteerPage).toHaveURL(/\/check-in$/)
    await volunteerContext.close()
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
