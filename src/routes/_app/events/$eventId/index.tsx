import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/events/$eventId/')({
  beforeLoad: ({ context, params }) => {
    throw redirect({
      to: context.role === 'host' ? '/events/$eventId/guests' : '/events/$eventId/check-in',
      params,
    })
  },
})
