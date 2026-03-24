'use client';

import { useEffect, useState } from 'react';

interface LandscapeGuardProps {
  children: React.ReactNode;
  disabled?: boolean;
}

export default function LandscapeGuard({ children, disabled = false }: LandscapeGuardProps) {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    if (disabled) {
      setIsPortrait(false);
      return;
    }

    const mediaQuery = window.matchMedia('(orientation: portrait)');

    const onChange = () => {
      setIsPortrait(mediaQuery.matches);
    };

    onChange();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onChange);
    } else {
      mediaQuery.addListener(onChange);
    }

    window.addEventListener('resize', onChange);

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', onChange);
      } else {
        mediaQuery.removeListener(onChange);
      }
      window.removeEventListener('resize', onChange);
    };
  }, [disabled]);

  return (
    <>
      {children}
      {!disabled && isPortrait && (
        <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[9999] mx-auto max-w-sm rounded-2xl border border-[#f0c252]/30 bg-[linear-gradient(180deg,rgba(11,19,31,0.92),rgba(7,14,23,0.94))] px-4 py-3 text-white shadow-[0_18px_34px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f0c252]/15 text-lg">
              ↺
            </div>
            <div>
              <p className="text-sm font-semibold text-[#f6d46c]">已启用竖屏适配</p>
              <p className="mt-1 text-xs leading-5 text-white/72">
                现在手机横竖屏都能看。横屏更适合长牌桌，竖屏会自动改成堆叠布局。
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
