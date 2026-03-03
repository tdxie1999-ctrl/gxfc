interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-center border-b border-white/20 bg-black/25 px-4">
      <h1 className="brand-gold-text text-lg font-black tracking-[0.2em]">{title}</h1>
    </header>
  );
}
