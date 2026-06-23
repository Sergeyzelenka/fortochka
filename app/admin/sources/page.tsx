import SourcesAdmin from '@/components/SourcesAdmin';
import { sb, isMock } from '@/lib/db';

export const dynamic = 'force-dynamic';

export interface SourceRow {
  id: number;
  name: string;
  rss_url: string;
  default_category: number | null;
  enabled: boolean;
  last_fetched_at: string | null;
}

export default async function SourcesPage() {
  let sources: SourceRow[] = [];
  if (!isMock) {
    const { data } = await sb().from('sources').select('*').order('id', { ascending: true });
    sources = (data as SourceRow[]) ?? [];
  }
  return <SourcesAdmin initial={sources} mock={isMock} />;
}
