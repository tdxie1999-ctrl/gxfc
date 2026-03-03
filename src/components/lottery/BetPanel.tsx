"use client";

import { useMemo, useState } from "react";
import BallNumber from "@/components/lottery/BallNumber";
import {
  CATEGORY_TABS,
  COLOR_LABELS,
  LIANMA_TYPES,
  NOT_IN_TYPES,
  NUMBER_LIST,
  ZHENGMA_PLAY_OPTIONS,
  ZODIAC_LIST,
  ZODIAC_NUMBER_MAP,
  combination,
  formatNumberList,
  toggleValue,
  type CategoryId,
  type LianMaTypeId,
  type LotteryColor,
  type NotInType,
  type ZhengMaPlayOption,
  type Zodiac,
} from "@/lib/lottery/rules";
import type { PlaceBetResult } from "@/lib/lottery/types";

type BetDraft =
  | {
      valid: true;
      category: string;
      detail: string;
      units: number;
    }
  | {
      valid: false;
      reason: string;
    };

interface BetPanelProps {
  issueNo: string;
  balance: number;
  onSubmitBet: (payload: {
    issueNo: string;
    category: string;
    detail: string;
    units: number;
    stake: number;
  }) => Promise<PlaceBetResult> | PlaceBetResult;
}

function ZodiacChip({
  zodiac,
  selected,
  onToggle,
}: {
  zodiac: Zodiac;
  selected: boolean;
  onToggle: (value: Zodiac) => void;
}) {
  return (
    <button
      type="button"
      className={`rounded-xl border px-2 py-2 text-left transition ${
        selected
          ? "border-[#f8c675] bg-[#5d1b1b] text-[#ffdc9f]"
          : "border-white/20 bg-[#2b1313]/75 text-[#f8e8d2] hover:bg-[#3a1c1c]"
      }`}
      onClick={() => onToggle(zodiac)}
      aria-pressed={selected}
    >
      <div className="text-sm font-semibold">{zodiac}</div>
      <div className="mt-1 text-[10px] opacity-80">{formatNumberList(ZODIAC_NUMBER_MAP[zodiac])}</div>
    </button>
  );
}

export default function BetPanel({ issueNo, balance, onSubmitBet }: BetPanelProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("colorWave");
  const [stake, setStake] = useState(20);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [colorWaveSelection, setColorWaveSelection] = useState<LotteryColor[]>([]);
  const [teMaSelection, setTeMaSelection] = useState<number[]>([]);
  const [teXiaoSelection, setTeXiaoSelection] = useState<Zodiac[]>([]);
  const [zhengMaSelection, setZhengMaSelection] = useState<number[]>([]);
  const [zhengTePosition, setZhengTePosition] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [zhengTeSelection, setZhengTeSelection] = useState<number[]>([]);
  const [zhengMa1to6Position, setZhengMa1to6Position] =
    useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [zhengMa1to6Selection, setZhengMa1to6Selection] = useState<ZhengMaPlayOption[]>(
    [],
  );
  const [lianMaType, setLianMaType] = useState<LianMaTypeId>("erQuanZhong");
  const [lianMaSelection, setLianMaSelection] = useState<number[]>([]);
  const [yiXiaoSelection, setYiXiaoSelection] = useState<Zodiac[]>([]);
  const [ziXuanBuZhongType, setZiXuanBuZhongType] = useState<NotInType>(5);
  const [ziXuanBuZhongSelection, setZiXuanBuZhongSelection] = useState<number[]>([]);

  const activeLianMaType = useMemo(
    () => LIANMA_TYPES.find((item) => item.id === lianMaType) ?? LIANMA_TYPES[0],
    [lianMaType],
  );

  const currentDraft = useMemo<BetDraft>(() => {
    switch (activeCategory) {
      case "colorWave":
        if (colorWaveSelection.length === 0) {
          return { valid: false, reason: "请先选择色波。" };
        }
        return {
          valid: true,
          category: "色波",
          detail: colorWaveSelection.map((value) => COLOR_LABELS[value]).join("、"),
          units: colorWaveSelection.length,
        };

      case "teMa":
        if (teMaSelection.length === 0) {
          return { valid: false, reason: "请至少选择一个特码号码。" };
        }
        return {
          valid: true,
          category: "特码",
          detail: formatNumberList(teMaSelection),
          units: teMaSelection.length,
        };

      case "teXiao":
        if (teXiaoSelection.length === 0) {
          return { valid: false, reason: "请至少选择一个特肖。" };
        }
        return {
          valid: true,
          category: "特肖",
          detail: teXiaoSelection.join("、"),
          units: teXiaoSelection.length,
        };

      case "zhengMa":
        if (zhengMaSelection.length === 0) {
          return { valid: false, reason: "请至少选择一个正码号码。" };
        }
        return {
          valid: true,
          category: "正码",
          detail: formatNumberList(zhengMaSelection),
          units: zhengMaSelection.length,
        };

      case "zhengTe":
        if (zhengTeSelection.length === 0) {
          return { valid: false, reason: "请先选择正特号码。" };
        }
        return {
          valid: true,
          category: "正特",
          detail: `正${zhengTePosition}特：${formatNumberList(zhengTeSelection)}`,
          units: zhengTeSelection.length,
        };

      case "zhengMa1to6":
        if (zhengMa1to6Selection.length === 0) {
          return { valid: false, reason: "请先选择正码1-6玩法选项。" };
        }
        return {
          valid: true,
          category: "正码1-6",
          detail: `正码${zhengMa1to6Position}：${zhengMa1to6Selection.join("、")}`,
          units: zhengMa1to6Selection.length,
        };

      case "lianMa":
        if (lianMaSelection.length < activeLianMaType.pick) {
          return {
            valid: false,
            reason: `${activeLianMaType.label}至少选择${activeLianMaType.pick}个号码。`,
          };
        }
        return {
          valid: true,
          category: "连码",
          detail: `${activeLianMaType.label}：${formatNumberList(lianMaSelection)}`,
          units: combination(lianMaSelection.length, activeLianMaType.pick),
        };

      case "yiXiao":
        if (yiXiaoSelection.length === 0) {
          return { valid: false, reason: "请至少选择一个生肖。" };
        }
        return {
          valid: true,
          category: "一肖",
          detail: yiXiaoSelection.join("、"),
          units: yiXiaoSelection.length,
        };

      case "ziXuanBuZhong":
        if (ziXuanBuZhongSelection.length < ziXuanBuZhongType) {
          return {
            valid: false,
            reason: `${ziXuanBuZhongType}不中至少选择${ziXuanBuZhongType}个号码。`,
          };
        }
        return {
          valid: true,
          category: "自选不中",
          detail: `${ziXuanBuZhongType}不中：${formatNumberList(ziXuanBuZhongSelection)}`,
          units: combination(ziXuanBuZhongSelection.length, ziXuanBuZhongType),
        };

      default:
        return { valid: false, reason: "未支持的投注分类。" };
    }
  }, [
    activeCategory,
    activeLianMaType.label,
    activeLianMaType.pick,
    colorWaveSelection,
    lianMaSelection,
    teMaSelection,
    teXiaoSelection,
    yiXiaoSelection,
    zhengMa1to6Position,
    zhengMa1to6Selection,
    zhengMaSelection,
    zhengTePosition,
    zhengTeSelection,
    ziXuanBuZhongSelection,
    ziXuanBuZhongType,
  ]);

  const estimatedAmount = currentDraft.valid ? currentDraft.units * stake : 0;

  function clearCurrentSelection() {
    switch (activeCategory) {
      case "colorWave":
        setColorWaveSelection([]);
        break;
      case "teMa":
        setTeMaSelection([]);
        break;
      case "teXiao":
        setTeXiaoSelection([]);
        break;
      case "zhengMa":
        setZhengMaSelection([]);
        break;
      case "zhengTe":
        setZhengTeSelection([]);
        break;
      case "zhengMa1to6":
        setZhengMa1to6Selection([]);
        break;
      case "lianMa":
        setLianMaSelection([]);
        break;
      case "yiXiao":
        setYiXiaoSelection([]);
        break;
      case "ziXuanBuZhong":
        setZiXuanBuZhongSelection([]);
        break;
      default:
        break;
    }
  }

  async function handleSubmit() {
    if (submitting) {
      return;
    }

    if (!Number.isFinite(stake) || stake <= 0) {
      setStatus({ type: "error", text: "单注金额必须大于 0。" });
      return;
    }
    if (!currentDraft.valid) {
      setStatus({ type: "error", text: currentDraft.reason });
      return;
    }

    setSubmitting(true);

    try {
      const result = await Promise.resolve(
        onSubmitBet({
          issueNo,
          category: currentDraft.category,
          detail: currentDraft.detail,
          units: currentDraft.units,
          stake,
        }),
      );

      setStatus({ type: result.ok ? "success" : "error", text: result.message });
      if (result.ok) {
        clearCurrentSelection();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#f8c675]/45 bg-gradient-to-br from-[#651515] to-[#350909] p-4 text-[#fff3e0] shadow-lg shadow-black/30">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-[0.08em]">投注面板</h2>
        <span className="rounded-full bg-black/25 px-3 py-1 text-xs text-[#ffd898]">
          余额 ¥{balance.toFixed(2)}
        </span>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition ${
              activeCategory === tab.id
                ? "border-[#ffd457] bg-[#ffd457] text-[#742400]"
                : "border-white/20 bg-[#2f1010]/70 text-[#f9ead1] hover:bg-[#472020]"
            }`}
            onClick={() => setActiveCategory(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeCategory === "colorWave" ? (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {(Object.keys(COLOR_LABELS) as LotteryColor[]).map((color) => (
            <button
              key={color}
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                colorWaveSelection.includes(color)
                  ? "border-[#ffd457] bg-[#ffd457] text-[#702000]"
                  : "border-white/25 bg-[#2b1313] text-[#ffe9c8]"
              }`}
              onClick={() => setColorWaveSelection((current) => toggleValue(current, color))}
            >
              {COLOR_LABELS[color]}
            </button>
          ))}
        </div>
      ) : null}

      {activeCategory === "teMa" ? (
        <div className="mb-3 grid grid-cols-7 gap-2">
          {NUMBER_LIST.map((number) => (
            <BallNumber
              key={`tema-${number}`}
              number={number}
              selected={teMaSelection.includes(number)}
              onClick={(value) => setTeMaSelection((current) => toggleValue(current, value))}
            />
          ))}
        </div>
      ) : null}

      {activeCategory === "teXiao" ? (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {ZODIAC_LIST.map((zodiac) => (
            <ZodiacChip
              key={`texiao-${zodiac}`}
              zodiac={zodiac}
              selected={teXiaoSelection.includes(zodiac)}
              onToggle={(value) => setTeXiaoSelection((current) => toggleValue(current, value))}
            />
          ))}
        </div>
      ) : null}

      {activeCategory === "zhengMa" ? (
        <div className="mb-3 grid grid-cols-7 gap-2">
          {NUMBER_LIST.map((number) => (
            <BallNumber
              key={`zhengma-${number}`}
              number={number}
              selected={zhengMaSelection.includes(number)}
              onClick={(value) => setZhengMaSelection((current) => toggleValue(current, value))}
            />
          ))}
        </div>
      ) : null}

      {activeCategory === "zhengTe" ? (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((index) => (
              <button
                key={`zhengte-${index}`}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs ${
                  zhengTePosition === index
                    ? "border-[#ffd457] bg-[#ffd457] text-[#712300]"
                    : "border-white/25 bg-[#2f1010]/70 text-[#f9ead1]"
                }`}
                onClick={() => setZhengTePosition(index as 1 | 2 | 3 | 4 | 5 | 6)}
              >
                正{index}特
              </button>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {NUMBER_LIST.map((number) => (
              <BallNumber
                key={`zhengte-number-${number}`}
                number={number}
                selected={zhengTeSelection.includes(number)}
                onClick={(value) => setZhengTeSelection((current) => toggleValue(current, value))}
              />
            ))}
          </div>
        </div>
      ) : null}

      {activeCategory === "zhengMa1to6" ? (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((index) => (
              <button
                key={`zhengma16-position-${index}`}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs ${
                  zhengMa1to6Position === index
                    ? "border-[#ffd457] bg-[#ffd457] text-[#712300]"
                    : "border-white/25 bg-[#2f1010]/70 text-[#f9ead1]"
                }`}
                onClick={() => setZhengMa1to6Position(index as 1 | 2 | 3 | 4 | 5 | 6)}
              >
                正码{index}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {ZHENGMA_PLAY_OPTIONS.map((option) => (
              <button
                key={`zhengma16-option-${option}`}
                type="button"
                className={`rounded-lg border px-2 py-2 text-sm ${
                  zhengMa1to6Selection.includes(option)
                    ? "border-[#ffd457] bg-[#ffd457] text-[#712300]"
                    : "border-white/25 bg-[#2f1010]/70 text-[#f9ead1]"
                }`}
                onClick={() =>
                  setZhengMa1to6Selection((current) => toggleValue(current, option))
                }
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {activeCategory === "lianMa" ? (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {LIANMA_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs ${
                  lianMaType === type.id
                    ? "border-[#ffd457] bg-[#ffd457] text-[#712300]"
                    : "border-white/25 bg-[#2f1010]/70 text-[#f9ead1]"
                }`}
                onClick={() => setLianMaType(type.id)}
              >
                {type.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-[#ffdcb4]">
            当前玩法 {activeLianMaType.label}，最少选择 {activeLianMaType.pick} 个号码。
          </div>
          <div className="grid grid-cols-7 gap-2">
            {NUMBER_LIST.map((number) => (
              <BallNumber
                key={`lianma-number-${number}`}
                number={number}
                selected={lianMaSelection.includes(number)}
                onClick={(value) => setLianMaSelection((current) => toggleValue(current, value))}
              />
            ))}
          </div>
        </div>
      ) : null}

      {activeCategory === "yiXiao" ? (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {ZODIAC_LIST.map((zodiac) => (
            <ZodiacChip
              key={`yixiao-${zodiac}`}
              zodiac={zodiac}
              selected={yiXiaoSelection.includes(zodiac)}
              onToggle={(value) => setYiXiaoSelection((current) => toggleValue(current, value))}
            />
          ))}
        </div>
      ) : null}

      {activeCategory === "ziXuanBuZhong" ? (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {NOT_IN_TYPES.map((type) => (
              <button
                key={`buzhong-${type}`}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs ${
                  ziXuanBuZhongType === type
                    ? "border-[#ffd457] bg-[#ffd457] text-[#712300]"
                    : "border-white/25 bg-[#2f1010]/70 text-[#f9ead1]"
                }`}
                onClick={() => setZiXuanBuZhongType(type)}
              >
                {type}不中
              </button>
            ))}
          </div>
          <div className="text-xs text-[#ffdcb4]">
            当前玩法 {ziXuanBuZhongType}不中，可多选号码自动组合计注。
          </div>
          <div className="grid grid-cols-7 gap-2">
            {NUMBER_LIST.map((number) => (
              <BallNumber
                key={`buzhong-number-${number}`}
                number={number}
                selected={ziXuanBuZhongSelection.includes(number)}
                onClick={(value) =>
                  setZiXuanBuZhongSelection((current) => toggleValue(current, value))
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor="stake-input" className="text-xs text-[#ffe3bf]">
          单注金额 (¥)
        </label>
        <input
          id="stake-input"
          type="number"
          min={1}
          step={1}
          value={stake}
          onChange={(event) => setStake(Number(event.target.value))}
          className="w-24 rounded-lg border border-white/30 bg-[#2f1010] px-2 py-1 text-right text-sm text-white outline-none focus:border-[#ffd457]"
        />
      </div>

      <div className="mb-2 rounded-lg bg-black/20 px-3 py-2 text-xs text-[#ffe3bf]">
        {currentDraft.valid ? (
          <div className="space-y-1">
            <p>
              当前投注：{currentDraft.category}，{currentDraft.units} 注
            </p>
            <p>预计扣款：¥{estimatedAmount.toFixed(2)}</p>
          </div>
        ) : (
          <p>{currentDraft.reason}</p>
        )}
      </div>

      {status ? (
        <p
          className={`mb-2 rounded-lg px-3 py-2 text-xs ${
            status.type === "success"
              ? "bg-emerald-600/80 text-white"
              : "bg-rose-600/80 text-white"
          }`}
        >
          {status.text}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-lg border border-white/30 bg-[#2f1010] px-3 py-2 text-sm text-[#ffe3bf] transition hover:bg-[#432020]"
          onClick={clearCurrentSelection}
        >
          清空选择
        </button>
        <button
          type="button"
          className="flex-1 rounded-lg bg-gradient-to-r from-[#ffd457] to-[#f6b728] px-3 py-2 text-sm font-semibold text-[#6b2200] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
          onClick={() => void handleSubmit()}
          disabled={submitting}
        >
          {submitting ? "下注中..." : "立即下注"}
        </button>
      </div>
    </section>
  );
}
