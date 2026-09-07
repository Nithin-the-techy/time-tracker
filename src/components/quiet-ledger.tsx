import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function LedgerPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-6 shadow-[0_18px_60px_rgba(0,0,0,0.14)]',
        className,
      )}
      {...props}
    />
  )
}

export function LedgerRow({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-background/25 p-4',
        className,
      )}
      {...props}
    />
  )
}

export function LedgerSectionLabel({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-sm font-semibold leading-5 text-foreground', className)}
      {...props}
    />
  )
}

export function LedgerMeta({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm leading-5 text-muted-foreground', className)}
      {...props}
    />
  )
}
