'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '@/lib/store/useToast';

const typeStyles = {
  success: 'bg-emerald-500/95',
  error: 'bg-rose-500/95',
  info: 'bg-slate-900/90',
};

export default function Toast() {
  const toasts = useToastStore((state) => state.toasts);
  const remove = useToastStore((state) => state.remove);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[10000] flex flex-col items-center gap-2 px-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            type="button"
            className={`pointer-events-auto min-w-[220px] max-w-[85vw] rounded-xl px-4 py-3 text-left text-sm text-white shadow-lg ${typeStyles[toast.type]}`}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            onClick={() => remove(toast.id)}
          >
            {toast.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
