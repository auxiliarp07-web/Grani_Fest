'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

export default function DashboardPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [voteMessage, setVoteMessage] = useState('');
  const [voteError, setVoteError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestForm, setRequestForm] = useState({
    companyName: '',
    contactName: '',
    email: '',
    website: '',
    description: ''
  });
  const [requestStatus, setRequestStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    const token = localStorage.getItem('grani_fest_token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/companies`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo cargar la lista de marcas');

        const list = data.companies || [];
        setCompanies(list);
        if (list[0]) setSelectedCompany(list[0].id);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!SITE_KEY) return;

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleVote = async () => {
    const token = localStorage.getItem('grani_fest_token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    if (!selectedCompany) {
      setVoteError('Selecciona una marca para votar.');
      return;
    }

    try {
      setSubmitting(true);
      setVoteError('');
      setVoteMessage('');

      let recaptchaToken = '';
      if (SITE_KEY && window.grecaptcha) {
        recaptchaToken = await window.grecaptcha.execute(SITE_KEY, { action: 'vote' });
      }

      if (!recaptchaToken && SITE_KEY) {
        throw new Error('No se pudo generar el token de validación.');
      }

      if (!SITE_KEY) {
        throw new Error('Falta NEXT_PUBLIC_RECAPTCHA_SITE_KEY para validar el voto.');
      }

      const res = await fetch(`${API_URL}/api/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ companyId: selectedCompany, recaptchaToken })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar tu voto');

      setVoteMessage(`Voto registrado correctamente. Hash: ${data.hash}`);
    } catch (error) {
      setVoteError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompanyRequest = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('grani_fest_token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/company-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestForm)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar la solicitud');

      setRequestStatus({
        type: 'success',
        message: 'Solicitud enviada. El administrador revisará tu empresa y decidirá si puedes participar.'
      });
      setRequestForm({ companyName: '', contactName: '', email: '', website: '', description: '' });
    } catch (error) {
      setRequestStatus({ type: 'error', message: error.message });
    }
  };

  return (
    <AuthGuard allowedRoles={['user']}>
      <main className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex items-center justify-between rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-lg shadow-blue-950/30">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-600">Panel público</p>
              <h1 className="mt-2 text-3xl font-black text-slate-100">Votar</h1>
            </div>
            <button
              className="btn-secondary"
              onClick={() => {
                localStorage.removeItem('grani_fest_token');
                localStorage.removeItem('grani_fest_user');
                window.location.href = '/login';
              }}
            >
              Salir
            </button>
          </header>

          {loading ? (
            <div className="card p-8 text-center text-slate-600">Cargando marcas...</div>
          ) : (
            <div className="mx-auto max-w-2xl rounded-3xl border border-slate-700/70 bg-slate-900/80 p-8 shadow-lg shadow-blue-950/30">
              <div className="card p-6">
                <h2 className="mb-4 text-xl font-bold text-slate-900">Emitir voto</h2>
                <label className="block text-sm font-medium text-slate-700">Marca</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3"
                >
                  {companies.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>

                <button
                  onClick={handleVote}
                  disabled={submitting || companies.length === 0}
                  className="btn-primary mt-5 w-full"
                >
                  {submitting ? 'Enviando...' : 'Votar ahora'}
                </button>

                {voteError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {voteError}
                  </div>
                )}

                {voteMessage && (
                  <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {voteMessage}
                  </div>
                )}
              </div>

              <div className="card mt-6 p-6">
                <h2 className="mb-4 text-xl font-bold text-slate-900">Solicitar participación como empresa</h2>
                <form onSubmit={handleCompanyRequest} className="space-y-3">
                  <input
                    value={requestForm.companyName}
                    onChange={(e) => setRequestForm({ ...requestForm, companyName: e.target.value })}
                    placeholder="Nombre de la empresa"
                    className="w-full rounded-xl border border-slate-200 p-3"
                    required
                  />
                  <input
                    value={requestForm.contactName}
                    onChange={(e) => setRequestForm({ ...requestForm, contactName: e.target.value })}
                    placeholder="Persona de contacto"
                    className="w-full rounded-xl border border-slate-200 p-3"
                  />
                  <input
                    value={requestForm.email}
                    onChange={(e) => setRequestForm({ ...requestForm, email: e.target.value })}
                    type="email"
                    placeholder="Correo de contacto"
                    className="w-full rounded-xl border border-slate-200 p-3"
                    required
                  />
                  <input
                    value={requestForm.website}
                    onChange={(e) => setRequestForm({ ...requestForm, website: e.target.value })}
                    placeholder="https://tuempresa.com"
                    className="w-full rounded-xl border border-slate-200 p-3"
                  />
                  <textarea
                    value={requestForm.description}
                    onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                    placeholder="Describe tu empresa y por qué quieres participar"
                    className="h-24 w-full rounded-xl border border-slate-200 p-3"
                  />
                  <button type="submit" className="btn-primary w-full">Enviar solicitud</button>

                  {requestStatus.message && (
                    <div
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        requestStatus.type === 'success'
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                    >
                      {requestStatus.message}
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </AuthGuard>
  );
}
