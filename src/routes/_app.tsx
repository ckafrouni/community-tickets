import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '#/functions/auth.functions'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const user = await getSessionFn()
    if (!user) throw redirect({ to: '/login', search: { redirect: location.href } })
    return { user }
  },
  component: Outlet,
})
