import type { ReactNode } from 'react';

interface GameBackgroundProps {
  children?: ReactNode;
  className?: string;
}

export default function GameBackground({ children, className = '' }: GameBackgroundProps) {
  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${className}`}>
      <div className="absolute inset-0 bg-[#0a1628]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(26,52,88,0.35)_0%,_rgba(10,22,40,0)_48%)]" />
      <div className="absolute inset-x-[-8%] bottom-[30%] h-[28%] rounded-[50%] bg-[#11263d]/75 blur-[1px]" />
      <div className="absolute inset-x-[-10%] bottom-[24%] h-[24%] rounded-[45%] bg-[#0f2236]/80" />
      <div className="absolute inset-x-[-12%] bottom-[18%] h-[20%] rounded-[45%] bg-[#0b1a2b]/85" />
      <div className="absolute bottom-0 left-0 h-[30%] w-full bg-gradient-to-t from-[#07111f] via-[#081423] to-transparent" />
      <div className="absolute bottom-0 left-0 h-[46%] w-[20%] bg-[#081322]/85" style={{ clipPath: 'polygon(0 100%, 35% 25%, 70% 100%)' }} />
      <div className="absolute bottom-0 right-0 h-[52%] w-[24%] bg-[#06101d]/90" style={{ clipPath: 'polygon(35% 100%, 68% 20%, 100% 100%)' }} />

      <div className="relative z-10 min-h-screen w-full overflow-x-hidden overflow-y-auto page-safe-area supports-[height:100dvh]:min-h-[100dvh]">
        {children}
      </div>
    </div>
  );
}
