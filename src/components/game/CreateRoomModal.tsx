'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store/useAuth';
import { type GameType, useGameStore } from '@/lib/store/useGame';
import { useToastStore } from '@/lib/store/useToast';

const tabs: Array<{ key: GameType | 'locked'; label: string; locked?: boolean }> = [
  { key: 'paodekuai', label: '跑得快' },
  { key: 'datongzi', label: '打筒子' },
  { key: 'fangpaofa', label: '娄底放炮罚' },
  { key: 'locked', label: '邵阳剥皮', locked: true },
  { key: 'locked', label: '邵阳麻将', locked: true },
  { key: 'locked', label: '红中麻将', locked: true },
];

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
        ['玩法', '15息起胡 / 10息起胡 / 可兑守 / 飘胡'],
        ['托管', `当前：${autoTrustee}`],
        ['翻倍', `少于 ${doubleThreshold} 分翻倍`],
        ['首局坐庄', dealerRule],
        ['切牌', '系统切牌'],
      ];
    }

    if (activeTab === 'datongzi') {
      return [
        ['玩法', '一炮多响 / 带 / 加锤'],
        ['吃牌', '可吃牌'],
        ['抓鸟', birdRule],
        ['明杠', '每家都出'],
        ['翻倍', `少于 ${doubleThreshold} 分翻倍`],
      ];
    }

    return [
      ['翻倍', `少于 ${doubleThreshold} 分翻倍`],
      ['托管', `当前：${autoTrustee}`],
      ['积分底分', `${baseScore} 分`],
    ];
  }, [activeTab, autoTrustee, baseScore, birdRule, dealerRule, doubleThreshold]);

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

      const nextDiamonds = Math.max(0, profile.diamonds - 2);
      await updateProfile({ diamonds: nextDiamonds });

      await supabase.from('diamond_logs').insert({
        user_id: user.id,
        amount: -2,
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
    <Modal open={open} onClose={onClose} title="创建房间" panelClassName="max-w-5xl p-0 overflow-hidden">
      <div className="flex h-[70vh] min-h-[480px] bg-white">
        <aside className="w-[150px] shrink-0 bg-slate-100 p-3">
          <div className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={`${tab.label}-${tab.key}`}
                type="button"
                onClick={() => handleTabClick(tab.key, tab.locked)}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                  !tab.locked && activeTab === tab.key
                    ? 'bg-gradient-to-r from-[#F2994A] to-[#F2C94C] text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-200'
                } ${tab.locked ? 'opacity-70' : ''}`}
              >
                <span>{tab.label}</span>
                {tab.locked ? <span>🔒</span> : null}
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-white p-6">
          <div className="grid flex-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <h4 className="text-xl font-black text-slate-900">{tabs.find((item) => item.key === activeTab)?.label}</h4>
              <p className="mt-1 text-sm text-slate-500">选择规则后即可创建房间，系统将自动扣除 2 钻石。</p>

              <div className="mt-5 space-y-3 rounded-3xl bg-slate-50 p-4">
                {configRows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm">
                    <span className="font-semibold text-slate-700">{label}</span>
                    <span className="text-right text-slate-500">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-3xl bg-[#f8fafc] p-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">积分底分</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="h-10 w-10 rounded-2xl bg-slate-200 text-xl"
                    onClick={() => setBaseScore((prev) => Math.max(0.5, Number((prev - 0.5).toFixed(1))))}
                  >
                    -
                  </button>
                  <div className="flex h-10 min-w-[88px] items-center justify-center rounded-2xl bg-white px-4 font-bold text-slate-900">
                    {baseScore}
                  </div>
                  <button
                    type="button"
                    className="h-10 w-10 rounded-2xl bg-slate-200 text-xl"
                    onClick={() => setBaseScore((prev) => Math.min(100, Number((prev + 0.5).toFixed(1))))}
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">翻倍阈值</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="h-10 w-10 rounded-2xl bg-slate-200 text-xl"
                    onClick={() => setDoubleThreshold((prev) => Math.max(10, prev - 10))}
                  >
                    -
                  </button>
                  <div className="flex h-10 min-w-[88px] items-center justify-center rounded-2xl bg-white px-4 font-bold text-slate-900">
                    {doubleThreshold}
                  </div>
                  <button
                    type="button"
                    className="h-10 w-10 rounded-2xl bg-slate-200 text-xl"
                    onClick={() => setDoubleThreshold((prev) => Math.min(100, prev + 10))}
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">托管时间</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {['无', '1分钟', '2分钟', '3分钟', '5分钟'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setAutoTrustee(item)}
                      className={`rounded-xl px-3 py-2 ${
                        autoTrustee === item ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === 'fangpaofa' ? (
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">首局坐庄</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {['随机', '房主'].map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setDealerRule(item)}
                        className={`rounded-xl px-3 py-2 ${
                          dealerRule === item ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTab === 'datongzi' ? (
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">抓鸟</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {['窝窝鸟', '2鸟', '3鸟', '4鸟', '6鸟', '8鸟'].map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setBirdRule(item)}
                        className={`rounded-xl px-3 py-2 ${
                          birdRule === item ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-200 pt-5">
            <div>
              <p className="text-sm text-slate-500">当前钻石</p>
              <p className="text-xl font-black text-slate-900">💎 {profile?.diamonds ?? 0}</p>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="h-12 rounded-2xl bg-gradient-to-r from-[#27AE60] to-[#6FCF97] px-8 text-base font-bold text-white shadow-lg"
            >
              {creating ? '创建中...' : '创建房间 💎×2'}
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
