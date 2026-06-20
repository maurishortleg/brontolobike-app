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
      {/* Striscia top */}
      <div className="bb-stripe w-full h-2 shrink-0" />

      <div className="flex-1 py-8 px-4">
        <div className="max-w-lg mx-auto">
          {/* Header pagina */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href={backHref} className="text-gray-400 hover:text-gray-600 text-sm transition-colors">
                {backLabel}
              </Link>
              <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
            </div>
            {actions && <div>{actions}</div>}
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
