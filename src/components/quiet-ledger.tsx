import { cloneElement, isValidElement, useId, type HTMLAttributes, type ReactElement, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function LedgerPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/80 bg-card p-6',
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
        'rounded-xl border border-border/70 bg-background/20 p-4',
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
      className={cn('text-xs leading-5 text-muted-foreground', className)}
      {...props}
    />
  )
}

export function FormField({
  label,
  children,
  hint,
  required = false,
  className,
}: {
  label: string
  children: ReactNode
  hint?: string
  required?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={id} className="block text-xs font-medium leading-5 text-foreground">
        {label}{required && <span className="ml-1 text-[var(--growth)]" aria-hidden="true">*</span>}
      </label>
      {hint && <p id={`${id}-hint`} className="text-xs leading-4 text-muted-foreground">{hint}</p>}
      {isValidElement(children)
        ? (() => {
            const element = children as ReactElement<{ id?: string; 'aria-describedby'?: string }>
            return cloneElement(element, {
              id,
              'aria-describedby': hint ? `${id}-hint` : element.props['aria-describedby'],
            })
          })()
        : children}
    </div>
  )
}
