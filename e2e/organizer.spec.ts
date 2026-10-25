import { expect, test } from '@playwright/test'
import {
  deviceOptions,
  expectCleanChrome,
  expectFitsScreen,
  expectTouchTarget,
  linkIn,
  screenshotter,
  waitForEmail,
} from './helpers'

const PASSWORD = 'correct-horse-battery'
const EVENT_YEAR = new Date().getFullYear() + 1
const EVENT_DAY = (() => {
  const day = new Date(Date.UTC(EVENT_YEAR, 10, 14)).toLocaleDateString('fr-FR', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return day.charAt(0).toUpperCase() + day.slice(1)
})()
const EUR_20 = /20,00\s€/

test('an organizer runs an event from their phone', async ({ page, browser }, testInfo) => {
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}${testInfo.project.name}`
  const organizer = { name: 'Maya Martin', email: `organizer-${run}@example.com` }
  const volunteer = { name: 'Val Bernard', email: `volunteer-${run}@example.com` }
  const buyer = { first: `Ana${run}`, name: `Ana${run} Lopez`, email: `ana-${run}@example.com` }
  const eventName = `Repas de quartier ${run}`
  const shot = screenshotter(page, testInfo)
  const tabs = page.getByRole('navigation', { name: 'Événement' })
  let eventUrl = ''
  let ticketUrl = ''

  await test.step('sign up and confirm the email address', async () => {
    await page.goto('/signup')
    await expectFitsScreen(page)
    await page.getByLabel('Votre nom').fill(organizer.name)
    await page.getByLabel('E-mail').fill(organizer.email)
    await page.getByLabel('Mot de passe').fill(PASSWORD)
    await page.getByRole('button', { name: 'Créer mon compte' }).click()
    await expect(page.getByRole('heading', { name: 'Vérifiez votre boîte mail' })).toBeVisible()

    const email = await waitForEmail((text) => text.includes(organizer.email) && text.includes('Confirmer mon e-mail'))
    await page.goto(linkIn(email, '/api/auth/verify-email'))
    await expect(page).toHaveURL(/\/events$/)
    await expect(page.getByText('Créez votre premier événement')).toBeVisible()
    await expectFitsScreen(page)
    await shot('01-events-empty')
  })

  await test.step('create an event', async () => {
    await page.getByRole('link', { name: 'Créer un événement' }).click()
    await page.getByLabel('Nom').fill(eventName)
    await page.getByLabel('Date', { exact: true }).click()
    await page.getByRole('combobox', { name: /mois/i }).selectOption('10')
    await page.getByRole('combobox', { name: /année/i }).selectOption(String(EVENT_YEAR))
    await expectCleanChrome(page)
    await page.getByRole('button', { name: new RegExp(`14 novembre ${EVENT_YEAR}`) }).click()
    await page.getByLabel('Heure').fill('18:30')
    await page.getByLabel('Lieu').fill('Salle des fêtes, 12 rue de la Paix')
    await page.getByRole('button', { name: 'Ajouter un tarif' }).click()
    await page.getByLabel('Tarif', { exact: true }).nth(1).fill('Enfant')
    await page.getByLabel('Prix Enfant').fill('0')
    await page.getByLabel('Coordonnées bancaires').fill('IBAN FR76 3000 6000 0112 3456 7890 189')
    const create = page.getByRole('button', { name: 'Créer l’événement' })
    await expect(create).toBeInViewport()
    await expectFitsScreen(page)
    await shot('02-create-event')
    await create.click()

    await expect(page).toHaveURL(/\/events\/[a-z0-9]+\/guests$/)
    eventUrl = page.url().replace(/\/guests$/, '')
    await expect(page.getByText('Pas encore d’invités')).toBeVisible()
    await expectCleanChrome(page)
    await expect(page.getByText(`${EVENT_DAY} · 18:30`)).toBeVisible()
    for (const tab of ['Vendre', 'Invités', 'Check-in', 'Réglages']) {
      await expectTouchTarget(tabs.getByRole('link', { name: tab }))
    }
  })

  await test.step('sell two tickets for cash', async () => {
    await tabs.getByRole('link', { name: 'Vendre' }).click()
    await page.getByRole('textbox', { name: 'Nom' }).fill(buyer.name)
    await page.getByRole('textbox', { name: 'E-mail' }).fill(buyer.email)
    await page.getByRole('button', { name: 'Un billet Plein tarif de plus' }).click()
    await page.getByRole('button', { name: 'Un billet Plein tarif de plus' }).click()
    const confirm = page.getByRole('button', { name: /^Valider 20,00\s€ · 2 billets$/ })
    await expect(confirm).toBeInViewport()
    await expectTouchTarget(page.getByRole('button', { name: 'Un billet Plein tarif de plus' }))
    await expectFitsScreen(page)
    await shot('03-sell')
    await confirm.click()

    await expect(page.getByText(/Vente enregistrée : 20,00\s€/)).toBeVisible()
    await expect(page.getByText(`Billets envoyés à ${buyer.email}.`)).toBeVisible()
    await expect(page.getByRole('img', { name: /^QR code du billet/ })).toHaveCount(2)
    await expectFitsScreen(page)
    await shot('04-sale-recorded')

    const email = await waitForEmail((text) => text.includes(`C’est confirmé, ${buyer.first} !`))
    expect(email).toContain(eventName)
    expect(email).toContain(`${EVENT_DAY} · 18:30`)
    expect(email).toMatch(EUR_20)
    ticketUrl = linkIn(email, '/t/')
  })

  await test.step('check a guest in at the door', async () => {
    await tabs.getByRole('link', { name: 'Check-in' }).click()
    await expect(page.getByRole('button', { name: 'Scanner' })).toBeVisible()
    await page.getByRole('searchbox', { name: 'Trouver un invité' }).fill(buyer.first)
    const checkIn = page.getByRole('button', { name: 'Check-in', exact: true }).first()
    await expectTouchTarget(checkIn)
    await checkIn.click()
    await expect(page.getByRole('button', { name: 'Annuler' })).toBeVisible()
    await expect(page.getByText('Derniers arrivés')).toBeVisible()
    await expect(page.getByText('1 / 2', { exact: true })).toBeVisible()
    await expectFitsScreen(page)
    await shot('05-check-in')
  })

  await test.step('see who has arrived on the guest list', async () => {
    await tabs.getByRole('link', { name: 'Invités' }).click()
    const row = page.getByRole('link', { name: new RegExp(buyer.name) })
    await expect(row).toContainText('1/2 arrivés')
    await expectTouchTarget(row)
    await page.getByRole('button', { name: 'Arrivés', exact: true }).click()
    await expect(row).toBeVisible()
    await expectFitsScreen(page)
    await shot('06-guests')
    await page.getByRole('searchbox', { name: 'Rechercher un invité' }).fill('personne-ne-correspond')
    await expect(page.getByText(/Aucun invité ne correspond/)).toBeVisible()
  })

  await test.step('sell by bank transfer and record the payment later', async () => {
    const payer = { first: `Bob${run}`, name: `Bob${run} Durand`, email: `bob-${run}@example.com` }
    await tabs.getByRole('link', { name: 'Vendre' }).click()
    await page.getByRole('textbox', { name: 'Nom' }).fill(payer.name)
    await page.getByRole('textbox', { name: 'E-mail' }).fill(payer.email)
    await page.getByRole('button', { name: 'Un billet Plein tarif de plus' }).click()
    await page.getByRole('button', { name: 'Un billet Enfant de plus' }).click()
    await page.getByRole('button', { name: 'Virement plus tard', exact: true }).click()
    await page.getByRole('button', { name: /^Valider · reste 10,00\s€ par virement$/ }).click()

    await expect(page.getByText(/Réservation enregistrée : reste 10,00\s€ à payer/)).toBeVisible()
    await expect(page.getByText('QR code disponible après paiement').first()).toBeVisible()
    const reference = (await page
      .getByText(/^CT\d+$/)
      .first()
      .textContent())!.trim()
    const request = await waitForEmail((text) => text.includes(`Merci, ${payer.first} !`) && text.includes(reference))
    expect(request).toMatch(/Reste à payer : 10,00\s€/)
    expect(request).toContain('IBAN FR76 3000 6000 0112 3456 7890 189')
    expect(request).toContain('1 × Plein tarif, 1 × Enfant')
    await shot('07a-awaiting-payment')

    await tabs.getByRole('link', { name: 'Check-in' }).click()
    await page.getByRole('searchbox', { name: 'Trouver un invité' }).fill(payer.first)
    await expect(page.getByText('À payer').first()).toBeVisible()

    await tabs.getByRole('link', { name: 'Invités' }).click()
    await page.getByRole('searchbox', { name: 'Rechercher un invité' }).fill(reference)
    await page.getByRole('link', { name: new RegExp(payer.name) }).click()
    await page.getByRole('button', { name: 'Enregistrer un paiement' }).click()
    const record = page.getByRole('button', { name: /^Enregistrer 10,00\s€$/ })
    await expect(record).toBeVisible()
    await expectCleanChrome(page)
    await record.click()
    await expect(page.getByText(`Payé ! Billets envoyés à ${payer.email}.`)).toBeVisible()
    await expect(page.getByRole('img', { name: /^QR code du billet/ })).toHaveCount(2)
    const tickets = await waitForEmail((text) => text.includes(`C’est confirmé, ${payer.first} !`))
    expect(tickets).toMatch(/Virement · .* : 10,00\s€/)
    await shot('07b-paid-by-transfer')
  })

  await test.step('the emailed ticket opens without an account', async () => {
    const guest = await browser.newContext(deviceOptions(testInfo))
    const guestPage = await guest.newPage()
    await guestPage.goto(ticketUrl)
    await expect(guestPage.getByRole('heading', { name: eventName })).toBeVisible()
    await expect(guestPage.getByText(EVENT_DAY)).toBeVisible()
    await expect(guestPage.getByText(buyer.name)).toBeVisible()
    await expect(guestPage.getByRole('region', { name: 'Espace équipe' })).toHaveCount(0)
    await expectFitsScreen(guestPage)
    await shot('07-ticket', guestPage)

    const forgedPage = await guest.newPage()
    await forgedPage.goto(ticketUrl.slice(0, -1) + (ticketUrl.endsWith('A') ? 'B' : 'A'))
    await expect(forgedPage.getByText('Billet introuvable')).toBeVisible()
    await guest.close()
  })

  await test.step('invite a volunteer, who can only do check-in', async () => {
    await tabs.getByRole('link', { name: 'Réglages' }).click()
    await expect(page.getByRole('heading', { name: 'Réglages', exact: true })).toBeVisible()
    await expectFitsScreen(page)
    await shot('08-settings')
    await page.getByRole('link', { name: /^Équipe/ }).click()
    await expect(page.getByRole('heading', { name: 'Équipe', exact: true })).toBeVisible()
    await page.getByLabel('Nom').fill(volunteer.name)
    await page.getByLabel('E-mail').fill(volunteer.email)
    await page.getByRole('button', { name: 'Envoyer l’invitation' }).click()
    await expect(page.getByText(`Invitation envoyée à ${volunteer.email}.`)).toBeVisible()
    await expectFitsScreen(page)
    await shot('09-team')

    const invite = await waitForEmail((text) => text.includes(volunteer.email) && text.includes(eventName))
    expect(invite).toContain('bénévole')
    const volunteerContext = await browser.newContext(deviceOptions(testInfo))
    const volunteerPage = await volunteerContext.newPage()
    await volunteerPage.goto(linkIn(invite, '/api/auth/reset-password/'))
    await volunteerPage.getByLabel('Nouveau mot de passe').fill(PASSWORD)
    await volunteerPage.getByLabel('Confirmer le mot de passe').fill(PASSWORD)
    await volunteerPage.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(volunteerPage.getByText('Votre mot de passe est enregistré')).toBeVisible()
    await volunteerPage.getByLabel('E-mail').fill(volunteer.email)
    await volunteerPage.getByLabel('Mot de passe').fill(PASSWORD)
    await volunteerPage.getByRole('button', { name: 'Se connecter' }).click()

    await expect(volunteerPage).toHaveURL(/\/events$/)
    await expect(volunteerPage.getByText('Bénévole')).toBeVisible()
    await expectCleanChrome(volunteerPage)
    await volunteerPage.getByRole('link', { name: new RegExp(eventName) }).click()
    await expect(volunteerPage).toHaveURL(/\/check-in$/)
    await expect(volunteerPage.getByRole('navigation', { name: 'Événement' })).toHaveCount(0)
    await shot('10-volunteer', volunteerPage)
    await volunteerPage.goto(`${eventUrl}/guests`).catch((error: Error) => {
      if (!/interrupted by another navigation/.test(error.message)) throw error
    })
    await expect(volunteerPage).toHaveURL(/\/check-in$/)
    await volunteerContext.close()
  })

  await test.step('sign out from the account sheet', async () => {
    await page.getByRole('button', { name: 'Mon compte' }).click()
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible()
    await expectCleanChrome(page)
    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })
})

test('signed-out visitors are sent to sign in', async ({ page }) => {
  await page.goto('/events')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible()
  await expectFitsScreen(page)
  await expectCleanChrome(page)
})
