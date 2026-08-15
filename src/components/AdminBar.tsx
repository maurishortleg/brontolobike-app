'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AdminBar() {
  const pathname = usePathname()
  // Non mostrare nella pagina admin stessa
  if (pathname?.startsWith('/admin')) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50"
      style={{ filter: 'drop-shadow(0 4px 16px rgba(216,255,0,0.4))' }}
    >
      <Link
        href="/admin"
        className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black tracking-wide transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #D8FF00 0%, #aacc00 100%)',
          color: '#0A0A0A',
          boxShadow: '0 2px 12px rgba(216,255,0,0.5)',
          letterSpacing: '0.08em',
        }}
      >
        ⚙️ ADMIN
      </Link>
    </div>
  )
}
