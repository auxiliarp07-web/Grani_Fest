'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGuard from '../../../components/AuthGuard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function PublicBrandDetailPage({ params }) {
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('grani_fest_token');
    const user = JSON.parse(localStorage.getItem('grani_fest_user') || '{}');

    if (!token) {
      window.location.href = '/login';
      return;
    }

    if (user.role === 'brand' && user.companyId !== params.id) {
      window.location.href = '/brand';
      return;
    }

    if (user.role !== 'brand') {
      window.location.href = '/login';
      return;
    }

    const loadBrand = async () => {
      try {
        const res = await fetch(`${API_URL}/api/results/company/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo cargar la marca');
        setBrand(data.company);
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
    return <main className="min-h-screen p-8 text-center text-red-600">Marca no encontrada o no tienes acceso.</main>;
  }

  return (
    <AuthGuard allowedRoles={['brand']}>
      <main className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-700/70 bg-slate-900/80 p-8 shadow-lg shadow-blue-950/30">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-600">Marca</p>
          <h1 className="mt-3 text-4xl font-black text-slate-100">{brand.name}</h1>

          <div className="mt-8 rounded-2xl bg-slate-800/80 p-5">
            <p className="text-sm uppercase tracking-[0.2em] text-orange-600">Descripción</p>
            <p className="mt-2 text-slate-300">{brand.description || 'Esta marca aún no tiene una descripción disponible.'}</p>
          </div>

          {brand.website ? (
            <div className="mt-6 rounded-2xl bg-slate-800/80 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-orange-600">Sitio web</p>
              <a
                href={brand.website}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block break-all text-blue-400 underline hover:text-blue-300"
              >
                {brand.website}
              </a>
            </div>
          ) : null}

          <div className="mt-8 flex gap-3">
            <Link href="/brand" className="btn-primary">Volver al panel</Link>
            <Link href="/login" className="btn-secondary">Iniciar sesión</Link>
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
