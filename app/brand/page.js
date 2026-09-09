'use client';

import { useEffect, useMemo, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import { Bar, Line } from 'react-chartjs-2';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function BrandDashboardPage() {
  const [company, setCompany] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('grani_fest_token');
    const user = JSON.parse(localStorage.getItem('grani_fest_user') || '{}');

    if (!token || user.role !== 'brand') {
      window.location.href = '/login';
      return;
    }

    const loadBrandData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/results/company/${user.companyId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to fetch brand stats');

        setCompany(data.company);
        setStats(data.stats);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadBrandData();
  }, []);

  const barData = useMemo(() => ({
    labels: ['Total votos'],
    datasets: [{
      label: company?.name || 'Marca',
      data: [stats?.total_votes || 0],
      backgroundColor: '#f97316'
    }]
  }), [company, stats]);

  const trendData = useMemo(() => ({
    labels: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'],
    datasets: [{
      label: 'Evolución',
      data: [12, 18, 24, 20, 34, 42],
      borderColor: '#f97316',
      backgroundColor: '#fdba74',
      tension: 0.4,
      fill: true
    }]
  }), []);

  return (
    <AuthGuard allowedRoles={['brand']}>
      <main className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex items-center justify-between rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-lg shadow-blue-950/30">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-600">Marca</p>
              <h1 className="mt-2 text-3xl font-black text-slate-100">Panel de {company?.name || 'marca'}</h1>
            </div>
            <button
              className="btn-secondary"
              onClick={() => {
                localStorage.removeItem('grani_fest_token');
                localStorage.removeItem('grani_fest_user');
                window.location.href = '/login';
              }}
            >
              Cerrar sesión
            </button>
          </header>

          {loading ? (
            <div className="card p-8 text-center text-slate-600">Cargando estadísticas...</div>
          ) : (
            <>
              <div className="mb-8 grid gap-6 md:grid-cols-3">
                <div className="card p-6">
                  <p className="text-sm uppercase tracking-[0.2em] text-orange-600">Votos</p>
                  <p className="mt-3 text-3xl font-black text-slate-900">{stats?.total_votes || 0}</p>
                </div>
                <div className="card p-6">
                  <p className="text-sm uppercase tracking-[0.2em] text-orange-600">Primera votación</p>
                  <p className="mt-3 text-lg font-bold text-slate-900">{stats?.first_vote ? new Date(stats.first_vote).toLocaleDateString() : '—'}</p>
                </div>
                <div className="card p-6">
                  <p className="text-sm uppercase tracking-[0.2em] text-orange-600">Última votación</p>
                  <p className="mt-3 text-lg font-bold text-slate-900">{stats?.last_vote ? new Date(stats.last_vote).toLocaleDateString() : '—'}</p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="card p-6">
                  <h2 className="mb-4 text-xl font-bold text-slate-900">Votos totales</h2>
                  <Bar data={barData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
                </div>

                <div className="card p-6">
                  <h2 className="mb-4 text-xl font-bold text-slate-900">Evolución</h2>
                  <Line data={trendData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </AuthGuard>
  );
}
