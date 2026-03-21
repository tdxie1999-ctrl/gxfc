'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  panelClassName?: string;
}

export default function Modal({ open, title, onClose, children, panelClassName = '' }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            onClick={onClose}
            className="absolute inset-0 h-full w-full bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="关闭弹窗"
          />

          <div className="relative z-10 flex h-full items-center justify-center p-4">
            <motion.div
              className={`w-full max-w-[360px] rounded-xl border border-yellow-700/50 bg-[#0d2b1a] p-8 text-white shadow-2xl ${panelClassName}`}
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <div className="mb-4 flex items-start justify-between border-b border-yellow-800/40 pb-3">
                <h3 className="text-lg font-bold text-yellow-300">{title}</h3>
                <button
                  type="button"
                  className="-mr-2 rounded-full p-2 text-gray-400 transition-colors hover:text-yellow-300"
                  onClick={onClose}
                  aria-label="关闭"
                >
                  ✕
                </button>
              </div>
              {children}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
