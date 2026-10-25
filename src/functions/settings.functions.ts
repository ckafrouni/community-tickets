import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eventSettingsSchema } from '#/lib/schemas'
import { getEmailFrom, sendTestEmail } from '#/server/email.server'
import { adminMiddleware } from '#/server/middleware'
import { getSettings, saveSettings } from '#/server/repo.server'
import { getBaseUrl } from '#/server/request.server'

export const getSettingsFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async () => ({
    settings: await getSettings(),
    emailFrom: getEmailFrom(),
    baseUrl: getBaseUrl(),
  }))

export const saveSettingsFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(eventSettingsSchema)
  .handler(async ({ data }) => {
    await saveSettings(data)
    return { ok: true }
  })

export const sendTestEmailFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(z.object({ to: z.email() }))
  .handler(async ({ data }) => {
    await sendTestEmail(data.to)
    return { ok: true }
  })
