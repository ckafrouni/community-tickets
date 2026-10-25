import type { PaymentMethod, PaymentStatus } from './types'

export function paymentStatus(order: { amount: number; paid: number }): PaymentStatus {
  if (order.paid >= order.amount) return 'paid'
  return order.paid > 0 ? 'partial' : 'unpaid'
}

export function paymentReference(orderId: number): string {
  return `CT${orderId}`
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { cash: 'Espèces', transfer: 'Virement' }
