import { PageHeader } from '@/components/ui/PageHeader'
import { ReturnStatus } from '@/components/billing/ReturnStatus'

export default async function ReturnPage({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const p = await searchParams
  const reference = p.reference ?? p.trxref ?? ''
  return (
    <div className="max-w-xl space-y-5">
      <PageHeader title="Premium" />
      <div className="card">{reference ? <ReturnStatus reference={reference} /> : <p>We couldn&apos;t find that payment.</p>}</div>
    </div>
  )
}
