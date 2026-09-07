import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function LedgerPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card p-5 shadow-[0_10px_30px_rgba(0,0,0,0.10)]',
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
        'rounded-sm border border-border bg-background/25 p-3',
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
