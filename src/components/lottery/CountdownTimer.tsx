"use client";

import { useEffect, useMemo, useState } from "react";

interface CountdownTimerProps {
  issueNo: string;
  secondsLeft: number;
}

function FlipDigit({ value }: { value: string }) {
  const [currentValue, setCurrentValue] = useState(value);
  const [nextValue, setNextValue] = useState<string | null>(null);

  useEffect(() => {
    if (value === currentValue) {
      return;
    }
    setNextValue(value);

    const timer = window.setTimeout(() => {
      setCurrentValue(value);
      setNextValue(null);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [value, currentValue]);

  return (
    <div className="relative h-12 w-9 overflow-hidden rounded-md bg-[#1b0d0d] shadow-inner shadow-black/50">
      <div
        className={`absolute inset-0 flex items-center justify-center text-2xl font-extrabold text-[#ffd457] ${
          nextValue ? "lottery-flip-out" : ""
        }`}
      >
        {currentValue}
      </div>
      {nextValue ? (
        <div className="lottery-flip-in absolute inset-0 flex items-center justify-center text-2xl font-extrabold text-[#ffd457]">
          {nextValue}
        </div>
      ) : null}
    </div>
  );
}

function FlipPair({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1">
        <FlipDigit value={value[0]} />
        <FlipDigit value={value[1]} />
      </div>
      <span className="text-[11px] text-[#ffdcb4]/90">{label}</span>
    </div>
  );
}

export default function CountdownTimer({ issueNo, secondsLeft }: CountdownTimerProps) {
  const [hours, minutes, seconds] = useMemo(() => {
    const h = Math.floor(secondsLeft / 3600)
      .toString()
      .padStart(2, "0");
    const m = Math.floor((secondsLeft % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(secondsLeft % 60)
      .toString()
      .padStart(2, "0");
    return [h, m, s];
  }, [secondsLeft]);

  return (
    <section className="rounded-2xl border border-[#f8c675]/45 bg-gradient-to-br from-[#7c1a1a] to-[#4a0c0c] p-4 shadow-lg shadow-black/25">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-[0.08em] text-[#ffe6c5]">封盘倒计时</h2>
        <span className="rounded-full bg-[#2f0f0f] px-3 py-1 text-xs text-[#ffcf88]">第 {issueNo} 期</span>
      </div>
      <div className="flex items-center justify-center gap-2">
        <FlipPair value={hours} label="时" />
        <span className="text-xl font-bold text-[#ffd457]">:</span>
        <FlipPair value={minutes} label="分" />
        <span className="text-xl font-bold text-[#ffd457]">:</span>
        <FlipPair value={seconds} label="秒" />
      </div>
    </section>
  );
}
