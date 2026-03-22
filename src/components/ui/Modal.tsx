'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  panelClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  unpadded?: boolean;
}

const sizeClassMap = {
  sm: 'max-w-[360px]',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-6xl',
} as const;

export default function Modal({
  open,
  title,
  onClose,
  children,
  panelClassName = '',
  size = 'sm',
  unpadded = false,
}: ModalProps) {
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
              className={`w-full ${sizeClassMap[size]} rounded-xl border border-yellow-700/50 bg-[#0d2b1a] text-white shadow-2xl ${unpadded ? '' : 'p-8'} ${panelClassName}`}
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {title ? (
                <div className={`${unpadded ? 'px-5 pt-5 sm:px-6 sm:pt-6' : 'mb-4 border-b border-yellow-800/40 pb-3'}`}>
                  <div className={`${unpadded ? 'mb-4 flex items-start justify-between border-b border-yellow-800/40 pb-4' : 'flex items-start justify-between'}`}>
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
                </div>
              ) : null}
              {children}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
