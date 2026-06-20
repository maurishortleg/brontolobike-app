import SchedaAtletaClient from './SchedaAtletaClient'

export default function SchedaAtletaPage({ params }: { params: { id: string } }) {
  return <SchedaAtletaClient atletaId={params.id} />
}
