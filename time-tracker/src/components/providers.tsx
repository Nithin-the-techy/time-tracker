'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { store } from '@/lib/store'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  )

  // Bootstrap the local cache on mount — fetches departments, settings, rivals, weights.
  // Skipped on the login page: without a session those calls just 401.
  useEffect(() => {
    if (window.location.pathname === '/login') return
    store.bootstrap().catch(console.error)
  }, [])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
