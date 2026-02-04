import { useState } from 'react'

function App() {
    const [count, setCount] = useState(0)

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
            <h1 className="text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                Unbound Hackathon
            </h1>

            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 backdrop-blur-sm">
                <p className="text-lg mb-6 text-slate-300">
                    Frontend is ready to go!
                </p>

                <button
                    onClick={() => setCount((count) => count + 1)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 transition-colors rounded-xl font-semibold shadow-lg shadow-blue-900/40"
                >
                    Count is {count}
                </button>
            </div>

            <p className="mt-8 text-slate-500 text-sm">
                Edit <code className="text-blue-400">src/App.jsx</code> to start building
            </p>
        </div>
    )
}

export default App
