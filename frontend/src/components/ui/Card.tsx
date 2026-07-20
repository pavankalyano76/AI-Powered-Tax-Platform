import type { HTMLAttributes, ReactNode } from 'react'

export function Card({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-sm ${className}`} {...props}>
      {children}
    </div>
  )
}
