'use client';

import { useEffect, useMemo, useState } from 'react';

export type TableSeatPosition = 'bottom' | 'left' | 'top' | 'right';

export interface TableSeatItem {
  id: string;
  name: string;
  avatar: string;
  score: number;
  handCount: number;
  position: TableSeatPosition;
  isOnline: boolean;
  isReady: boolean;
  isCurrent?: boolean;
  isDealer?: boolean;
  isBot?: boolean;
}

export interface TableScoreRow {
  id: string;
  playerName: string;
  historyScore: number;
  roundScore: number;
  extraLabel: string;
  extraValue: string;
  totalScore: number;
  isCurrent?: boolean;
}

interface TableLayoutProps {
  roomCode: string;
  roundNumber: number;
  gameTitle: string;
  modeLabel: string;
  rules: string[];
  deckLabel?: string;
  statusText: string;
  seats: TableSeatItem[];
  scoreRows: TableScoreRow[];
  centerContent: React.ReactNode;
  handArea: React.ReactNode;
  actionArea: React.ReactNode;
  onExit: () => void;
  onVoice: () => void;
  onChat: () => void;
  onHelp: () => void;
  onSettings: () => void;
}

function seatPositionClass(position: TableSeatPosition) {
  switch (position) {
    case 'bottom':
      return 'bottom-4 left-1/2 w-[260px] -translate-x-1/2';
    case 'left':
      return 'left-4 top-1/2 w-[220px] -translate-y-1/2';
    case 'top':
      return 'left-1/2 top-4 w-[240px] -translate-x-1/2';
    case 'right':
      return 'right-4 top-1/2 w-[220px] -translate-y-1/2';
    default:
      return '';
  }
}

function TableSeat({ seat }: { seat: TableSeatItem }) {
  return (
    <div
      className={`absolute rounded-3xl border p-3 backdrop-blur-sm ${
        seat.isCurrent ? 'border-[#f3d38c]/50 bg-[#f3d38c]/10' : 'border-white/12 bg-black/28'
      } ${seatPositionClass(seat.position)}`}
    >
      <div className="flex items-center gap-3">
        <div
          className="relative h-12 w-12 shrink-0 rounded-full border-2 border-white/20 bg-cover bg-center"
          style={{ backgroundImage: `url(${seat.avatar})` }}
        >
          <span
            className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#124026] ${
              seat.isOnline ? 'bg-emerald-400' : 'bg-slate-400'
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-white">{seat.name}</p>
            {seat.isDealer ? (
              <span className="rounded-full bg-[#c0392b] px-2 py-0.5 text-[10px] font-bold text-white">庄</span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-white/60">
            <span>{seat.isBot ? 'AI' : '玩家'}</span>
            <span>手牌 {seat.handCount}</span>
            <span>{seat.isReady ? '已准备' : '等待中'}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-white/50">当前积分</span>
        <span className="text-lg font-black text-[#f3d38c]">{seat.score.toFixed(1)}</span>
      </div>
    </div>
  );
}

export default function TableLayout({
  roomCode,
  roundNumber,
  gameTitle,
  modeLabel,
  rules,
  deckLabel,
  statusText,
  seats,
  scoreRows,
  centerContent,
  handArea,
  actionArea,
  onExit,
  onVoice,
  onChat,
  onHelp,
  onSettings,
}: TableLayoutProps) {
  const [scoreOpen, setScoreOpen] = useState(true);
  const [timeLabel, setTimeLabel] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setTimeLabel(
        new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    };

    updateTime();
    const timer = window.setInterval(updateTime, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const visibleRows = useMemo(() => scoreRows.slice(0, 4), [scoreRows]);

  return (
    <main className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-4 text-white md:px-6">
      <header className="rounded-3xl border border-white/10 bg-black/28 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.22)] backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-white/85">
          <div className="flex flex-wrap items-center gap-3">
            <span>信号 满格</span>
            <span>电量 80%</span>
            <span>房间号：{roomCode}</span>
            <span>第{roundNumber}局</span>
            <span>{timeLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onSettings} className="rounded-2xl bg-white/10 px-3 py-2">
              设置
            </button>
            <button type="button" onClick={onHelp} className="rounded-2xl bg-white/10 px-3 py-2">
              帮助
            </button>
          </div>
        </div>
      </header>

      <section className="mt-3 overflow-hidden rounded-3xl border border-white/10 bg-black/24 backdrop-blur-sm">
        {scoreOpen ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm text-white/85">
              <thead className="bg-white/8 text-xs uppercase tracking-[0.24em] text-white/55">
                <tr>
                  <th className="px-3 py-2">玩家</th>
                  <th className="px-3 py-2">历史总分</th>
                  <th className="px-3 py-2">本局分</th>
                  <th className="px-3 py-2">其他</th>
                  <th className="px-3 py-2">总分</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className={row.isCurrent ? 'bg-[#f3d38c]/10' : 'border-t border-white/8'}>
                    <td className="px-3 py-2 font-semibold">{row.playerName}</td>
                    <td className="px-3 py-2">{row.historyScore.toFixed(1)}</td>
                    <td className="px-3 py-2">
                      {row.roundScore >= 0 ? '+' : ''}
                      {row.roundScore.toFixed(1)}
                    </td>
                    <td className="px-3 py-2">
                      {row.extraLabel} {row.extraValue}
                    </td>
                    <td className="px-3 py-2 font-bold text-[#f3d38c]">{row.totalScore.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setScoreOpen((current) => !current)}
          className="flex w-full items-center justify-center gap-2 border-t border-white/8 bg-white/5 px-3 py-2 text-xs text-white/70"
        >
          <span>{scoreOpen ? '▽ 收起' : '△ 展开'}</span>
        </button>
      </section>

      <section className="mt-4 grid flex-1 gap-4 lg:grid-cols-[250px_1fr_92px]">
        <aside className="rounded-3xl border border-white/10 bg-black/22 p-4 backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.25em] text-white/50">本桌规则</p>
          <div className="mt-3 space-y-2 text-sm text-white/85">
            {rules.map((rule) => (
              <p key={rule}>{rule}</p>
            ))}
          </div>
          <button
            type="button"
            onClick={onExit}
            className="mt-4 h-11 w-full rounded-2xl bg-gradient-to-r from-[#2f9e62] to-[#51b97f] text-sm font-bold text-white"
          >
            退出房间
          </button>
        </aside>

        <section className="relative min-h-[380px] rounded-[36px] border border-[#8B6914]/35 bg-[radial-gradient(circle_at_center,_#1a6b3c_0%,_#14532d_38%,_#0d3d1f_100%)] p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
          <div
            className="absolute inset-0 rounded-[36px] opacity-[0.05]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #ffffff 0, #ffffff 2px, transparent 2px, transparent 8px)',
            }}
          />
          <div className="relative z-10 h-full">
            {seats.map((seat) => (
              <TableSeat key={seat.id} seat={seat} />
            ))}

            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <p className="text-xs uppercase tracking-[0.32em] text-white/50">当前玩法：{modeLabel}</p>
              <h1 className="brand-gold-text mt-2 text-3xl font-black tracking-[0.2em]">{gameTitle}</h1>
              <p className="mt-3 text-sm text-white/70">{statusText}</p>
              <div className="mt-5 w-full max-w-lg rounded-3xl border border-white/10 bg-black/16 p-4">
                {centerContent}
              </div>
            </div>
          </div>
        </section>

        <aside className="flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-black/22 px-3 py-4 backdrop-blur-sm">
          {deckLabel ? (
            <div className="w-full rounded-2xl bg-white/8 px-2 py-3 text-center text-xs font-bold text-[#f3d38c]">
              {deckLabel}
            </div>
          ) : null}
          <button
            type="button"
            onClick={onVoice}
            className="h-12 w-12 rounded-2xl bg-white/10 text-xl transition hover:bg-white/15"
          >
            🎙
          </button>
          <button
            type="button"
            onClick={onChat}
            className="h-12 w-12 rounded-2xl bg-white/10 text-xl transition hover:bg-white/15"
          >
            💬
          </button>
        </aside>
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-black/24 px-3 py-2 backdrop-blur-sm">
        {handArea}
      </section>

      <section className="mt-3 rounded-3xl border border-white/10 bg-black/28 p-3 backdrop-blur-sm">
        {actionArea}
      </section>
    </main>
  );
}
