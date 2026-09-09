'use client';

import { useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function decodeJwtRole(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const bytes = atob(padded);
    const json = decodeURIComponent(
      Array.from(bytes, (char) => `%${('00' + char.charCodeAt(0).toString(16)).slice(-2)}`).join('')
    );
    return JSON.parse(json).role || null;
  } catch {
    return null;
  }
}

export default function AuthGuard({ allowedRoles = [], children, redirectTo = '/login' }) {
  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      const token = localStorage.getItem('grani_fest_token');

      if (!token) {
        localStorage.removeItem('grani_fest_token');
        localStorage.removeItem('grani_fest_user');
        window.location.href = redirectTo;
        return;
      }

      // Prefer server-validated role so promotions/changes take effect immediately
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          // fallback to local token decode
          const jwtRole = decodeJwtRole(token);
          if (!jwtRole) {
            localStorage.removeItem('grani_fest_token');
            localStorage.removeItem('grani_fest_user');
            window.location.href = redirectTo;
            return;
          }

          if (allowedRoles.length > 0 && !allowedRoles.includes(jwtRole)) {
            if (jwtRole === 'admin') {
              window.location.href = '/admin';
              return;
            }
            if (jwtRole === 'brand') {
              window.location.href = '/brand';
              return;
            }
            window.location.href = '/dashboard';
          }

          return;
        }

        const data = await res.json();
        if (cancelled) return;

        const serverRole = data?.user?.role;
        if (!serverRole) {
          localStorage.removeItem('grani_fest_token');
          localStorage.removeItem('grani_fest_user');
          window.location.href = redirectTo;
          return;
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(serverRole)) {
          if (serverRole === 'admin') {
            window.location.href = '/admin';
            return;
          }
          if (serverRole === 'brand') {
            window.location.href = '/brand';
            return;
          }
          window.location.href = '/dashboard';
        }
      } catch (err) {
        // on network error fallback to token decode
        const fallbackRole = decodeJwtRole(localStorage.getItem('grani_fest_token') || '');
        if (!fallbackRole) {
          localStorage.removeItem('grani_fest_token');
          localStorage.removeItem('grani_fest_user');
          window.location.href = redirectTo;
          return;
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(fallbackRole)) {
          if (fallbackRole === 'admin') {
            window.location.href = '/admin';
            return;
          }
          if (fallbackRole === 'brand') {
            window.location.href = '/brand';
            return;
          }
          window.location.href = '/dashboard';
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [allowedRoles, redirectTo]);

  return children;
}
