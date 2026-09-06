'use client'

import { LineChart, History, Settings, Plus, BriefcaseBusiness } from 'lucide-react'
import { useUIStore, type ScreenTab } from '@/store/ui-store'
import { ProgressScreen } from '@/components/screens/progress-screen'
import { DatabaseScreen } from '@/components/screens/database-screen'
import { DepartmentPage } from '@/components/screens/department-page'
import { SettingsScreen } from '@/components/screens/settings-screen'
import { LogModal } from '@/components/log-modal'
import { GoalsScreen } from '@/components/screens/goals-screen'

const TABS: { id: ScreenTab; label: string; icon: React.ElementType }[] = [
  { id: 'progress', label: 'Progress', icon: LineChart },
  { id: 'goals', label: 'Work', icon: BriefcaseBusiness },
  { id: 'database', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function Dashboard() {
  const tab = useUIStore((s) => s.tab)
  const setTab = useUIStore((s) => s.setTab)
  const activeDeptSlug = useUIStore((s) => s.activeDeptSlug)
  const openLogModal = useUIStore((s) => s.openLogModal)
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row min-h-screen">
        <div className="md:hidden border-b border-border px-4"><Header /></div>
        <aside className="hidden md:flex w-56 shrink-0 border-r border-border px-4 py-5 flex-col sticky top-0 h-screen">
          <Header />
          <nav className="space-y-1 mt-10">
            {TABS.map((t) => <TabButton key={t.id} tab={t.id} label={t.label} icon={t.icon} active={tab === t.id} onClick={() => setTab(t.id)} />)}
          </nav>
          <button type="button" onClick={() => openLogModal(activeDeptSlug ?? undefined)} className="mt-auto w-full rounded-md border border-border px-3 py-2 text-sm text-left hover:border-foreground/30 transition"><Plus className="h-4 w-4 inline mr-2" /> Log time</button>
        </aside>

      <main className="flex-1 min-w-0 px-4 py-5 pb-24 md:px-8 md:pb-8">
        {tab === 'goals' && <GoalsScreen />}
        {tab === 'progress' && <ProgressScreen />}
        {tab === 'database' && activeDeptSlug && <DepartmentPage slug={activeDeptSlug} />}
        {tab === 'database' && !activeDeptSlug && <DatabaseScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </main>

      <div className="fixed right-4 bottom-20 z-40 md:hidden">
        <button type="button" aria-label="Log time" onClick={() => openLogModal(activeDeptSlug ?? undefined)} className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition"><Plus className="h-5 w-5" /></button>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-1 py-2 grid grid-cols-4">
          {TABS.map((t) => (
            <TabButton
              key={t.id}
              tab={t.id}
              label={t.label}
              icon={t.icon}
              active={tab === t.id}
              onClick={() => setTab(t.id)}
            />
          ))}
        </div>
      </nav>

      <LogModal />
      </div>
    </div>
  )
}

function Header() {
  return (
    <header className="bg-background/95 backdrop-blur">
      <div className="h-14 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-lg tracking-tight">Operations</span>
        </div>
      </div>
    </header>
  )
}

function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  tab: ScreenTab
  label: string
  icon: React.ElementType
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col md:flex-row items-center md:justify-start gap-0.5 md:gap-3 md:w-full px-3 py-2 rounded-md transition ${
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-sm">{label}</span>
    </button>
  )
}
