import { formatNumber, getBallColor, getZodiacByNumber } from "@/lib/lottery/rules";

interface BallNumberProps {
  number: number;
  selected?: boolean;
  onClick?: (value: number) => void;
  showZodiac?: boolean;
  special?: boolean;
}

const COLOR_STYLE_MAP = {
  red: "from-[#f26363] to-[#c81e1e] border-[#ffd0d0]",
  blue: "from-[#5f9bfd] to-[#1f5ecd] border-[#d6e8ff]",
  green: "from-[#51b56d] to-[#237b43] border-[#d8f4df]",
} as const;

export default function BallNumber({
  number,
  selected = false,
  onClick,
  showZodiac = true,
  special = false,
}: BallNumberProps) {
  const color = getBallColor(number);
  const zodiac = getZodiacByNumber(number);

  const className = [
    "relative flex h-12 w-12 flex-col items-center justify-center rounded-full border-2 bg-gradient-to-b text-[10px] text-white shadow",
    COLOR_STYLE_MAP[color],
    selected ? "ring-2 ring-offset-2 ring-offset-transparent ring-[#ffd457]" : "",
    onClick ? "transition hover:-translate-y-0.5" : "",
    special ? "after:absolute after:-right-1 after:-top-1 after:rounded-full after:bg-[#ffd457] after:px-1.5 after:py-0.5 after:text-[9px] after:font-bold after:text-[#8b2600] after:content-['特']" : "",
  ].join(" ");

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => onClick(number)}
        aria-pressed={selected}
      >
        <span className="text-xs font-bold tracking-[0.05em]">{formatNumber(number)}</span>
        {showZodiac ? <span>{zodiac}</span> : null}
      </button>
    );
  }

  return (
    <div className={className}>
      <span className="text-xs font-bold tracking-[0.05em]">{formatNumber(number)}</span>
      {showZodiac ? <span>{zodiac}</span> : null}
    </div>
  );
}
