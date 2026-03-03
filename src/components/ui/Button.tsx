import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'green' | 'ghost';
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  gold: 'bg-gradient-to-r from-[#F2994A] to-[#F2C94C] text-white shadow-[0_8px_24px_rgba(242,153,74,0.35)]',
  green: 'bg-gradient-to-r from-[#27AE60] to-[#6FCF97] text-white shadow-[0_8px_24px_rgba(39,174,96,0.35)]',
  ghost: 'bg-white/20 text-white border border-white/30',
};

export default function Button({ variant = 'gold', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`h-14 min-w-40 rounded-2xl px-6 text-lg font-bold tracking-wide transition-transform duration-150 hover:brightness-105 active:scale-95 ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
