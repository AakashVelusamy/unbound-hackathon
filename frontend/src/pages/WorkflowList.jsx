import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

export default function WorkflowList() {
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .listWorkflows()
      .then(setWorkflows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 shadow-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-surface">
          Workflows
        </h1>
        <Link
          to="/workflows/new"
          className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-600 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          + New workflow
        </Link>
      </div>

      {workflows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-14 text-center shadow-sm">
          <p className="text-slate-500">No workflows yet.</p>
          <Link
            to="/workflows/new"
            className="mt-5 inline-block rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-600"
          >
            Create your first workflow →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((w) => (
            <li key={w.id}>
              <Link
                to={`/workflows/${w.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:border-brand-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
              >
                <h2 className="font-display text-lg font-semibold text-surface">
                  {w.name}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {w.step_count} step{w.step_count !== 1 ? 's' : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
