"use client";

import { useEffect, useMemo, useState } from "react";
import BallNumber from "@/components/lottery/BallNumber";
import BetPanel from "@/components/lottery/BetPanel";
import CountdownTimer from "@/components/lottery/CountdownTimer";
import DrawHistory from "@/components/lottery/DrawHistory";
import {
  DRAW_INTERVAL_SECONDS,
  NUMBER_LIST,
  ZODIAC_LIST,
  ZODIAC_NUMBER_MAP,
  formatNumberList,
} from "@/lib/lottery/rules";
import { useLotteryStore } from "@/lib/store/useLottery";

function calculateRemainingSeconds(closesAt: string, fallback: number) {
  const closesAtMs = new Date(closesAt).getTime();
  if (!Number.isFinite(closesAtMs)) {
    return fallback;
  }

  return Math.max(Math.ceil((closesAtMs - Date.now()) / 1000), 0);
}

export default function LotteryPage() {
  const initialized = useLotteryStore((state) => state.initialized);
  const loading = useLotteryStore((state) => state.loading);
  const settling = useLotteryStore((state) => state.settling);
  const currentIssueNo = useLotteryStore((state) => state.currentIssueNo);
  const closesAt = useLotteryStore((state) => state.closesAt);
  const drawIntervalSeconds = useLotteryStore((state) => state.drawIntervalSeconds);
  const latestDraw = useLotteryStore((state) => state.latestDraw);
  const drawHistory = useLotteryStore((state) => state.drawHistory);
  const balance = useLotteryStore((state) => state.balance);
  const betHistory = useLotteryStore((state) => state.betHistory);
  const placeBet = useLotteryStore((state) => state.placeBet);
  const hydrate = useLotteryStore((state) => state.hydrate);
  const settleCurrentIssue = useLotteryStore((state) => state.settleCurrentIssue);

  const [pageError, setPageError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(DRAW_INTERVAL_SECONDS);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        await hydrate();
        if (!cancelled) {
          setPageError("");
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(error instanceof Error ? error.message : "六合彩初始化失败");
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    const fallback = drawIntervalSeconds > 0 ? drawIntervalSeconds : DRAW_INTERVAL_SECONDS;

    const syncCountdown = () => {
      const remaining = calculateRemainingSeconds(closesAt, fallback);
      setSecondsLeft(remaining);

      if (remaining === 0 && !settling) {
        void settleCurrentIssue().catch((error) => {
          setPageError(error instanceof Error ? error.message : "封盘结算失败");
        });
      }
    };

    syncCountdown();
    const timer = window.setInterval(syncCountdown, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [closesAt, drawIntervalSeconds, initialized, settleCurrentIssue, settling]);

  const issueBetHistory = useMemo(
    () => betHistory.filter((item) => item.issueNo === currentIssueNo).slice(0, 12),
    [betHistory, currentIssueNo],
  );

  const countdownStatus = settling ? "开奖中" : secondsLeft <= 0 ? "已封盘" : "投注中";

  return (
    <main className="h-screen w-full overflow-y-auto bg-gradient-to-b from-[#4f0b0b] via-[#6a1313] to-[#2c0404] px-3 py-4 text-white">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-3">
        <header className="rounded-2xl border border-[#f8c675]/45 bg-gradient-to-r from-[#9b2323] to-[#5a1010] px-4 py-4 shadow-lg shadow-black/25">
          <h1 className="text-center text-xl font-black tracking-[0.15em] text-[#ffd457]">澳门六合彩</h1>
          <p className="mt-1 text-center text-sm font-semibold text-[#fff0d5]">第 {currentIssueNo} 期</p>
          <p className="mt-1 text-center text-xs text-[#ffe4bf]">
            Phase 7 · 竖屏优先页面（独立闭环版）
          </p>
          <div className="mt-3 flex justify-center">
            <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold text-[#ffe4bf]">
              {countdownStatus}
            </span>
          </div>
        </header>

        {pageError ? (
          <p className="rounded-xl border border-[#ffb0b0]/45 bg-[#641919]/80 px-3 py-2 text-xs text-[#ffe7e7]">
            {pageError}
          </p>
        ) : null}

        {loading && !initialized ? (
          <section className="rounded-2xl border border-[#f8c675]/45 bg-gradient-to-br from-[#7c1a1a] to-[#4a0c0c] p-4 text-center text-sm text-[#ffe6c5] shadow-lg shadow-black/25">
            正在同步当前期号与账户信息...
          </section>
        ) : null}

        <CountdownTimer issueNo={currentIssueNo} secondsLeft={secondsLeft} />

        <DrawHistory latestDraw={latestDraw} drawHistory={drawHistory} />

        <BetPanel issueNo={currentIssueNo} balance={balance} onSubmitBet={placeBet} />

        <section className="rounded-2xl border border-[#f8c675]/45 bg-gradient-to-br from-[#fff7e6] to-[#ffe9c7] p-4 text-[#5d220f] shadow">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-[0.08em]">49号码颜色速查</h2>
            <span className="text-xs text-[#8b3f22]">红 / 蓝 / 绿</span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {NUMBER_LIST.map((number) => (
              <BallNumber key={`lookup-${number}`} number={number} />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#f8c675]/45 bg-gradient-to-br from-[#fff7e6] to-[#ffe9c7] p-4 text-[#5d220f] shadow">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-[0.08em]">12生肖对应表（测试）</h2>
            <span className="text-xs text-[#8b3f22]">Phase 9 改后台配置</span>
          </div>
          <div className="space-y-1">
            {ZODIAC_LIST.map((zodiac) => (
              <div
                key={`zodiac-${zodiac}`}
                className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-xs"
              >
                <span className="font-semibold text-[#7a2b12]">{zodiac}</span>
                <span className="text-[#8b3f22]">{formatNumberList(ZODIAC_NUMBER_MAP[zodiac])}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#f8c675]/45 bg-gradient-to-br from-[#fff7e6] to-[#ffe9c7] p-4 text-[#5d220f] shadow">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-[0.08em]">本期投注记录</h2>
            <span className="text-xs text-[#8b3f22]">第 {currentIssueNo} 期</span>
          </div>

          {issueBetHistory.length === 0 ? (
            <p className="rounded-lg bg-white/70 px-3 py-3 text-xs text-[#8b3f22]">当前期暂未下注。</p>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {issueBetHistory.map((item) => (
                <div key={item.id} className="rounded-lg bg-white/70 p-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold text-[#7a2b12]">{item.category}</span>
                    <span className="font-semibold text-[#9b2f1a]">-¥{item.totalAmount.toFixed(2)}</span>
                  </div>
                  <p className="text-[#8b3f22]">{item.detail}</p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-[#8b3f22]">
                    <span>
                      {item.units} 注 × ¥{item.stake.toFixed(2)}
                    </span>
                    <span>
                      {new Date(item.createdAt).toLocaleTimeString("zh-CN", {
                        hour12: false,
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
