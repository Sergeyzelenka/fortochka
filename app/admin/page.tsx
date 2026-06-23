import AdminQueue from '@/components/AdminQueue';
import { getPending } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // Авторизация уже проверена middleware — если мы здесь, у пользователя валидный cookie.
  const pending = await getPending();
  return <AdminQueue initial={pending} />;
}
