import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/events/$eventId/_host')({
  beforeLoad: ({ context, params }) => {
    if (context.role !== 'host') throw redirect({ to: '/events/$eventId/check-in', params })
  },
})
