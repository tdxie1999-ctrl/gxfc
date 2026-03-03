'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import GameBackground from '@/components/layout/GameBackground';
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
    <GameBackground>
      <div className="relative flex h-full w-full flex-col items-center justify-center text-center">
        <p className="absolute right-5 top-4 text-xs text-white/85">v1.0.1</p>

        <motion.h1
          className="brand-gold-text font-display text-[48px] font-black tracking-[0.55rem] sm:text-[64px]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          恭喜发财
        </motion.h1>

        <motion.p
          className="subtitle-outline mt-4 text-lg tracking-[0.3rem] text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          财运当头 好牌在手
        </motion.p>

        <div className="mt-8 flex items-center gap-3" aria-label="加载中">
          <span className="h-2.5 w-2.5 rounded-full bg-white/90 animate-pulseDot [animation-delay:0ms]" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/90 animate-pulseDot [animation-delay:150ms]" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/90 animate-pulseDot [animation-delay:300ms]" />
        </div>
      </div>
    </GameBackground>
  );
}
