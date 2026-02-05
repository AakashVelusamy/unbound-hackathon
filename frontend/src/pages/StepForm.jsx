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
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (error && !workflow) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-surface">
        {isEdit ? 'Edit step' : 'Add step'}
      </h1>
      <p className="mt-1 text-slate-500">Workflow: {workflow?.name}</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {immutable && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This workflow has runs. Steps can’t be added or edited.
          </div>
        )}
        {error && !immutable && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
            className="mt-1 w-24 rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            disabled={immutable}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? 'Saving…' : isEdit ? 'Save' : 'Add step'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/workflows/${workflowId}`)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
