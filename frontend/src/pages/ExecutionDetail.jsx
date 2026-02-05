import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'

const POLL_INTERVAL_MS = 1500
const TERMINAL_STATUSES = ['completed', 'failed']

function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour12: false }) + ' ' + d.toLocaleDateString()
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

  if (loading && !execution) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (error && !execution) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    )
  }

  if (!execution) return null

  const steps = workflow?.steps ?? []
  const stepById = Object.fromEntries((steps || []).map((s) => [s.id, s]))
  const attemptsByStep = (execution.step_attempts ?? []).reduce((acc, a) => {
    if (!acc[a.step_id]) acc[a.step_id] = []
    acc[a.step_id].push(a)
    return acc
  }, {})

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
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to={execution.workflow_id ? `/workflows/${execution.workflow_id}` : '/'}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            ← {workflow?.name ?? 'Workflow'}
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-surface">
            Run #{execution.id}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                execution.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : execution.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isLive && (
                <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              )}
              {statusLabel}
            </span>
            Started {formatTime(execution.started_at)}
            {execution.finished_at && ` · Finished ${formatTime(execution.finished_at)}`}
          </p>
        </div>
      </div>

      {/* Progress: current step */}
      {typeof execution.current_step_index === 'number' && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">Current step</h2>
          <p className="mt-1 text-slate-600">
            Step {execution.current_step_index + 1}
            {steps[execution.current_step_index] && (
              <> · {steps[execution.current_step_index].model}</>
            )}
          </p>
        </div>
      )}

      {/* Steps with last attempt, retries, failure */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Step attempts</h2>
        {steps.length === 0 ? (
          <p className="text-slate-500">No steps in workflow.</p>
        ) : (
          steps.map((step, idx) => {
            const attempts = attemptsByStep[step.id] ?? []
            const last = attempts[attempts.length - 1]
            const retries = attempts.length

            return (
              <div
                key={step.id}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md bg-brand-100 text-xs font-semibold text-brand-700">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{step.model}</span>
                  </div>
                  {retries > 0 && (
                    <span className="text-xs text-slate-500">
                      {retries} attempt{retries !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-sm text-slate-600 line-clamp-2">{step.prompt}</p>
                  {!last && execution.status === 'running' && idx === execution.current_step_index && (
                    <p className="mt-2 text-xs text-amber-600">Running…</p>
                  )}
                  {last && (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      {last.criteria_passed === true && (
                        <p className="text-xs font-medium text-emerald-600">Criteria passed</p>
                      )}
                      {last.failure_reason && (
                        <p className="text-xs text-red-600">Failure: {last.failure_reason}</p>
                      )}
                      {last.response && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                            Last response
                          </summary>
                          <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-slate-700 whitespace-pre-wrap break-words">
                            {last.response}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
