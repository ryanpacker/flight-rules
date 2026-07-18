import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Board,
})

function Board() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
      <h1 className="text-4xl font-semibold tracking-tight">Flight Rules</h1>
      <p className="text-slate-400">
        The board goes here. Phase 1 is on approach.
      </p>
    </main>
  )
}
