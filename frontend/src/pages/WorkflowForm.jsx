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
    <div className="max-w-xl">
      <h1 className="font-display text-2xl font-bold text-surface">
        {isEdit ? 'Edit workflow' : 'New workflow'}
      </h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {immutable && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This workflow has runs. It can’t be edited. Create a new workflow to change the definition.
          </div>
        )}
        {error && !immutable && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            disabled={immutable}
          />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || immutable}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? 'Saving…' : isEdit ? 'Save' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/workflows/${id}` : '/')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
