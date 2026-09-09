import type { User } from '@supabase/supabase-js'

// Lista admin definita SOLO via variabili d'ambiente (mai hardcoded nel codice).
// Configura ADMIN_EMAIL nei secrets di Vercel e in .env.local.
// Per più admin, separa le email con una virgola in ADMIN_EMAILS.
const ADMIN_EMAILS: string[] = [
  ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : []),
  ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim()) : []),
].filter(Boolean)

export function isAdmin(user: User | null): boolean {
  return !!user?.email && ADMIN_EMAILS.includes(user.email)
}
