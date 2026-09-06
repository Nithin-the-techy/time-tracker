'use client'

import { LineChart, History, Settings, LogIn, BriefcaseBusiness } from 'lucide-react'
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-5 pb-24">
        {tab === 'goals' && <GoalsScreen />}
        {tab === 'progress' && <ProgressScreen />}
        {tab === 'database' && activeDeptSlug && <DepartmentPage slug={activeDeptSlug} />}
        {tab === 'database' && !activeDeptSlug && <DatabaseScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </main>

      <LogFab />

      <nav className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
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
  )
}

// The one universal log entry point. Always visible, one tap away from
// anywhere; inside a department page it pre-selects that department.
function LogFab() {
  const openLogModal = useUIStore((s) => s.openLogModal)
  const activeDeptSlug = useUIStore((s) => s.activeDeptSlug)
  const open = useUIStore((s) => s.logModalOpen)

  if (open) return null

  return (
    <button
      type="button"
      aria-label="Log time"
      onClick={() => openLogModal(activeDeptSlug ?? undefined)}
      className="fixed right-4 bottom-20 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition"
    >
      <LogIn className="h-5 w-5" />
    </button>
  )
}

function Header() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-lg tracking-tight">Operations</span>
          <span className="text-muted-foreground text-xs hidden sm:inline">time and work</span>
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
      className={`flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-md min-w-0 transition ${
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px]">{label}</span>
    </button>
  )
}
