'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session) {
        router.replace('/lobby');
        return;
      }

      timer = setTimeout(() => {
        router.replace('/login');
      }, 2500);
    };

    void boot();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#0a1f0d] to-[#1a3a20] text-center text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(60,110,56,0.2)_0%,_rgba(10,31,13,0)_45%)]" />
      <div className="absolute inset-x-[-10%] bottom-[18%] h-[24%] rounded-[50%] bg-[#15311b]/80" />
      <div className="absolute inset-x-[-12%] bottom-[10%] h-[18%] rounded-[50%] bg-[#0d2413]/90" />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center px-6">
        <p className="absolute right-0 top-[-120px] text-xs text-yellow-200/70">v1.0.1</p>

        <motion.h1
          className="text-5xl font-black tracking-[0.45rem] text-yellow-400 drop-shadow-lg sm:text-6xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          恭喜发财
        </motion.h1>

        <motion.p
          className="mt-3 text-lg tracking-[0.22rem] text-yellow-200/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          财运当头 好牌在手
        </motion.p>

        <div className="mt-10 w-full max-w-md overflow-hidden rounded-full border border-yellow-700/40 bg-black/30">
          <motion.div
            className="h-1.5 bg-gradient-to-r from-yellow-700 via-yellow-500 to-yellow-300"
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 2, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </div>
  );
}
