import React from 'react'

const CRITERIA_TYPES = [
  { value: 'contains_string', label: 'Contains string' },
  { value: 'regex', label: 'Matches regex' },
  { value: 'has_code_block', label: 'Has code block' },
  { value: 'valid_json', label: 'Valid JSON' },
]

export default function CriteriaEditor({ value, onChange }) {
  const type = value?.type ?? 'contains_string'
  const config = value?.config ?? {}
  const maxRetries = value?.max_retries ?? 3

  const setType = (t) => onChange({ ...value, type: t, config: {} })
  const setConfig = (key, v) => onChange({ ...value, config: { ...config, [key]: v } })
  const setMaxRetries = (n) => onChange({ ...value, max_retries: Math.max(0, parseInt(n, 10) || 0) })

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 shadow-sm">
      <div>
        <label className="block text-sm font-medium text-slate-700">Criteria type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {CRITERIA_TYPES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {type === 'contains_string' && (
        <div>
          <label className="block text-sm font-medium text-slate-700">String to contain</label>
          <input
            type="text"
            value={config.value ?? ''}
            onChange={(e) => setConfig('value', e.target.value)}
            placeholder="e.g. SUCCESS"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      )}

      {type === 'regex' && (
        <div>
          <label className="block text-sm font-medium text-slate-700">Regex pattern</label>
          <input
            type="text"
            value={config.pattern ?? ''}
            onChange={(e) => setConfig('pattern', e.target.value)}
            placeholder="e.g. \\d{3}-\\d{4}"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      )}

      {type === 'has_code_block' && (
        <div>
          <label className="block text-sm font-medium text-slate-700">Language (optional)</label>
          <input
            type="text"
            value={config.language ?? ''}
            onChange={(e) => setConfig('language', e.target.value)}
            placeholder="e.g. python"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Retry budget</h3>
        <p className="mt-0.5 text-xs text-slate-500">Max retries per step before failing</p>
        <div className="mt-3 flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={10}
            value={maxRetries}
            onChange={(e) => setMaxRetries(e.target.value)}
            className="h-2 w-32 flex-1 max-w-[12rem] cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500"
          />
          <input
            type="number"
            min={0}
            max={10}
            value={maxRetries}
            onChange={(e) => setMaxRetries(e.target.value)}
            className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm font-medium focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>
    </div>
  )
}
