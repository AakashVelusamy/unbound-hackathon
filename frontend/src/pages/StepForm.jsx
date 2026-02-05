import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import CriteriaEditor from '../components/CriteriaEditor'

const MODELS = [
  { value: 'kimi-k2p5', label: 'Kimi K2 5' },
  { value: 'kimi-k2-instruct-0905', label: 'Kimi K2 Instruct 0905' },
]

const CONTEXT_STRATEGIES = [
  { value: 'full', label: 'Full output' },
  { value: 'truncate_chars', label: 'Truncate (first 4k chars)' },
]

export default function StepForm() {
  const { id: workflowId, stepId } = useParams()
  const isEdit = Boolean(stepId)
  const navigate = useNavigate()
  const [workflow, setWorkflow] = useState(null)
  const [orderIndex, setOrderIndex] = useState(0)
  const [model, setModel] = useState(MODELS[0].value)
  const [prompt, setPrompt] = useState('')
  const [completionCriteria, setCompletionCriteria] = useState({ type: 'contains_string', config: { value: '' }, max_retries: 3 })
  const [contextStrategy, setContextStrategy] = useState('full')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [immutable, setImmutable] = useState(false)

  useEffect(() => {
    api
      .getWorkflow(workflowId)
      .then((w) => {
        setWorkflow(w)
        if (!isEdit) setOrderIndex(w.steps?.length ?? 0)
      })
      .catch((e) => setError(e.message))
  }, [workflowId, isEdit])

  useEffect(() => {
    if (isEdit && workflow?.steps) {
      const step = workflow.steps.find((s) => String(s.id) === stepId)
      if (step) {
        setOrderIndex(step.order_index)
        setModel(step.model)
        setPrompt(step.prompt)
        setCompletionCriteria(step.completion_criteria ?? { type: 'contains_string', config: {}, max_retries: 3 })
        setContextStrategy(step.context_strategy ?? 'full')
      }
    }
  }, [workflow, stepId, isEdit])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!prompt.trim()) return
    const criteria = {
      type: completionCriteria.type,
      config: completionCriteria.config ?? {},
    }
    if (completionCriteria.max_retries != null) criteria.max_retries = completionCriteria.max_retries

    setLoading(true)
    setError(null)
    const body = {
      order_index: orderIndex,
      model,
      prompt: prompt.trim(),
      completion_criteria: criteria,
      context_strategy: contextStrategy,
    }
    const promise = isEdit
      ? api.updateStep(workflowId, stepId, body)
      : api.createStep(workflowId, body)
    promise
      .then(() => navigate(`/workflows/${workflowId}`))
      .catch((e) => {
        if (e.message?.includes('immutable') || e.message?.includes('executions')) setImmutable(true)
        setError(e.message)
      })
      .finally(() => setLoading(false))
  }

  if (!workflow && !error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (error && !workflow) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 shadow-sm">{error}</div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-bold tracking-tight text-surface">
        {isEdit ? 'Edit step' : 'Add step'}
      </h1>
      <p className="text-slate-500">Workflow: {workflow?.name}</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        {immutable && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
            This workflow has runs. Steps can’t be added or edited.
          </div>
        )}
        {error && !immutable && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700">Order</label>
          <input
            type="number"
            min={0}
            value={orderIndex}
            onChange={(e) => setOrderIndex(parseInt(e.target.value, 10) || 0)}
            className="mt-2 w-24 rounded-xl border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            disabled={immutable}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            disabled={immutable}
          >
            {MODELS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder="What should the LLM do in this step?"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            disabled={immutable}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Completion criteria</label>
          <CriteriaEditor value={completionCriteria} onChange={setCompletionCriteria} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Context for next step</label>
          <select
            value={contextStrategy}
            onChange={(e) => setContextStrategy(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            disabled={immutable}
          >
            {CONTEXT_STRATEGIES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || immutable}
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            {loading ? 'Saving…' : isEdit ? 'Save' : 'Add step'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/workflows/${workflowId}`)}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
