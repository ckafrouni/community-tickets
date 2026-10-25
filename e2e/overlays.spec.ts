import { expect, test } from '@playwright/test'
import { expectCleanChrome, linkIn, waitForEmail } from './helpers'

const PASSWORD = 'correct-horse-battery'

test('sheets, dialogs and partial payments stay flat', async ({ page }, testInfo) => {
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}${testInfo.project.name}`
  const email = `sheets-${run}@example.com`
  const buyer = { name: `Paula${run} Petit`, email: `paula-${run}@example.com` }
  const tabs = page.getByRole('navigation', { name: 'Événement' })
  const check = async (name: string) => {
    await expectCleanChrome(page)
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`) })
  }

  await page.goto('/signup')
  await page.getByLabel('Votre nom').fill('Sam Simon')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Mot de passe').fill(PASSWORD)
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page.getByRole('heading', { name: 'Vérifiez votre boîte mail' })).toBeVisible()
  await check('01-check-email')
  const confirm = await waitForEmail((text) => text.includes(email) && text.includes('Confirmer mon e-mail'))
  await page.goto(linkIn(confirm, '/api/auth/verify-email'))

  await page.getByRole('link', { name: 'Créer un événement' }).click()
  await page.getByLabel('Nom').fill(`Brocante ${run}`)
  await page.getByRole('button', { name: 'Créer l’événement' }).click()
  await expect(page.getByText('Pas encore d’invités')).toBeVisible()
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Mon compte' }).click()
  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible()
  await check('02-account-sheet')
  await page.keyboard.press('Escape')

  await tabs.getByRole('link', { name: 'Vendre' }).click()
  await page.getByRole('textbox', { name: 'Nom' }).fill(buyer.name)
  await page.getByRole('textbox', { name: 'E-mail' }).fill(buyer.email)
  await page.getByRole('button', { name: 'Un billet Plein tarif de plus' }).click()
  await page.getByLabel('Espèces reçues').fill('5')
  await expect(page.getByText(/Ajoutez vos coordonnées bancaires/)).toBeVisible()
  await check('03-sell-partial')
  await page.getByRole('button', { name: /^Valider · reste 15,00\s€ par virement$/ }).click()
  await expect(page.getByText(/Réservation enregistrée : reste 15,00\s€ à payer/)).toBeVisible()
  await check('04-order-partial')

  await page.getByRole('button', { name: 'Enregistrer un paiement' }).click()
  const record = page.getByRole('button', { name: /^Enregistrer 15,00\s€$/ })
  await expect(record).toBeVisible()
  await check('05-record-payment')
  await record.click()
  await expect(page.getByText(`Payé ! Billets envoyés à ${buyer.email}.`)).toBeVisible()

  await page.getByRole('button', { name: /^Supprimer le paiement de 5,00\s€$/ }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await check('06-delete-payment')
  await page.getByRole('button', { name: 'Garder' }).click()

  await page.getByRole('button', { name: 'Afficher le QR code en plein écran' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await check('07-qr')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Modifier les infos' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await check('08-edit-guest')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Annuler et rembourser' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await check('09-cancel-order')
  await page.keyboard.press('Escape')

  await tabs.getByRole('link', { name: 'Réglages' }).click()
  await page.getByRole('button', { name: 'Envoyer', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await check('10-test-email')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('link', { name: /^Équipe/ }).click()
  await expect(page.getByRole('heading', { name: 'Équipe', exact: true })).toBeVisible()
  await page.getByLabel('Nom').fill('Vera Vincent')
  await page.getByLabel('E-mail').fill(`vera-${run}@example.com`)
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click()
  await page.getByRole('button', { name: 'Retirer Vera Vincent' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await check('11-remove-member')
})

test('sign-in pages show errors without boxes inside the card', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('nobody@example.com')
  await page.getByLabel('Mot de passe').fill('wrong-password-123')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByText('E-mail ou mot de passe incorrect.')).toBeVisible()
  await expectCleanChrome(page)

  await page.goto('/reset-password?error=INVALID_TOKEN')
  await expect(page.getByRole('heading', { name: 'Ce lien a expiré' })).toBeVisible()
  await expectCleanChrome(page)
})
