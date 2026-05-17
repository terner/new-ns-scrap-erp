import { z } from 'zod'

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'กรุณากรอก email หรือ username'),
  password: z.string().min(1, 'กรุณากรอก password'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export function isEmailIdentifier(identifier: string) {
  return z.string().email().safeParse(identifier).success
}
