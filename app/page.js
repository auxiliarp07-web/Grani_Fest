const companies = [
  { id: '1', name: 'Burger Crew', votes: 1280 },
  { id: '2', name: 'Flame Grill', votes: 980 },
  { id: '3', name: 'Urban Bite', votes: 760 }
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <section className="grid gap-6 md:grid-cols-3">
          {companies.map((company) => (
            <article key={company.id} className="card p-6">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-orange-700">
                  Marca
                </span>
                <span className="text-2xl font-black text-brand-600">{company.votes}</span>
              </div>
              <h2 className="mt-5 text-2xl font-bold text-slate-900">{company.name}</h2>
              <p className="mt-3 text-sm text-slate-600">Votación pública con autenticación segura, control por usuario único y trazabilidad auditada.</p>
              <div className="mt-6 flex gap-3">
                <a href={`/brand/${company.id}`} className="btn-secondary flex-1 text-center">Detalle</a>
                <a href="/login" className="btn-primary flex-1 text-center">Votar</a>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
