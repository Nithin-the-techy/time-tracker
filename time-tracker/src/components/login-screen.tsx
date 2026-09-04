'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

export function LoginScreen() {
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get('next') || '/'
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Wrong password')
        setLoading(false)
        return
      }
      router.push(next)
      router.refresh()
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-sm px-6">
        <h1 className="font-serif text-3xl mb-1">Operations</h1>
        <p className="text-muted-foreground text-sm mb-6">Time tracker</p>

        <form onSubmit={submit} className="space-y-4">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="font-sans"
          />
          {error && <p className="text-sm text-[var(--depreciation)]">{error}</p>}
          <Button type="submit" disabled={loading || !password} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enter
          </Button>
        </form>

        <p className="text-xs text-muted-foreground mt-6">
          {process.env.NEXT_PUBLIC_DEV_MODE === '1' ? (
            <>Dev mode — any password works. Set <code>APP_PASSWORD</code> in production.</>
          ) : (
            <>Single-user app. One password gates everything.</>
          )}
        </p>
      </div>
    </div>
  )
}
