import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'

export default function WorkflowForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [immutable, setImmutable] = useState(false)

  useEffect(() => {
    if (isEdit) {
      api
        .getWorkflow(id)
        .then((w) => setName(w.name))
        .catch((e) => setError(e.message))
    }
  }, [id, isEdit])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    const promise = isEdit ? api.updateWorkflow(id, { name: name.trim() }) : api.createWorkflow({ name: name.trim() })
    promise
      .then((w) => navigate(`/workflows/${w.id}`))
      .catch((e) => {
        if (e.message?.includes('immutable') || e.message?.includes('executions')) {
          setImmutable(true)
        }
        setError(e.message)
      })
      .finally(() => setLoading(false))
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="font-display text-3xl font-bold tracking-tight text-surface">
        {isEdit ? 'Edit workflow' : 'New workflow'}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        {immutable && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
            This workflow has runs. It can’t be edited. Create a new workflow to change the definition.
          </div>
        )}
        {error && !immutable && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My workflow"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-0"
            disabled={immutable}
          />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || immutable}
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            {loading ? 'Saving…' : isEdit ? 'Save' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/workflows/${id}` : '/')}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
