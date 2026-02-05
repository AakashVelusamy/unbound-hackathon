export function downloadJson(filename, data) {
  const str = JSON.stringify(data, null, 2)
  const blob = new Blob([str], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function workflowExportFilename(name) {
  const safe = (name || 'workflow').replace(/[^a-zA-Z0-9-_]/g, '-')
  return `${safe}-workflow.json`
}

export function executionSnapshotFilename(executionId) {
  return `execution-${executionId}-snapshot.json`
}
