import SchedaAtletaClient from './SchedaAtletaClient'

export default async function SchedaAtletaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SchedaAtletaClient atletaId={id} />
}
