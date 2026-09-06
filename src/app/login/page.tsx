import { Suspense } from 'react'
import { LoginScreen } from '@/components/login-screen'

// Suspense is required: LoginScreen reads useSearchParams() (the ?next= fall
// back target), which opts out of static prerendering without a boundary.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  )
}
