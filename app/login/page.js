'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) {
      setError('Falta NEXT_PUBLIC_GOOGLE_CLIENT_ID en .env');
      return;
    }

    const initializeGoogle = () => {
      if (!window.google?.accounts?.id) return;
      if (window.__granifest_google_initialized) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          setLoading(true);
          setError('');

          try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential })
            });

            const data = await res.json();
            if (!res.ok || !data.token) {
              throw new Error(data.error || 'Error al iniciar sesión');
            }

            localStorage.setItem('grani_fest_token', data.token);
            localStorage.setItem('grani_fest_user', JSON.stringify(data.user));

            const role = data.user.role;
            if (role === 'admin') window.location.href = '/admin';
            else if (role === 'brand') window.location.href = '/brand';
            else window.location.href = '/dashboard';
          } catch (err) {
            setError(err.message);
          } finally {
            setLoading(false);
          }
        }
      });

      window.__granifest_google_initialized = true;

      const button = document.getElementById('google-signin');
      if (button) {
        window.google.accounts.id.renderButton(button, {
          theme: 'outline',
          size: 'large',
          width: 340,
          text: 'continue_with'
        });
      }
    };

    if (window.google?.accounts?.id) {
      initializeGoogle();
      return;
    }

    const existingScript = document.getElementById('gsi-script');
    if (existingScript) {
      existingScript.addEventListener('load', initializeGoogle, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    document.body.appendChild(script);

    return () => {
      const currentScript = document.getElementById('gsi-script');
      if (currentScript && currentScript.parentNode) {
        currentScript.parentNode.removeChild(currentScript);
      }
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 py-12">
      <div className="card w-full p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-600">Grani Fest</p>
        <h1 className="mt-3 text-3xl font-black text-slate-100">Inicia sesión</h1>
        <p className="mt-2 text-sm text-slate-300">Accede con Google para votar, gestionar marcas o revisar resultados.</p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <div id="google-signin" className="min-h-[44px]" />
        </div>

        {loading && <p className="mt-4 text-center text-sm text-slate-500">Autenticando...</p>}
      </div>
    </main>
  );
}
