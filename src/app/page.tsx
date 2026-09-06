'use client'

import { Dashboard } from '@/components/dashboard'
import { useBootstrap } from '@/lib/hooks'

export default function Home() {
  useBootstrap()
  return <Dashboard />
}
