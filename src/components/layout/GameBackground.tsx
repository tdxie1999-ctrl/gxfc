import type { ReactNode } from 'react';

interface GameBackgroundProps {
  children?: ReactNode;
  className?: string;
}

export default function GameBackground({ children, className = '' }: GameBackgroundProps) {
  return (
    <div className={`relative min-h-screen w-screen overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-[#87CEEB] via-[#B0D4F1] to-[#1a6b3c]" />

      <div className="absolute inset-x-[-8%] bottom-[30%] h-[28%] rounded-[50%] bg-[#2d5a3f]/75 blur-[1px]" />
      <div className="absolute inset-x-[-10%] bottom-[25%] h-[24%] rounded-[45%] bg-[#3d7a5f]/65" />
      <div className="absolute inset-x-[-12%] bottom-[20%] h-[20%] rounded-[45%] bg-[#4d9a7f]/55" />

      <div className="absolute bottom-0 left-0 h-[26%] w-full bg-gradient-to-t from-[#0d4a2a]/80 via-[#0d4a2a]/20 to-transparent" />
      <div className="absolute bottom-[6%] left-[-10%] h-[16%] w-[120%] bg-gradient-to-r from-white/0 via-white/25 to-white/0 blur-xl animate-shimmerWater" />

      <div className="absolute bottom-0 left-0 h-[46%] w-[20%] bg-[#103b25]/70" style={{ clipPath: 'polygon(0 100%, 35% 25%, 70% 100%)' }} />
      <div className="absolute bottom-0 right-0 h-[52%] w-[24%] bg-[#0f341f]/70" style={{ clipPath: 'polygon(35% 100%, 68% 20%, 100% 100%)' }} />

      <div className="absolute left-[10%] top-[12%] h-10 w-28 rounded-full bg-white/60 blur-sm animate-floatCloud" />
      <div className="absolute right-[15%] top-[18%] h-8 w-20 rounded-full bg-white/55 blur-sm animate-floatCloud" />

      <div className="relative z-10 page-safe-area h-screen w-screen">{children}</div>
    </div>
  );
}
