const API_BASE = import.meta.env.VITE_API_URL || '/api'

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || JSON.stringify(err))
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Workflows
  listWorkflows: () => request('/workflows'),
  getWorkflow: (id) => request(`/workflows/${id}`),
  createWorkflow: (body) => request('/workflows', { method: 'POST', body: JSON.stringify(body) }),
  updateWorkflow: (id, body) => request(`/workflows/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteWorkflow: (id) => request(`/workflows/${id}`, { method: 'DELETE' }),

  // Steps
  createStep: (workflowId, body) =>
    request(`/workflows/${workflowId}/steps`, { method: 'POST', body: JSON.stringify(body) }),
  updateStep: (workflowId, stepId, body) =>
    request(`/workflows/${workflowId}/steps/${stepId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteStep: (workflowId, stepId) =>
    request(`/workflows/${workflowId}/steps/${stepId}`, { method: 'DELETE' }),

  // Executions
  listExecutions: (workflowId) =>
    request(workflowId != null ? `/executions?workflow_id=${workflowId}` : '/executions'),
  getExecution: (id) => request(`/executions/${id}`),
}
