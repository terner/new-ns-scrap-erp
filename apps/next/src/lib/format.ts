export function formatPhoneDisplay(value: string | null | undefined) {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('0')) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 9 && digits.startsWith('0')) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
  return value
}
