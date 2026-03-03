'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import LandscapeGuard from '@/components/ui/LandscapeGuard';
import Toast from '@/components/ui/Toast';
import { useAuthStore } from '@/lib/store/useAuth';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const portraitAllowedRoutes = ['/lottery'];
  const disableLandscapeGuard =
    !pathname ||
    pathname.startsWith('/admin') ||
    portraitAllowedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  return (
    <LandscapeGuard disabled={disableLandscapeGuard}>
      {children}
      <Toast />
    </LandscapeGuard>
  );
}
