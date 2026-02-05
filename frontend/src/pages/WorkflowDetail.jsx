import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { api } from '../api'
import StepCard from '../components/StepCard'

export default function WorkflowDetail() {
  const { id: workflowId } = useParams()
  const navigate = useNavigate()
  const [workflow, setWorkflow] = useState(null)
  const [executions, setExecutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reordering, setReordering] = useState(false)
  const [running, setRunning] = useState(false)

  const fetchWorkflow = useCallback(() => {
    if (!workflowId) return
    setLoading(true)
    api
      .getWorkflow(workflowId)
      .then(setWorkflow)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [workflowId])

  useEffect(() => {
    fetchWorkflow()
  }, [fetchWorkflow])

  useEffect(() => {
    if (!workflowId) return
    api.listExecutions(workflowId).then((list) => setExecutions(list ?? [])).catch(() => {})
  }, [workflowId])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  )

  const steps = workflow?.steps ?? []
  const hasExecutions = executions.length > 0
  const immutable = hasExecutions

  const handleRun = () => {
    if (!workflowId || steps.length === 0) return
    setRunning(true)
    setError(null)
    api
      .executeWorkflow(workflowId)
      .then((res) => {
        navigate(`/executions/${res.execution_id}`)
      })
      .catch((e) => {
        setError(e.message)
        setRunning(false)
      })
      .finally(() => setRunning(false))
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id || !workflow?.steps?.length || immutable) return

    const oldIndex = steps.findIndex((s) => String(s.id) === active.id)
    const newIndex = steps.findIndex((s) => String(s.id) === over.id)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    const reordered = arrayMove(steps, oldIndex, newIndex)
    setReordering(true)

    const updates = reordered
      .map((step, i) =>
        step.order_index !== i ? { step, newOrder: i } : null
      )
      .filter(Boolean)

    Promise.all(
      updates.map(({ step, newOrder }) =>
        api.updateStep(workflowId, step.id, { order_index: newOrder })
      )
    )
      .then(() => fetchWorkflow())
      .catch((e) => setError(e.message))
      .finally(() => setReordering(false))
  }

  if (loading && !workflow) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (error && !workflow) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    )
  }

  if (!workflow) return null

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to="/"
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            ← Workflows
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-surface">
            {workflow.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {steps.length} step{steps.length !== 1 ? 's' : ''}
            {hasExecutions && (
              <> · {executions.length} run{executions.length !== 1 ? 's' : ''}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRun}
            disabled={running || steps.length === 0}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {running ? 'Starting…' : 'Run workflow'}
          </button>
          <Link
            to={`/workflows/${workflowId}/edit`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit workflow
          </Link>
          {!immutable && (
            <Link
              to={`/workflows/${workflowId}/steps/new`}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
            >
              + Add step
            </Link>
          )}
        </div>
      </div>

      {immutable && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This workflow has been run. Name, steps, and order can’t be changed.
        </div>
      )}

      {reordering && (
        <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Updating step order…
        </div>
      )}

      {steps.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500">No steps yet.</p>
          {!immutable && (
            <Link
              to={`/workflows/${workflowId}/steps/new`}
              className="mt-4 inline-block text-brand-600 hover:text-brand-700"
            >
              Add first step →
            </Link>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={steps.map((s) => String(s.id))}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-3">
              {steps.map((step) => (
                <li key={step.id}>
                  <StepCard
                    step={step}
                    workflowId={workflowId}
                    immutable={immutable}
                  />
                </li>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {/* Execution history */}
      {executions.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-surface">Execution history</h2>
          <ul className="mt-3 space-y-2">
            {[...executions]
              .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
              .map((ex) => (
                <li key={ex.id}>
                  <Link
                    to={`/executions/${ex.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <span className="text-sm font-medium text-slate-800">Run #{ex.id}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        ex.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ex.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {ex.status}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}
