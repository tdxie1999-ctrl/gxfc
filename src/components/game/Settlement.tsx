'use client';

import { AnimatePresence, motion } from 'framer-motion';

export interface SettlementPlayer {
  id: string;
  name: string;
  avatar: string;
  roundDelta: number;
  totalScore: number;
  isWinner?: boolean;
}

interface SettlementProps {
  open: boolean;
  roomCode: string;
  gameTitle: string;
  summary?: string;
  players: SettlementPlayer[];
  onClose: () => void;
  onReplay?: () => void;
  onShare?: () => void;
}

export default function Settlement({
  open,
  roomCode,
  gameTitle,
  summary,
  players,
  onClose,
  onReplay,
  onShare,
}: SettlementProps) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70]">
          <motion.button
            type="button"
            className="absolute inset-0 h-full w-full bg-black/75"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="关闭结算"
          />

          <div className="relative z-10 flex h-full items-center justify-center p-4">
            <motion.div
              className="w-full max-w-3xl rounded-[32px] border border-[#f3d38c]/25 bg-gradient-to-br from-[#1d4d2f] via-[#103a23] to-[#0a2416] p-6 text-white shadow-2xl"
              initial={{ opacity: 0, scale: 0.92, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 18 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
            >
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.35em] text-[#f3d38c]/70">
                  {new Date().toLocaleString('zh-CN', { hour12: false })}
                </p>
                <h2 className="brand-gold-text mt-2 text-3xl font-black tracking-[0.2em]">牌局结算</h2>
                <p className="mt-2 text-sm text-white/70">游戏结果仅做娱乐用途，禁止用于赌博行为</p>
                {summary ? <p className="mt-3 text-sm text-[#f3d38c]">{summary}</p> : null}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {players.map((player) => (
                  <section
                    key={player.id}
                    className={`rounded-3xl border p-4 ${
                      player.isWinner
                        ? 'border-[#f3d38c]/50 bg-[#f3d38c]/10'
                        : 'border-white/10 bg-black/15'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-14 w-14 rounded-full border-2 border-white/20 bg-cover bg-center"
                        style={{ backgroundImage: `url(${player.avatar})` }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-bold text-white">{player.name}</p>
                        <p className="text-xs text-white/55">房间 {roomCode}</p>
                      </div>
                      {player.isWinner ? (
                        <span className="rounded-full bg-[#c0392b] px-3 py-1 text-xs font-bold text-white">
                          大赢家
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-white/5 px-3 py-3">
                        <p className="text-white/50">本局分</p>
                        <p
                          className={`mt-1 text-xl font-black ${
                            player.roundDelta >= 0 ? 'text-[#ff8f7d]' : 'text-[#7ce0a4]'
                          }`}
                        >
                          {player.roundDelta >= 0 ? '+' : ''}
                          {player.roundDelta.toFixed(1)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/5 px-3 py-3">
                        <p className="text-white/50">总分</p>
                        <p className="mt-1 text-xl font-black text-white">{player.totalScore.toFixed(1)}</p>
                      </div>
                    </div>
                  </section>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onShare}
                  className="h-12 rounded-2xl border border-white/15 bg-white/8 px-6 text-sm font-bold text-white transition hover:bg-white/12"
                >
                  分享
                </button>
                <button
                  type="button"
                  onClick={onReplay}
                  className="h-12 rounded-2xl bg-gradient-to-r from-[#F2994A] to-[#F2C94C] px-6 text-sm font-bold text-white"
                >
                  再来一局
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-12 rounded-2xl border border-white/15 bg-white/8 px-6 text-sm font-bold text-white transition hover:bg-white/12"
                >
                  关闭
                </button>
              </div>

              <p className="mt-4 text-center text-xs text-white/55">
                {gameTitle} · 房间号 {roomCode}
              </p>
            </motion.div>
          </div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
