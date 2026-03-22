import clsx from 'clsx';

export interface GameActionItem {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface GameActionsProps {
  actions: GameActionItem[];
}

export default function GameActions({ actions }: GameActionsProps) {
  if (actions.length === 0) {
    return (
      <div className="rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.22))] p-4 text-center text-sm text-white/60 backdrop-blur-sm">
        当前没有可执行操作
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.24))] p-4 backdrop-blur-sm sm:grid-cols-3">
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className={clsx(
            'h-14 rounded-2xl px-4 text-base font-bold transition',
            action.variant === 'danger' && 'bg-[#c0392b] text-white hover:bg-[#a93226]',
            action.variant === 'secondary' && 'border border-white/10 bg-white/8 text-white hover:bg-white/12',
            (!action.variant || action.variant === 'primary') &&
              'bg-gradient-to-r from-[#efc75a] to-[#c39218] text-[#2c1b04] shadow-[0_16px_30px_rgba(212,160,23,0.18)] hover:brightness-105',
            action.disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
