import { notFound } from 'next/navigation';
import AdminPageView from '@/components/admin/AdminPageView';
import { ADMIN_ENTRY_KEY } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default function AdminDashboardPage({ params }: { params: { key: string } }) {
  if (params.key !== ADMIN_ENTRY_KEY) {
    notFound();
  }

  return <AdminPageView adminKey={params.key} section="overview" />;
}
