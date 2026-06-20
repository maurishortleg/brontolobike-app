import type { User } from '@supabase/supabase-js'

const ADMIN_EMAILS = [
  process.env.ADMIN_EMAIL,
  'gambacorta.m@gmail.com',
].filter(Boolean)

export function isAdmin(user: User | null): boolean {
  return !!user?.email && ADMIN_EMAILS.includes(user.email)
}
