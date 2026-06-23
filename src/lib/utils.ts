import { clsx, type ClassValue } from 'clsx'
import { format, differenceInCalendarDays } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: number | string | { toNumber?: () => number }): string {
  const num = typeof amount === 'object' && amount?.toNumber ? amount.toNumber() : Number(amount)
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num)
}

export function formatDate(date: Date | string, fmt = 'dd/MM/yyyy'): string {
  return format(new Date(date), fmt)
}

export function formatDateLong(date: Date | string): string {
  return format(new Date(date), "dd 'de' MMMM 'de' yyyy")
}

export function calculateNights(checkIn: Date | string, checkOut: Date | string): number {
  return differenceInCalendarDays(new Date(checkOut), new Date(checkIn))
}

export function calculateTotal(basePrice: number | string, nights: number): number {
  return Number(basePrice) * nights
}

export function toDecimalNumber(val: unknown): number {
  if (typeof val === 'object' && val !== null && 'toNumber' in val) {
    return (val as { toNumber: () => number }).toNumber()
  }
  return Number(val)
}
