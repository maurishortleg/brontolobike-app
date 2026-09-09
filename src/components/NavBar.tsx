'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Props = {
  backHref?: string
}

export default function NavBar({ backHref }: Props) {
  const router = useRouter()

  function goBack() {
    if (backHref) router.push(backHref)
    else router.back()
  }

  return (
    <div
      className="w-full flex items-center justify-between px-4 py-2 shrink-0"
      style={{ background: 'rgba(10,10,10,0.75)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      <button
        onClick={goBack}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
        style={{
          background: 'rgba(216,255,0,0.08)',
          color: '#D8FF00',
          border: '1px solid rgba(216,255,0,0.22)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M9 2L4 7L9 12" stroke="#D8FF00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Indietro
      </button>

      <Link
        href="/"
        aria-label="Home"
        className="flex items-center justify-center w-9 h-9 rounded-xl transition-all active:scale-95"
        style={{
          background: 'rgba(255,0,110,0.1)',
          border: '1px solid rgba(255,0,110,0.25)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 12L12 3L21 12" stroke="#FF006E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 10V20C5 20.55 5.45 21 6 21H9V15H15V21H18C18.55 21 19 20.55 19 20V10" stroke="#FF006E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  )
}
