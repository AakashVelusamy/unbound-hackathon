import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link } from 'react-router-dom'

export default function StepCard({ step, workflowId, immutable }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: String(step.id),
    disabled: immutable,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-stretch gap-3 rounded-2xl border bg-white shadow-sm transition-all duration-200 ${
        isDragging
          ? 'z-50 scale-[1.02] border-brand-400 shadow-lg ring-2 ring-brand-200'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
      } ${immutable ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
    >
      {!immutable && (
        <div
          {...attributes}
          {...listeners}
          className="flex flex-col justify-center px-3 text-slate-400 transition hover:text-slate-600"
          aria-label="Drag to reorder"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1 py-4 pr-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md bg-brand-100 text-xs font-semibold text-brand-700">
            {step.order_index + 1}
          </span>
          <span className="text-xs font-medium text-slate-500">{step.model}</span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm text-slate-700">
          {step.prompt}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {step.context_strategy ?? 'full'}
          </span>
          {step.completion_criteria?.type && (
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {step.completion_criteria.type}
            </span>
          )}
          <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
            Retry budget: {step.completion_criteria?.max_retries ?? 3}
          </span>
        </div>
      </div>
      {!immutable && (
        <div className="flex items-center gap-1 border-l border-slate-100 pl-2">
          <Link
            to={`/workflows/${workflowId}/steps/${step.id}/edit`}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 opacity-0 transition duration-200 hover:bg-slate-100 hover:text-slate-900 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Edit
          </Link>
        </div>
      )}
    </div>
  )
}
