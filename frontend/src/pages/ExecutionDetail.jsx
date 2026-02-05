import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { costForTokens, formatCost } from '../lib/cost'
import { downloadJson, executionSnapshotFilename } from '../lib/export'

const POLL_INTERVAL_MS = 1500
const TERMINAL_STATUSES = ['completed', 'failed']
const PAUSED_STATUS = 'paused'

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
  const [approveNote, setApproveNote] = useState('')
  const [approving, setApproving] = useState(false)
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
    if (TERMINAL_STATUSES.includes(execution.status) || execution.status === PAUSED_STATUS) return

    const id = setInterval(fetchExecution, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [executionId, execution?.status])

  const handleApprove = () => {
    if (!executionId) return
    setApproving(true)
    api.approveExecution(executionId, { note: approveNote || undefined })
      .then(() => fetchExecution())
      .catch((e) => setError(e.message))
      .finally(() => setApproving(false))
  }

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

  const snapshotSteps = execution.workflow_definition_snapshot?.steps
  const steps = (snapshotSteps && snapshotSteps.length > 0)
    ? snapshotSteps.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    : (workflow?.steps ?? [])
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

  const isLive = !TERMINAL_STATUSES.includes(execution.status) && execution.status !== PAUSED_STATUS
  const isPaused = execution.status === PAUSED_STATUS
  const statusLabel =
    execution.status === 'completed'
      ? 'Completed'
      : execution.status === 'failed'
        ? 'Failed'
        : execution.status === 'running'
          ? 'Running'
          : execution.status === PAUSED_STATUS
            ? 'Paused (approval required)'
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
                    : execution.status === PAUSED_STATUS
                      ? 'bg-violet-100 text-violet-800'
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
          {isPaused && (
          <div className="flex flex-wrap items-end gap-3">
            <input
              type="text"
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="Approval note (optional)"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
            >
              {approving ? 'Resuming…' : 'Approve & continue'}
            </button>
          </div>
        )}
          <button
            type="button"
            onClick={handleSnapshot}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            Download snapshot
          </button>
        </div>
      </div>

      {isPaused && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-violet-800">Waiting for approval</h2>
          <p className="mt-1 text-sm text-violet-700">This step is an approval gate. Click &quot;Approve & continue&quot; above to resume the workflow.</p>
        </div>
      )}

      {/* Execution narrative */}
      {execution.narrative && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Run summary</h2>
          <p className="mt-2 text-sm text-slate-700">{execution.narrative}</p>
        </div>
      )}

      {/* Credits used */}
      {(totalTokens > 0 || totalCost > 0) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Credits used</h2>
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
                <span className="ml-1 text-sm text-slate-500">cost</span>
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

                    {/* Retry visualization: each attempt */}
                    {attempts.length > 0 && (
                      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                        <p className="text-xs font-semibold text-slate-500">Attempts</p>
                        {attempts.map((att) => (
                          <div
                            key={att.id}
                            className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                              att.criteria_passed ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                            }`}
                          >
                            <span>{att.criteria_passed ? '✓' : '✗'}</span>
                            <span className="font-medium">Attempt {att.attempt_number}</span>
                            {att.failure_type && (
                              <span className="rounded bg-white/60 px-1.5 py-0.5 text-xs">
                                {att.failure_type}
                              </span>
                            )}
                            {att.failure_reason && (
                              <span className="text-xs opacity-90">— {att.failure_reason}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Failure explanation (deterministic) */}
                    {last && !last.criteria_passed && last.failure_reason && (
                      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-semibold text-red-800">Why it failed</p>
                        <p className="mt-1 text-sm text-red-700">
                          Step {idx + 1} failed because: {last.failure_reason}
                        </p>
                        {last.failure_type && (
                          <p className="mt-1 text-xs text-red-600">Classification: {last.failure_type}</p>
                        )}
                        {last.response && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs font-medium text-red-600">
                              Received output
                            </summary>
                            <pre className="mt-1 max-h-32 overflow-auto rounded bg-white/80 p-2 text-xs text-slate-700 whitespace-pre-wrap">
                              {last.response}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}

                    {!last && execution.status === 'running' && idx === execution.current_step_index && (
                      <p className="mt-3 text-sm text-amber-600">Running…</p>
                    )}
                    {last?.response && (
                      <details className="mt-3 group">
                        <summary className="cursor-pointer text-sm text-slate-500 transition hover:text-slate-700">
                          Last response
                        </summary>
                        <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-700 whitespace-pre-wrap break-words">
                          {last.response}
                        </pre>
                      </details>
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
