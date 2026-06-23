'use client';
import { useRouter } from 'next/navigation';

export default function LogoutLink() {
  const router = useRouter();
  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={logout}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#9AA3B5', fontSize: 13, padding: 0, fontFamily: 'inherit'
      }}
      title="Выйти из админки"
    >
      Выйти
    </button>
  );
}
