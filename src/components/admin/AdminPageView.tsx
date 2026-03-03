import AdminLoginCard from '@/components/admin/AdminLoginCard';
import AdminConsole, { type AdminSection } from '@/components/admin/AdminConsole';
import { isAdminAuthenticatedServer } from '@/lib/admin-auth';
import { calculateAiDecisionSummary } from '@/lib/ai-strategy';
import { ensureAdminSeedData, getAdminDashboardSnapshot } from '@/lib/admin-db';

interface AdminPageViewProps {
  adminKey: string;
  section: AdminSection;
}

export default function AdminPageView({ adminKey, section }: AdminPageViewProps) {
  ensureAdminSeedData();

  if (!isAdminAuthenticatedServer()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_18%_0%,#ffe4b4,transparent_34%),radial-gradient(circle_at_84%_100%,#ffd49b,transparent_42%),#fff7ea] px-5">
        <AdminLoginCard title="后台鉴权" subtitle="请输入管理密码后进入管理后台。" />
      </main>
    );
  }

  const initialData = getAdminDashboardSnapshot('跑得快');
  const initialPreview = calculateAiDecisionSummary(initialData.aiStrategy, {
    userWinRate: 0.48,
    userProfit: -900,
    recentBetAmount: 5000,
  });

  return (
    <AdminConsole
      adminKey={adminKey}
      section={section}
      initialData={initialData}
      initialPreview={initialPreview}
    />
  );
}
