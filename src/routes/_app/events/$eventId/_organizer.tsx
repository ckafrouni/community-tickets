import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/events/$eventId/_organizer')({
  beforeLoad: ({ context, params }) => {
    if (context.role !== 'organizer') throw redirect({ to: '/events/$eventId/check-in', params })
  },
})
