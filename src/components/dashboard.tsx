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
  const currentTab = TABS.find((item) => item.id === tab)?.label ?? 'Progress'
  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground">Skip to content</a>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row min-h-screen">
        <div className="md:hidden border-b border-border px-4"><Header currentTab={currentTab} /></div>
        <aside className="hidden md:flex w-56 shrink-0 border-r border-border px-4 py-5 flex-col sticky top-0 h-screen">
          <Header currentTab={currentTab} />
          <nav className="space-y-1 mt-10">
            {TABS.map((t) => <TabButton key={t.id} tab={t.id} label={t.label} icon={t.icon} active={tab === t.id} onClick={() => setTab(t.id)} />)}
          </nav>
          <button type="button" aria-label="Log time" onClick={() => openLogModal(activeDeptSlug ?? undefined)} className="mt-auto w-full rounded-md border border-border px-3 py-2 text-left text-sm transition hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-ring"><Plus className="mr-2 inline h-4 w-4" /> Log time</button>
        </aside>

      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 px-4 py-5 pb-24 outline-none md:px-8 md:pb-8">
        {tab === 'goals' && <GoalsScreen />}
        {tab === 'progress' && <ProgressScreen />}
        {tab === 'database' && activeDeptSlug && <DepartmentPage slug={activeDeptSlug} />}
        {tab === 'database' && !activeDeptSlug && <DatabaseScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </main>

      <div className="fixed right-4 bottom-20 z-40 md:hidden">
        <button type="button" aria-label="Log time" title="Log time" onClick={() => openLogModal(activeDeptSlug ?? undefined)} className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-[1.02] active:scale-95 focus-visible:outline-2 focus-visible:outline-ring"><Plus className="h-5 w-5" /></button>
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

function Header({ currentTab }: { currentTab: string }) {
  return (
    <header className="bg-background/95 backdrop-blur">
      <div className="h-14 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-lg tracking-tight">Operations</span>
          <span className="text-xs text-muted-foreground md:hidden">{currentTab}</span>
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
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-md px-3 py-2 transition focus-visible:outline-2 focus-visible:outline-ring md:w-full md:flex-row md:justify-start md:gap-3 ${
        active ? 'border border-border bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
      }`}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      <span className="text-sm">{label}</span>
    </button>
  )
}
