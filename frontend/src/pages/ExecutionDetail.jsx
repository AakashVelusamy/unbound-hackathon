import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { costForTokens, formatCost } from '../lib/cost'
import { downloadJson, executionSnapshotFilename } from '../lib/export'

const POLL_INTERVAL_MS = 1500
const TERMINAL_STATUSES = ['completed', 'failed']

function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour12: false }) + ' ' + d.toLocaleDateString()
}

function computeExecutionCost(stepAttempts, steps) {
  const stepById = Object.fromEntries((steps ?? []).map((s) => [s.id, s]))
  let total = 0
  const byStep = {}
  for (const a of stepAttempts ?? []) {
    const tokens = a.tokens_used ?? 0
    const model = stepById[a.step_id]?.model ?? 'kimi-k2p5'
    const cost = costForTokens(model, tokens)
    total += cost
    byStep[a.step_id] = (byStep[a.step_id] ?? 0) + cost
  }
  return { total, byStep }
}

export default function ExecutionDetail() {
  const { id: executionId } = useParams()
  const [execution, setExecution] = useState(null)
  const [workflow, setWorkflow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)

  const fetchExecution = () => {
    if (!executionId) return
    api
      .getExecution(executionId)
      .then((ex) => {
        setExecution(ex)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchExecution()
  }, [executionId])

  useEffect(() => {
    if (!execution?.workflow_id || workflow !== null) return
    api.getWorkflow(execution.workflow_id).then(setWorkflow).catch(() => {})
  }, [execution?.workflow_id, workflow])

  useEffect(() => {
    if (!executionId || !execution) return
    if (TERMINAL_STATUSES.includes(execution.status)) return

    const id = setInterval(fetchExecution, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [executionId, execution?.status])

  const handleSnapshot = () => {
    if (!execution || !workflow) return
    const snapshot = {
      snapshot_at: new Date().toISOString(),
      execution_id: execution.id,
      workflow_id: execution.workflow_id,
      workflow_name: workflow.name,
      status: execution.status,
      current_step_index: execution.current_step_index,
      started_at: execution.started_at,
      finished_at: execution.finished_at,
      step_attempts: execution.step_attempts ?? [],
      steps: workflow.steps ?? [],
    }
    downloadJson(executionSnapshotFilename(execution.id), snapshot)
  }

  if (loading && !execution) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (error && !execution) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 shadow-sm">
        {error}
      </div>
    )
  }

  if (!execution) return null

  const steps = workflow?.steps ?? []
  const attemptsByStep = (execution.step_attempts ?? []).reduce((acc, a) => {
    if (!acc[a.step_id]) acc[a.step_id] = []
    acc[a.step_id].push(a)
    return acc
  }, {})

  const { total: totalCost, byStep: costByStep } = computeExecutionCost(
    execution.step_attempts,
    steps
  )
  const totalTokens = (execution.step_attempts ?? []).reduce(
    (s, a) => s + (a.tokens_used ?? 0),
    0
  )

  const isLive = !TERMINAL_STATUSES.includes(execution.status)
  const statusLabel =
    execution.status === 'completed'
      ? 'Completed'
      : execution.status === 'failed'
        ? 'Failed'
        : execution.status === 'running'
          ? 'Running'
          : execution.status

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <Link
            to={execution.workflow_id ? `/workflows/${execution.workflow_id}` : '/'}
            className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
          >
            ← {workflow?.name ?? 'Workflow'}
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-surface">
            Run #{execution.id}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
                execution.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : execution.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isLive && (
                <span className="mr-2 h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              )}
              {statusLabel}
            </span>
            <span>Started {formatTime(execution.started_at)}</span>
            {execution.finished_at && (
              <span>Finished {formatTime(execution.finished_at)}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSnapshot}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            Download snapshot
          </button>
        </div>
      </div>

      {/* Cost & tokens summary */}
      {(totalTokens > 0 || totalCost > 0) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Cost & usage</h2>
          <div className="mt-3 flex flex-wrap gap-6">
            {totalTokens > 0 && (
              <div>
                <span className="text-2xl font-bold text-surface">{totalTokens.toLocaleString()}</span>
                <span className="ml-1 text-sm text-slate-500">tokens</span>
              </div>
            )}
            {totalCost > 0 && (
              <div>
                <span className="text-2xl font-bold text-emerald-600">{formatCost(totalCost)}</span>
                <span className="ml-1 text-sm text-slate-500">estimated cost</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Current step */}
      {typeof execution.current_step_index === 'number' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-amber-800">Current step</h2>
          <p className="mt-1 text-amber-900">
            Step {execution.current_step_index + 1}
            {steps[execution.current_step_index] && (
              <> · {steps[execution.current_step_index].model}</>
            )}
          </p>
        </div>
      )}

      {/* Step attempts */}
      <div className="space-y-5">
        <h2 className="font-display text-lg font-semibold text-surface">Step attempts</h2>
        {steps.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
            No steps in workflow.
          </p>
        ) : (
          <ul className="space-y-4">
            {steps.map((step, idx) => {
              const attempts = attemptsByStep[step.id] ?? []
              const last = attempts[attempts.length - 1]
              const retries = attempts.length
              const maxRetries = step.completion_criteria?.max_retries ?? 3
              const stepCost = costByStep[step.id] ?? 0

              return (
                <li
                  key={step.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-sm font-bold text-brand-700">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-slate-800">{step.model}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        Retries: {retries} / {maxRetries}
                      </span>
                      {stepCost > 0 && (
                        <span className="text-xs font-medium text-emerald-600">
                          {formatCost(stepCost)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-sm text-slate-600 line-clamp-2">{step.prompt}</p>
                    {!last && execution.status === 'running' && idx === execution.current_step_index && (
                      <p className="mt-3 text-sm text-amber-600">Running…</p>
                    )}
                    {last && (
                      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                        {last.criteria_passed === true && (
                          <p className="text-sm font-medium text-emerald-600">Criteria passed</p>
                        )}
                        {last.failure_reason && (
                          <p className="text-sm text-red-600">Failure: {last.failure_reason}</p>
                        )}
                        {last.response && (
                          <details className="group">
                            <summary className="cursor-pointer text-sm text-slate-500 transition hover:text-slate-700">
                              Last response
                            </summary>
                            <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-700 whitespace-pre-wrap break-words">
                              {last.response}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
