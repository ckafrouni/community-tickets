import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '#/functions/auth.functions'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) throw redirect({ to: '/login' })
    throw redirect({ to: session.role === 'admin' ? '/sell' : '/door' })
  },
})
