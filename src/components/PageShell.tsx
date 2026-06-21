import Link from 'next/link'

type Props = {
  title: string
  backHref?: string
  backLabel?: string
  children: React.ReactNode
  actions?: React.ReactNode
}

export default function PageShell({ title, backHref = '/', backLabel = '← Home', children, actions }: Props) {
  return (
    <div className="min-h-screen flex flex-col">

      {/* Striscia top diagonale multi-colore */}
      <div className="bb-stripe w-full shrink-0" style={{ height: 5 }} />

      {/* Header pagina */}
      <div className="w-full px-4 py-4" style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)'
      }}>
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="text-xs font-semibold transition-colors"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              {backLabel}
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.12)' }}>|</span>
            <h1 className="text-lg font-black tracking-tight bb-text-gradient">{title}</h1>
          </div>
          {actions && <div>{actions}</div>}
        </div>
      </div>

      <div className="flex-1 py-6 px-4">
        <div className="max-w-lg mx-auto">
          <div className="bb-card-content p-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
