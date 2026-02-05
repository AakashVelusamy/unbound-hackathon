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
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
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

      <div>
        <label className="block text-sm font-medium text-slate-700">Max retries per step</label>
        <input
          type="number"
          min={0}
          max={10}
          value={maxRetries}
          onChange={(e) => setMaxRetries(e.target.value)}
          className="mt-1 w-24 rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
    </div>
  )
}
