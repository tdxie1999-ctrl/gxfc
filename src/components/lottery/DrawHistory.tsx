import BallNumber from "@/components/lottery/BallNumber";
import type { LotteryDrawResult } from "@/lib/lottery/rules";

interface DrawHistoryProps {
  latestDraw: LotteryDrawResult;
  drawHistory: LotteryDrawResult[];
}

export default function DrawHistory({ latestDraw, drawHistory }: DrawHistoryProps) {
  return (
    <section className="rounded-2xl border border-[#f8c675]/45 bg-gradient-to-br from-[#fff7e6] to-[#ffe9c7] p-4 text-[#5d220f] shadow">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-[0.08em]">最新开奖</h2>
        <span className="text-xs text-[#8b3f22]">
          {new Date(latestDraw.drawTime).toLocaleString("zh-CN", {
            hour12: false,
          })}
        </span>
      </div>

      <div className="rounded-xl bg-white/80 p-3">
        <div className="mb-2 text-xs font-semibold text-[#8a320f]">第 {latestDraw.issueNo} 期</div>
        <div className="flex flex-wrap items-center gap-2">
          {latestDraw.numbers.map((number) => (
            <BallNumber key={`latest-${latestDraw.issueNo}-${number}`} number={number} />
          ))}
          <span className="mx-0.5 text-base font-bold text-[#8a320f]">+</span>
          <BallNumber number={latestDraw.specialNumber} special />
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="text-xs font-semibold text-[#8a320f]">开奖历史</div>
        <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
          {drawHistory.slice(0, 10).map((item) => (
            <div key={`history-${item.issueNo}-${item.drawTime}`} className="rounded-lg bg-white/70 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold">第 {item.issueNo} 期</span>
                <span className="text-[11px] text-[#8b3f22]">
                  {new Date(item.drawTime).toLocaleTimeString("zh-CN", {
                    hour12: false,
                  })}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {item.numbers.map((number) => (
                  <BallNumber key={`history-ball-${item.issueNo}-${number}`} number={number} />
                ))}
                <span className="mx-0.5 text-sm font-bold">+</span>
                <BallNumber number={item.specialNumber} special />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
