import { Pencil, Bot, Lock, CheckCircle2, type LucideIcon } from 'lucide-react'

// Single source of truth for the Challenge 08 affordance system — every
// screen that renders a field's state (the field list, the document
// viewer's overlaid boxes, anywhere else) imports from here, so "what does
// a locked field look like" only has one answer in the whole app.

export const FIELD_STATE_META: Record<string, { icon: LucideIcon; label: string }> = {
  editable: { icon: Pencil, label: 'Editable' },
  ai_generated: { icon: Bot, label: 'AI-generated' },
  locked: { icon: Lock, label: 'Locked' },
  verified: { icon: CheckCircle2, label: 'Verified' },
}
