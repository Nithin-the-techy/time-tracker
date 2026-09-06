'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useUIStore } from '@/store/ui-store'
import { useDepartments } from '@/lib/hooks'
import { LogForm } from '@/components/log-form'

export function LogModal() {
  const open = useUIStore((s) => s.logModalOpen)
  const presetDeptSlug = useUIStore((s) => s.logModalPresetDept)
  const closeLogModal = useUIStore((s) => s.closeLogModal)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeLogModal()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto md:left-[calc(50%+7rem)]">
        {open && (
          <LogFormInner presetDeptSlug={presetDeptSlug} onSaved={closeLogModal} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function LogFormInner({ presetDeptSlug, onSaved }: { presetDeptSlug: string | null; onSaved: () => void }) {
  const { departments } = useDepartments()
  const presetDept = presetDeptSlug
    ? departments.find((d) => d.slug === presetDeptSlug) ?? null
    : null
  return (
    <>
      <DialogHeader>
        <DialogTitle>Log time</DialogTitle>
        <DialogDescription>Use this for completed time that was not recorded by a running step.</DialogDescription>
      </DialogHeader>
      <div className="pt-2">
        <LogForm presetDepartmentId={presetDept?.id} onSaved={onSaved} />
      </div>
    </>
  )
}
