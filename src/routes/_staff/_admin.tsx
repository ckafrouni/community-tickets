import { createFileRoute, redirect } from '@tanstack/react-router'

// Organizer-only pages. Door staff are sent to the scanner.
// (Server functions enforce this independently via adminMiddleware.)
export const Route = createFileRoute('/_staff/_admin')({
  beforeLoad: ({ context }) => {
    if (context.session.role !== 'admin') throw redirect({ to: '/door' })
  },
})
