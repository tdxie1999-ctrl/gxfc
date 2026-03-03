'use client';

import Modal from '@/components/ui/Modal';
import type { GameType } from '@/lib/store/useGame';

const groups: Array<{ title: string; items: Array<{ label: string; value: GameType }> }> = [
  {
    title: '扑克类',
    items: [
      { label: '跑得快', value: 'paodekuai' },
      { label: '打筒子', value: 'datongzi' },
    ],
  },
  {
    title: '字牌类',
    items: [{ label: '娄底放炮罚', value: 'fangpaofa' }],
  },
  {
    title: '麻将类',
    items: [],
  },
];

export default function FilterModal({
  open,
  selected,
  onClose,
  onApply,
}: {
  open: boolean;
  selected: GameType[];
  onClose: () => void;
  onApply: (value: GameType[]) => void;
}) {
  const toggle = (value: GameType) => {
    if (selected.includes(value)) {
      onApply(selected.filter((item) => item !== value));
      return;
    }

    onApply([...selected, value]);
  };

  return (
    <Modal open={open} onClose={onClose} title="玩法筛选" panelClassName="max-w-3xl p-0 overflow-hidden">
      <div className="grid min-h-[360px] md:grid-cols-[180px_1fr]">
        <aside className="border-r border-slate-200 bg-slate-100 p-4">
          <div className="space-y-2 text-sm font-semibold text-slate-700">
            <div className="rounded-2xl bg-white px-3 py-2">显示全部桌子</div>
            <button
              type="button"
              className="w-full rounded-2xl bg-white px-3 py-2 text-left"
              onClick={() => onApply(selected.length === 3 ? [] : ['paodekuai', 'datongzi', 'fangpaofa'])}
            >
              一键全选 {selected.length === 3 ? '☑' : '☐'}
            </button>
          </div>
        </aside>

        <section className="p-5">
          {groups.map((group) => (
            <div key={group.title} className="mb-5 last:mb-0">
              <h4 className="text-sm font-black text-slate-900">{group.title}</h4>
              <div className="mt-3 space-y-2">
                {group.items.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-400">即将开放</div>
                ) : (
                  group.items.map((item) => (
                    <div key={item.value} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                      <span>{item.label}</span>
                      <div className="flex items-center gap-2">
                        <button type="button" className="rounded-xl bg-slate-200 px-2 py-1 text-xs text-slate-600">
                          置顶
                        </button>
                        <button
                          type="button"
                          className={`rounded-xl px-3 py-1 text-xs font-semibold ${
                            selected.includes(item.value)
                              ? 'bg-emerald-500 text-white'
                              : 'bg-white text-slate-600'
                          }`}
                          onClick={() => toggle(item.value)}
                        >
                          {selected.includes(item.value) ? '已选' : '快速加入'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </Modal>
  );
}
