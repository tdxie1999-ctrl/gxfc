export default function Loading({ label = '加载中...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-3 w-3 animate-ping rounded-full bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.45)]" />
      <span className="text-yellow-200/70">{label}</span>
    </div>
  );
}
