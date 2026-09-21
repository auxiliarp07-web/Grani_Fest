'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function AdminDashboardPage() {
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '', website: '' });
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('grani_fest_token') || '';
  });

  const fetchAdminData = async () => {
    if (!token) return; // wait until token is available

    try {
      const [companiesRes, usersRes, auditRes, requestsRes, resultsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/companies`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/admin/audit`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/admin/company-requests`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/results/public`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const companiesData = await companiesRes.json();
      const usersData = await usersRes.json();
      const auditData = await auditRes.json();
      const requestsData = await requestsRes.json();
      const resultsData = await resultsRes.json();

      setCompanies(companiesData.companies || []);
      setUsers(usersData.users || []);
      setLogs(auditData.logs || []);
      setRequests(requestsData.requests || []);
      setResults(resultsData.results || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [token]);

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/admin/companies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la marca');
      setForm({ name: '', description: '', website: '' });
      fetchAdminData();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteCompany = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/companies/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar');
      fetchAdminData();
    } catch (error) {
      alert(error.message);
    }
  };

  const updateRole = async (userId, role, companyId) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role, companyId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el rol');
      fetchAdminData();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleRequestAction = async (requestId, action) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/company-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action, adminNotes: `Aprobada por administrador` })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo procesar la solicitud');
      fetchAdminData();
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <AuthGuard allowedRoles={['admin']}>
      <main className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-7xl space-y-8">
          <header className="flex items-center justify-between rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-lg shadow-blue-950/30">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-600">Administrador</p>
              <h1 className="mt-2 text-3xl font-black text-slate-100">Panel de gestión</h1>
            </div>
            <button
              className="btn-secondary bg-slate-800 text-slate-100 hover:bg-slate-700"
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
            <div className="card p-8 text-center text-slate-600">Cargando administración...</div>
          ) : (
            <>
              <section className="grid gap-6 md:grid-cols-4">
                <div className="card p-6 bg-slate-800/90">
                  <p className="text-sm uppercase tracking-[0.2em] text-orange-400">Marcas</p>
                  <p className="mt-3 text-3xl font-black text-slate-100">{companies.length}</p>
                </div>
                <div className="card p-6 bg-slate-800/90">
                  <p className="text-sm uppercase tracking-[0.2em] text-orange-400">Usuarios</p>
                  <p className="mt-3 text-3xl font-black text-slate-100">{users.length}</p>
                </div>
                <div className="card p-6 bg-slate-800/90">
                  <p className="text-sm uppercase tracking-[0.2em] text-orange-400">Solicitudes</p>
                  <p className="mt-3 text-3xl font-black text-slate-100">{requests.filter((item) => item.status === 'pending').length}</p>
                </div>
                <div className="card p-6 bg-slate-800/90">
                  <p className="text-sm uppercase tracking-[0.2em] text-orange-400">Auditoría</p>
                  <p className="mt-3 text-3xl font-black text-slate-100">{logs.length}</p>
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-2">
                <div className="card p-6">
                  <h2 className="mb-4 text-xl font-bold text-slate-900">Registrar marca</h2>
                  <form onSubmit={handleCreateCompany} className="space-y-4">
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-3"
                      placeholder="Nombre de la marca"
                    />
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="h-24 w-full rounded-xl border border-slate-200 p-3"
                      placeholder="Descripción"
                    />
                    <input
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-3"
                      placeholder="https://sitio.com"
                    />
                    <button className="btn-primary w-full" type="submit">Guardar marca</button>
                  </form>
                </div>

                <div className="card p-6">
                  <h2 className="mb-4 text-xl font-bold text-slate-900">Marcas registradas</h2>
                  <div className="space-y-3">
                    {companies.map((company) => (
                      <div key={company.id} className="flex items-center justify-between rounded-xl border border-orange-100 bg-orange-50 p-3">
                        <div>
                          <p className="font-bold text-slate-900">{company.name}</p>
                          <p className="text-sm text-slate-600">{company.website || 'Sin sitio web'}</p>
                        </div>
                        <button onClick={() => handleDeleteCompany(company.id)} className="rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">Ranking global</h2>
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
                    Admin
                  </span>
                </div>

                <div className="mb-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Participantes</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{results.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total votos</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{results.reduce((sum, item) => sum + Number(item.votes || 0), 0)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Líder</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{results[0]?.name || '—'}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {results.map((company, index) => (
                    <div key={company.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-sm font-bold text-white">#{index + 1}</span>
                        <div>
                          <p className="font-semibold text-slate-900">{company.name}</p>
                          <p className="text-xs text-slate-500">{company.description || 'Sin descripción'}</p>
                        </div>
                      </div>
                      <span className="text-lg font-black text-orange-700">{company.votes || 0}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-2">
                <div className="card p-6">
                  <h2 className="mb-4 text-xl font-bold text-slate-900">Solicitudes de participación</h2>
                  <div className="space-y-3">
                    {requests.length === 0 ? (
                      <p className="text-sm text-slate-500">No hay solicitudes pendientes.</p>
                    ) : (
                      requests.map((request) => (
                        <div key={request.id} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{request.company_name}</p>
                              <p className="text-xs text-slate-500">{request.user_email || request.email}</p>
                            </div>
                            <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700">
                              {request.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{request.description || 'Sin descripción adicional.'}</p>
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => handleRequestAction(request.id, 'approve')}
                              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white"
                              disabled={request.status !== 'pending'}
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => handleRequestAction(request.id, 'reject')}
                              className="rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700"
                              disabled={request.status !== 'pending'}
                            >
                              Rechazar
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="card p-6">
                  <h2 className="mb-4 text-xl font-bold text-slate-900">Usuarios y roles</h2>
                  <div className="space-y-3">
                    {users.map((user) => (
                      <div key={user.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{user.name || user.email}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                          <select
                            defaultValue={user.role}
                            onChange={(e) => updateRole(user.id, e.target.value, user.company_id)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                          >
                            <option value="user">user</option>
                            <option value="brand">brand</option>
                            <option value="admin">admin</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-2">
                <div className="card p-6">
                  <h2 className="mb-4 text-xl font-bold text-slate-900">Auditoría</h2>
                  <div className="max-h-[420px] space-y-3 overflow-y-auto">
                    {logs.map((log) => (
                      <div key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-slate-800">{log.action}</span>
                          <span className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <div className="mt-2 text-slate-600">{JSON.stringify(log.details)}</div>
                        <div className="mt-2 text-[11px] font-mono text-orange-700">Hash: {log.hash}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </AuthGuard>
  );
}
