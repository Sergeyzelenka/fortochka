import AdminQueue from '@/components/AdminQueue';
import { getPending } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function AdminPage() {
  // Авторизация уже проверена middleware — если мы здесь, у пользователя валидный cookie.
  let pending: Awaited<ReturnType<typeof getPending>> = [];
  try {
    pending = await getPending();
  } catch (e) {
    console.error('admin getPending failed', e);
  }
  return <AdminQueue initial={pending} />;
}
