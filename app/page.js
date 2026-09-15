export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-lg shadow-blue-950/30">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-600">Grani Fest</p>
            <h1 className="mt-2 text-4xl font-black text-slate-100">Grani Fest</h1>
          </div>
          <div className="flex gap-3">
            <a href="/login" className="btn-secondary">Iniciar sesión</a>
            <a href="/dashboard" className="btn-primary">Ver panel</a>
          </div>
        </header>
      </div>
    </main>
  );
}
