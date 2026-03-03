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
      <div className="rounded-2xl border border-white/15 bg-black/25 p-3 text-center text-sm text-white/60 backdrop-blur-sm">
        当前没有可执行操作
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/15 bg-black/25 p-3 backdrop-blur-sm">
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className={clsx(
            'min-w-24 rounded-xl px-4 py-2 text-sm font-semibold transition',
            action.variant === 'danger' && 'bg-[#c0392b] text-white hover:bg-[#a93226]',
            action.variant === 'secondary' && 'bg-white/10 text-white hover:bg-white/20',
            (!action.variant || action.variant === 'primary') &&
              'bg-gradient-to-r from-[#D4A017] to-[#b8880a] text-[#2c1b04] hover:brightness-105',
            action.disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
