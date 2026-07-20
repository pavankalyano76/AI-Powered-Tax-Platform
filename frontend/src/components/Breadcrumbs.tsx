import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

type Crumb = { label: string; to?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="px-8 py-3 text-sm text-slate-500 flex items-center gap-1.5 border-b border-slate-200 bg-white">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
          {item.to ? (
            <Link to={item.to} className="hover:text-brand-700 hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-900 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
