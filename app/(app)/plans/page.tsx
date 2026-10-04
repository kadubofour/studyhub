import { PageHeader } from '@/components/ui/PageHeader'
import { PlanPicker } from '@/components/billing/PlanPicker'

export default function PlansPage() {
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Plans" />
      <PlanPicker />
    </div>
  )
}
