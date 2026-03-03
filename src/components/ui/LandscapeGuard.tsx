'use client';

import { useEffect, useState } from 'react';

interface LandscapeGuardProps {
  children: React.ReactNode;
  disabled?: boolean;
}

type OrientationController = {
  lock?: (
    orientation:
      | 'any'
      | 'natural'
      | 'landscape'
      | 'portrait'
      | 'portrait-primary'
      | 'portrait-secondary'
      | 'landscape-primary'
      | 'landscape-secondary'
  ) => Promise<void>;
  unlock?: () => void;
};

export default function LandscapeGuard({ children, disabled = false }: LandscapeGuardProps) {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const orientation = window.screen?.orientation as unknown as OrientationController | undefined;

    if (disabled) {
      setIsPortrait(false);
      if (typeof orientation?.unlock === 'function') {
        try {
          orientation.unlock();
        } catch {
          // 部分浏览器不允许解锁，忽略即可
        }
      }
      return;
    }

    const mediaQuery = window.matchMedia('(orientation: portrait)');

    const onChange = () => {
      setIsPortrait(mediaQuery.matches);
    };

    onChange();
    if (typeof orientation?.lock === 'function') {
      void orientation.lock('landscape').catch(() => {
        // 大多数移动浏览器需要全屏或不支持锁定，失败时退回到提示层
      });
    }

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
      if (typeof orientation?.unlock === 'function') {
        try {
          orientation.unlock();
        } catch {
          // ignore
        }
      }
    };
  }, [disabled]);

  return (
    <>
      {children}
      {!disabled && isPortrait && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-black/95 p-6 text-white">
          <p className="text-center text-xl font-semibold">请将手机横屏使用</p>
          <div className="relative h-14 w-24 rounded-2xl border-2 border-white/80">
            <div className="absolute left-1/2 top-1/2 h-10 w-5 -translate-x-1/2 -translate-y-1/2 rounded-md border border-white animate-rotatePhone" />
          </div>
          <p className="text-sm text-white/65">为保证牌桌体验，当前页面仅支持横屏</p>
        </div>
      )}
    </>
  );
}
