import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'gold' | 'green' | 'ghost';
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-yellow-600 text-black font-bold hover:bg-yellow-500',
  secondary: 'border border-yellow-700/50 bg-transparent text-yellow-400 hover:border-yellow-500',
  danger: 'border border-red-500/50 bg-red-900/50 text-red-300 hover:bg-red-800/50',
  gold: 'bg-yellow-600 text-black font-bold hover:bg-yellow-500',
  green: 'border border-yellow-700/50 bg-transparent text-yellow-400 hover:border-yellow-500',
  ghost: 'border border-yellow-700/50 bg-transparent text-yellow-400 hover:border-yellow-500',
};

export default function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`h-14 min-w-40 rounded-2xl px-6 text-lg font-bold tracking-wide transition-all duration-150 active:scale-95 ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
