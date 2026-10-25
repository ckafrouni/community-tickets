import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_staff/_admin')({
  beforeLoad: ({ context }) => {
    if (context.session.role !== 'admin') throw redirect({ to: '/door' })
  },
})
