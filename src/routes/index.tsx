import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '#/functions/auth.functions'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    throw redirect({ to: (await getSessionFn()) ? '/events' : '/login' })
  },
})
