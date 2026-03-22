'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/useAuth';
import { type GameType, useGameStore } from '@/lib/store/useGame';
import { useToastStore } from '@/lib/store/useToast';

const ROOM_COST = 2;

const tabs: Array<{ key: GameType | 'locked'; label: string; locked?: boolean }> = [
  { key: 'paodekuai', label: '跑得快' },
  { key: 'datongzi', label: '打筒子' },
  { key: 'fangpaofa', label: '娄底放炮罚' },
  { key: 'locked', label: '邵阳剥皮', locked: true },
  { key: 'locked', label: '邵阳麻将', locked: true },
  { key: 'locked', label: '红中麻将', locked: true },
];

const gameThemes: Record<
  GameType,
  {
    badge: string;
    headline: string;
    description: string;
    gradient: string;
    glow: string;
    tags: string[];
    previewTitle: string;
  }
> = {
  paodekuai: {
    badge: '三人快节奏',
    headline: '16 张跑得快，开局快，决策密度高',
    description: '适合快速起桌和高频对局。系统补齐 AI 座位，牌局开始后直接进入真实玩法结算。',
    gradient: 'from-[#ffb84d]/25 via-[#f6d365]/10 to-transparent',
    glow: 'border-[#f3c562]/35 bg-[#241708]/65',
    tags: ['16 张发牌', '红桃 10 可翻倍', '小王翻倍', '系统托管'],
    previewTitle: '快节奏对局预览',
  },
  datongzi: {
    badge: '牌面更炸',
    headline: '打筒子更重打法和抉择，规则项更灵活',
    description: '偏向热闹牌局，抓鸟、加锤、吃牌等参数会直接影响局内节奏和分值波动。',
    gradient: 'from-[#56ccf2]/25 via-[#2f80ed]/10 to-transparent',
    glow: 'border-[#5dbcf2]/35 bg-[#071d2d]/65',
    tags: ['抓鸟可调', '一炮多响', '可吃牌', '翻倍阈值'],
    previewTitle: '炸场型牌局预览',
  },
  fangpaofa: {
    badge: '地方玩法',
    headline: '放炮罚更重规则组合，适合熟人局',
    description: '首局坐庄、息数和可兑守等设定决定整桌体验，适合长期房间和熟人圈复玩。',
    gradient: 'from-[#6fcf97]/20 via-[#27ae60]/10 to-transparent',
    glow: 'border-[#52c37c]/35 bg-[#081f14]/65',
    tags: ['15 息起胡', '可兑守', '飘胡', '首局坐庄可选'],
    previewTitle: '熟人规则局预览',
  },
};

function formatDisplayNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function NumericStepper({
  label,
  hint,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  hint: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <section className="rounded-[26px] border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-1 text-xs text-white/45">{hint}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-[#f4d26d]">
          当前
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onDecrease}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-xl text-white transition hover:bg-white/12"
        >
          -
        </button>
        <div className="flex h-12 min-w-[108px] flex-1 items-center justify-center rounded-2xl border border-[#d4a017]/25 bg-black/25 text-xl font-black text-[#f7d676]">
          {value}
        </div>
        <button
          type="button"
          onClick={onIncrease}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-xl text-white transition hover:bg-white/12"
        >
          +
        </button>
      </div>
    </section>
  );
}

function ChoiceGrid({
  label,
  hint,
  value,
  options,
  columns = 3,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  options: string[];
  columns?: 2 | 3 | 5;
  onChange: (next: string) => void;
}) {
  const gridClassName =
    columns === 2 ? 'grid-cols-2' : columns === 5 ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3';

  return (
    <section className="rounded-[26px] border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-1 text-xs text-white/45">{hint}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/55">{value}</span>
      </div>

      <div className={`mt-4 grid gap-2 ${gridClassName}`}>
        {options.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
              value === item
                ? 'border-[#e1bb55] bg-gradient-to-r from-[#f2b64f] to-[#f6d365] text-[#281605] shadow-[0_10px_24px_rgba(242,182,79,0.22)]'
                : 'border-white/10 bg-black/25 text-white/75 hover:bg-white/8'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}

export default function CreateRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const pushToast = useToastStore((state) => state.push);
  const profile = useAuthStore((state) => state.profile);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const user = useAuthStore((state) => state.user);
  const createRoom = useGameStore((state) => state.createRoom);

  const [activeTab, setActiveTab] = useState<GameType>('paodekuai');
  const [baseScore, setBaseScore] = useState(1);
  const [doubleThreshold, setDoubleThreshold] = useState(10);
  const [autoTrustee, setAutoTrustee] = useState('无');
  const [dealerRule, setDealerRule] = useState('房主');
  const [birdRule, setBirdRule] = useState('2鸟');
  const [creating, setCreating] = useState(false);

  const autoTrusteeSeconds = useMemo(() => {
    const mapping: Record<string, number> = {
      无: 0,
      '1分钟': 60,
      '2分钟': 120,
      '3分钟': 180,
      '5分钟': 300,
    };

    return mapping[autoTrustee] ?? 0;
  }, [autoTrustee]);

  const configRows = useMemo(() => {
    if (activeTab === 'fangpaofa') {
      return [
        { label: '主玩法', value: '15息起胡 / 10息起胡 / 可兑守 / 飘胡' },
        { label: '托管策略', value: autoTrustee === '无' ? '不自动托管' : `${autoTrustee}后接管` },
        { label: '翻倍线', value: `少于 ${doubleThreshold} 分翻倍` },
        { label: '首局坐庄', value: dealerRule },
        { label: '切牌方式', value: '系统切牌，自动开局' },
      ];
    }

    if (activeTab === 'datongzi') {
      return [
        { label: '主玩法', value: '一炮多响 / 带 / 加锤' },
        { label: '吃牌策略', value: '允许吃牌' },
        { label: '抓鸟规则', value: birdRule },
        { label: '翻倍线', value: `少于 ${doubleThreshold} 分翻倍` },
        { label: '托管策略', value: autoTrustee === '无' ? '不自动托管' : `${autoTrustee}后接管` },
      ];
    }

    return [
      { label: '起局节奏', value: `${formatDisplayNumber(baseScore)} 分底分快局` },
      { label: '翻倍线', value: `少于 ${doubleThreshold} 分翻倍` },
      { label: '托管策略', value: autoTrustee === '无' ? '不自动托管' : `${autoTrustee}后接管` },
      { label: '补位规则', value: '空座位由 AI 自动补齐' },
      { label: '扣钻方式', value: `创建时扣除 ${ROOM_COST} 钻石` },
    ];
  }, [activeTab, autoTrustee, baseScore, birdRule, dealerRule, doubleThreshold]);

  const activeTheme = gameThemes[activeTab];

  const summaryPills = useMemo(
    () => [
      { label: '底分', value: `${formatDisplayNumber(baseScore)} 分` },
      { label: '翻倍线', value: `${doubleThreshold} 分` },
      { label: '托管', value: autoTrustee },
      { label: '消耗', value: `${ROOM_COST} 钻石` },
    ],
    [autoTrustee, baseScore, doubleThreshold],
  );

  const handleCreate = async () => {
    if (!profile || !user) {
      pushToast('请先登录', 'error');
      return;
    }

    if (creating) {
      return;
    }

    setCreating(true);

    try {
      const nextConfig = {
        baseScore,
        autoTrustee,
        doubleThreshold,
        dealerRule,
        birdRule,
        datongzi:
          activeTab === 'datongzi'
            ? {
                handCardCount: 24,
                basePoint: baseScore,
                autoPlaySeconds: autoTrusteeSeconds || 8,
              }
            : undefined,
        paodekuai:
          activeTab === 'paodekuai'
            ? {
                cardCount: 16,
                fourWithThree: true,
                heartsTenDouble: true,
                smallJokerDouble: true,
                autoPlaySeconds: autoTrusteeSeconds || 12,
                doubleThreshold,
                basePoint: baseScore,
                rakePercent: 5,
              }
            : undefined,
      };

      if (activeTab === 'paodekuai') {
        const response = await fetch('/api/paodekuai/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            baseScore,
            config: nextConfig,
          }),
        });
        const result = (await response.json().catch(() => ({}))) as {
          roomId?: string;
          diamondsAfter?: number;
          message?: string;
        };

        if (!response.ok || !result.roomId) {
          pushToast(result.message ?? '创建真实跑得快房间失败', 'error');
          return;
        }

        if (typeof result.diamondsAfter === 'number') {
          await updateProfile({ diamonds: result.diamondsAfter });
        }

        pushToast('跑得快真实房间创建成功，已扣除2钻石', 'success');
        onClose();
        router.push(`/room/${result.roomId}`);
        return;
      }

      const result = await createRoom({
        gameType: activeTab,
        baseScore,
        config: nextConfig,
        availableDiamonds: profile.diamonds,
        hostName: profile.nickname,
        hostAvatar: profile.avatar_url ?? '/assets/avatars/default.png',
      });

      if (!result.ok || !result.roomId) {
        pushToast(result.message, 'error');
        return;
      }

      const nextDiamonds = Math.max(0, profile.diamonds - ROOM_COST);
      await updateProfile({ diamonds: nextDiamonds });

      await supabase.from('diamond_logs').insert({
        user_id: user.id,
        amount: -ROOM_COST,
        diamonds_after: nextDiamonds,
        type: 'room_create',
        description: `创建${activeTab}房间`,
      });

      pushToast('创建房间成功，已扣除2钻石', 'success');
      onClose();
      router.push(`/room/${result.roomId}`);
    } catch {
      pushToast(activeTab === 'paodekuai' ? '创建真实跑得快房间失败' : '创建房间失败', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleTabClick = (key: GameType | 'locked', locked?: boolean) => {
    if (locked || key === 'locked') {
      pushToast('即将上线', 'info');
      return;
    }

    setActiveTab(key);
  };

  return (
    <Modal open={open} onClose={onClose} title="创建房间" size="xl" unpadded panelClassName="overflow-hidden">
      <div className="relative flex h-[82vh] min-h-[620px] max-h-[780px] flex-col bg-[#07160f] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(244,210,109,0.14),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(39,174,96,0.16),_transparent_32%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#f0b64c]/8 to-transparent" />

        <div className="relative border-b border-white/8 px-5 pb-4 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[#f4d26d]/70">房间模板选择</p>
              <p className="mt-2 max-w-2xl text-sm text-white/55">
                先选玩法，再微调参数。当前先开放最常用的三类房间，创建后立即扣除 {ROOM_COST} 钻石。
              </p>
            </div>
            <div className="flex items-center gap-3 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm xl:self-auto">
              <span className="text-white/55">当前钻石</span>
              <span className="text-lg font-black text-[#f7d676]">💎 {profile?.diamonds ?? 0}</span>
            </div>
          </div>

          <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
            {tabs.map((tab) => {
              const isActive = !tab.locked && activeTab === tab.key;

              return (
                <button
                  key={`${tab.label}-${tab.key}`}
                  type="button"
                  onClick={() => handleTabClick(tab.key, tab.locked)}
                  className={`group min-w-[160px] rounded-[24px] border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-[#e3c063]/45 bg-gradient-to-br from-[#f2b64f]/25 to-[#0d2617] text-white shadow-[0_18px_34px_rgba(242,182,79,0.12)]'
                      : 'border-white/8 bg-white/5 text-white/80 hover:bg-white/8'
                  } ${tab.locked ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{tab.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${tab.locked ? 'bg-white/8 text-white/45' : isActive ? 'bg-[#f2b64f]/20 text-[#f7d676]' : 'bg-white/8 text-white/50'}`}>
                      {tab.locked ? '未开放' : '可创建'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-white/45">{tab.locked ? '保留玩法，后续接入' : '点击查看规则和参数'}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1.22fr)_380px]">
          <section className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
            <div className={`overflow-hidden rounded-[32px] border ${activeTheme.glow}`}>
              <div className={`bg-gradient-to-br ${activeTheme.gradient} p-5 sm:p-6`}>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <span className="inline-flex rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-[#f7d676]">
                      {activeTheme.badge}
                    </span>
                    <h4 className="mt-4 text-3xl font-black tracking-[0.06em] text-white">{tabs.find((item) => item.key === activeTab)?.label}</h4>
                    <p className="mt-2 text-lg font-semibold text-[#f6d365]">{activeTheme.headline}</p>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-white/72">{activeTheme.description}</p>
                  </div>

                  <div className="grid min-w-[240px] grid-cols-2 gap-3">
                    {summaryPills.map((item) => (
                      <div key={item.label} className="rounded-[22px] border border-white/10 bg-black/25 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/40">{item.label}</p>
                        <p className="mt-2 text-lg font-black text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {activeTheme.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/78">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
              <section className="rounded-[30px] border border-white/10 bg-black/22 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-white/45">{activeTheme.previewTitle}</p>
                    <p className="mt-2 text-base font-semibold text-white">当前房间配置总览</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">创建后立即生效</span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {configRows.map((row) => (
                    <div key={row.label} className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">{row.label}</p>
                      <p className="mt-3 text-sm font-semibold leading-6 text-white/88">{row.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[30px] border border-white/10 bg-black/22 p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-white/45">后续开放</p>
                <p className="mt-2 text-base font-semibold text-white">路线图里的玩法</p>
                <div className="mt-5 space-y-3">
                  {tabs
                    .filter((item) => item.locked)
                    .map((item) => (
                      <div key={item.label} className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-white/78">{item.label}</span>
                          <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] text-white/45">LOCKED</span>
                        </div>
                        <p className="mt-2 text-xs leading-6 text-white/45">玩法入口会保留在同一套房间体系里，等核心体验稳定后接入。</p>
                      </div>
                    ))}
                </div>
              </section>
            </div>
          </section>

          <aside className="flex min-h-0 flex-col border-t border-white/8 bg-black/24 xl:border-l xl:border-t-0">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-4">
                <NumericStepper
                  label="积分底分"
                  hint="底分会影响整桌波动速度，建议先从 1 分试局。"
                  value={formatDisplayNumber(baseScore)}
                  onDecrease={() => setBaseScore((prev) => Math.max(0.5, Number((prev - 0.5).toFixed(1))))}
                  onIncrease={() => setBaseScore((prev) => Math.min(100, Number((prev + 0.5).toFixed(1))))}
                />

                <NumericStepper
                  label="翻倍阈值"
                  hint="比分过低时自动翻倍，适合拉高追分节奏。"
                  value={String(doubleThreshold)}
                  onDecrease={() => setDoubleThreshold((prev) => Math.max(10, prev - 10))}
                  onIncrease={() => setDoubleThreshold((prev) => Math.min(100, prev + 10))}
                />

                <ChoiceGrid
                  label="托管时间"
                  hint="超时后由系统接管，避免整桌卡住。"
                  value={autoTrustee}
                  options={['无', '1分钟', '2分钟', '3分钟', '5分钟']}
                  columns={5}
                  onChange={setAutoTrustee}
                />

                {activeTab === 'fangpaofa' ? (
                  <ChoiceGrid
                    label="首局坐庄"
                    hint="熟人局常用项，决定第一局起手庄家。"
                    value={dealerRule}
                    options={['随机', '房主']}
                    columns={2}
                    onChange={setDealerRule}
                  />
                ) : null}

                {activeTab === 'datongzi' ? (
                  <ChoiceGrid
                    label="抓鸟规则"
                    hint="抓鸟越重，分值波动越明显。"
                    value={birdRule}
                    options={['窝窝鸟', '2鸟', '3鸟', '4鸟', '6鸟', '8鸟']}
                    columns={3}
                    onChange={setBirdRule}
                  />
                ) : null}
              </div>
            </div>

            <div className="border-t border-white/8 bg-black/28 px-5 py-4">
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">本次创建结算</p>
                    <p className="mt-1 text-xs text-white/45">创建后自动进入新房间</p>
                  </div>
                  <span className="rounded-full border border-[#f4d26d]/20 bg-[#f4d26d]/10 px-3 py-1 text-xs font-semibold text-[#f7d676]">
                    -{ROOM_COST} 💎
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between text-white/62">
                    <span>当前钻石</span>
                    <span>{profile?.diamonds ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-white/62">
                    <span>创建后剩余</span>
                    <span>{Math.max(0, (profile?.diamonds ?? 0) - ROOM_COST)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="mt-4 h-14 w-full rounded-[24px] bg-gradient-to-r from-[#25b05d] to-[#7bd59d] text-base font-black tracking-[0.08em] text-[#082012] shadow-[0_18px_36px_rgba(40,176,93,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {creating ? '创建中...' : `创建${tabs.find((item) => item.key === activeTab)?.label}房间`}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </Modal>
  );
}
