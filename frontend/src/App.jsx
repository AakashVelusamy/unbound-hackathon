import { Routes, Route, NavLink } from 'react-router-dom'
import WorkflowList from './pages/WorkflowList'
import WorkflowDetail from './pages/WorkflowDetail'
import WorkflowForm from './pages/WorkflowForm'
import StepForm from './pages/StepForm'
import ExecutionDetail from './pages/ExecutionDetail'

function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <NavLink
            to="/"
            className="font-display text-xl font-bold tracking-tight text-surface"
          >
            Agentic Workflow Builder
          </NavLink>
          <nav className="flex gap-6">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-sm font-medium transition ${isActive ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'}`
              }
            >
              Workflows
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route path="/" element={<WorkflowList />} />
          <Route path="/workflows/new" element={<WorkflowForm />} />
          <Route path="/workflows/:id" element={<WorkflowDetail />} />
          <Route path="/workflows/:id/edit" element={<WorkflowForm />} />
          <Route path="/workflows/:id/steps/new" element={<StepForm />} />
          <Route path="/workflows/:id/steps/:stepId/edit" element={<StepForm />} />
          <Route path="/executions/:id" element={<ExecutionDetail />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
