'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Brand from '@/components/Brand';

function AdminLoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/admin';

  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      if (res.ok) {
        router.push(next);
        router.refresh();
      } else {
        setErr('Неверный ключ. Попробуй ещё раз.');
      }
    } catch (e: any) {
      setErr(e.message ?? 'Ошибка сети');
    }
    setBusy(false);
  }

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-login-brand"><Brand size={28} /></div>
        <h1>Вход в редакцию</h1>
        <p className="admin-login-hint">Доступ только для главного редактора.</p>
        <input
          type="password"
          placeholder="Ключ доступа"
          value={key}
          onChange={e => setKey(e.target.value)}
          autoFocus
          autoComplete="current-password"
        />
        <button type="submit" className="abtn ok" disabled={busy || !key}>
          {busy ? 'Проверяю…' : 'Войти'}
        </button>
        {err && <p className="admin-login-err">{err}</p>}
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}
