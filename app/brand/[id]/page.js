'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function PublicBrandDetailPage({ params }) {
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBrand = async () => {
      try {
        const res = await fetch(`${API_URL}/api/results/public`);
        const data = await res.json();
        const selected = (data.results || []).find((item) => item.id === params.id) || null;
        setBrand(selected);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadBrand();
  }, [params.id]);

  if (loading) {
    return <main className="min-h-screen p-8 text-center text-slate-600">Cargando marca...</main>;
  }

  if (!brand) {
    return <main className="min-h-screen p-8 text-center text-red-600">Marca no encontrada.</main>;
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-700/70 bg-slate-900/80 p-8 shadow-lg shadow-blue-950/30">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-600">Marca</p>
        <h1 className="mt-3 text-4xl font-black text-slate-100">{brand.name}</h1>
        <p className="mt-3 text-lg text-slate-300">Total actual de votos: <span className="font-bold text-orange-700">{brand.votes}</span></p>

        <div className="mt-8 rounded-2xl bg-slate-800/80 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-orange-600">Resumen</p>
          <p className="mt-2 text-slate-300">Esta marca cuenta con una participación activa en Grani Fest y está dentro del ranking público de votación.</p>
        </div>

        <div className="mt-8 flex gap-3">
          <Link href="/dashboard" className="btn-primary">Volver al ranking</Link>
          <Link href="/login" className="btn-secondary">Iniciar sesión</Link>
        </div>
      </div>
    </main>
  );
}
