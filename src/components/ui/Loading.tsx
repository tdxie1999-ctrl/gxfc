export default function Loading({ label = '加载中...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-white/90">
      <span className="h-3 w-3 animate-ping rounded-full bg-white/80" />
      <span>{label}</span>
    </div>
  );
}
