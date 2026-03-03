'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type {
  AdminDashboardSnapshot,
  AdminUser,
  AiStrategyConfig,
  AiStrategyMode,
  EconomyLogItem,
  GameType,
  LotteryBet,
  LotteryIssue,
  ReverseLotterySuggestion,
  RiggingHandRecord,
  RiggingPlan,
} from '@/lib/admin-db';
import type { AiDecisionSummary } from '@/lib/ai-strategy';

export type AdminSection = 'overview' | 'users' | 'rigging' | 'lottery' | 'rooms' | 'reveal';

interface AdminConsoleProps {
  adminKey: string;
  section: AdminSection;
  initialData: AdminDashboardSnapshot;
  initialPreview: AiDecisionSummary;
}

const GAME_TYPES: GameType[] = ['跑得快', '打筒子', '放炮罚'];
const AI_MODES: Array<{ value: AiStrategyMode; label: string }> = [
  { value: 'balanced', label: '平衡' },
  { value: 'favor_player', label: '放水' },
  { value: 'harvest', label: '收割' },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function modeLabel(mode: AiStrategyMode) {
  return AI_MODES.find((item) => item.value === mode)?.label ?? mode;
}

function actionLabel(action: EconomyLogItem['action']) {
  if (action === 'recharge') return '充值';
  if (action === 'debit') return '扣款';
  if (action === 'gift_diamond') return '送钻石';
  if (action === 'room_create_cost') return '建房扣钻';
  return action;
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'bg-[#8f1e00] text-[#ffe8cc]'
          : 'bg-white/80 text-[#6d3200] hover:bg-[#ffe8c1]'
      }`}
    >
      {label}
    </Link>
  );
}

export default function AdminConsole({
  adminKey,
  section,
  initialData,
  initialPreview,
}: AdminConsoleProps) {
  const [data, setData] = useState<AdminDashboardSnapshot>(initialData);
  const [preview, setPreview] = useState<AiDecisionSummary>(initialPreview);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [userKeyword, setUserKeyword] = useState('');
  const [economyUserId, setEconomyUserId] = useState(initialData.users[0]?.id ?? 1);
  const [economyAmount, setEconomyAmount] = useState(100);
  const [economyNote, setEconomyNote] = useState('');

  const [strategyMode, setStrategyMode] = useState<AiStrategyMode>(initialData.aiStrategy.mode);
  const [strategyRatio, setStrategyRatio] = useState<number>(initialData.aiStrategy.waterRatio);
  const [strategyDescription, setStrategyDescription] = useState(initialData.aiStrategy.description);

  const [selectedGameType, setSelectedGameType] = useState<GameType>(initialData.selectedGameType);
  const [rigUserId, setRigUserId] = useState(initialData.users[0]?.id ?? 1);
  const [rigIssueNo, setRigIssueNo] = useState('');
  const [rigOutcome, setRigOutcome] = useState('玩家赢');
  const [rigCards, setRigCards] = useState('A♠,K♠,Q♠,J♠,10♠,9♠,8♠,7♠');
  const [rigAiMode, setRigAiMode] = useState<AiStrategyMode>(initialData.aiStrategy.mode);
  const [rigNote, setRigNote] = useState('');

  const [lotteryIssueNo, setLotteryIssueNo] = useState(initialData.lottery.latestIssue.issueNo);
  const [lotteryNumbers, setLotteryNumbers] = useState(initialData.lottery.latestIssue.numbers.join(','));
  const [lotterySpecial, setLotterySpecial] = useState(String(initialData.lottery.latestIssue.specialNumber));
  const [reverseSuggestion, setReverseSuggestion] = useState<ReverseLotterySuggestion | null>(null);

  const totalBalance = useMemo(
    () => data.users.reduce((sum, user) => sum + user.balance, 0),
    [data.users]
  );
  const totalDiamonds = useMemo(
    () => data.users.reduce((sum, user) => sum + user.diamonds, 0),
    [data.users]
  );

  const showAll = section === 'overview';
  const showUsers = showAll || section === 'users';
  const showRigging = showAll || section === 'rigging';
  const showLottery = showAll || section === 'lottery';
  const showRooms = showAll || section === 'rooms';
  const showReveal = showAll || section === 'reveal';
  const showLogs = showAll || section === 'users' || section === 'rigging';

  async function loadDashboard(gameType = selectedGameType) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin?gameType=${encodeURIComponent(gameType)}`, {
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as
        | (AdminDashboardSnapshot & { error?: string })
        | null;

      if (response.status === 401) {
        window.location.reload();
        return;
      }

      if (!response.ok || !payload) {
        setError(payload?.error ?? '加载后台数据失败');
        return;
      }

      setData(payload);
      setSelectedGameType(payload.selectedGameType);
      setLotteryIssueNo(payload.lottery.latestIssue.issueNo);
      setLotteryNumbers(payload.lottery.latestIssue.numbers.join(','));
      setLotterySpecial(String(payload.lottery.latestIssue.specialNumber));
    } catch {
      setError('加载后台数据失败');
    } finally {
      setLoading(false);
    }
  }

  async function searchUsers() {
    setError('');
    if (!userKeyword.trim()) {
      await loadDashboard();
      return;
    }

    try {
      const response = await fetch(`/api/admin/users?keyword=${encodeURIComponent(userKeyword.trim())}`);
      const payload = (await response.json().catch(() => null)) as
        | { users?: AdminUser[]; error?: string }
        | null;

      if (!response.ok || !payload?.users) {
        setError(payload?.error ?? '搜索用户失败');
        return;
      }

      const users = payload.users;
      setData((current) => ({ ...current, users }));
      if (users.length > 0) {
        setEconomyUserId(users[0].id);
        setRigUserId(users[0].id);
      }
    } catch {
      setError('搜索用户失败');
    }
  }

  async function submitEconomy(action: 'recharge' | 'debit' | 'gift_diamond') {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users/economy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: economyUserId,
          action,
          amount: economyAmount,
          note: economyNote,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { user?: AdminUser; logs?: EconomyLogItem[]; error?: string }
        | null;

      if (!response.ok || !payload?.user || !payload.logs) {
        setError(payload?.error ?? '经济操作失败');
        return;
      }

      const updatedUser = payload.user;
      const logs = payload.logs;
      setData((current) => ({
        ...current,
        users: current.users.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
        economyLogs: logs,
      }));
      setMessage(`${actionLabel(action)}成功`);
    } catch {
      setError('经济操作失败');
    } finally {
      setLoading(false);
    }
  }

  async function saveStrategy() {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await fetch('/api/admin/cards/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: strategyMode,
          waterRatio: strategyRatio,
          description: strategyDescription,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { strategy?: AiStrategyConfig; preview?: AiDecisionSummary; error?: string }
        | null;

      if (!response.ok || !payload?.strategy || !payload.preview) {
        setError(payload?.error ?? '更新 AI 策略失败');
        return;
      }

      const strategy = payload.strategy;
      const nextPreview = payload.preview;
      setData((current) => ({ ...current, aiStrategy: strategy }));
      setPreview(nextPreview);
      setRigAiMode(strategy.mode);
      setMessage('AI 策略已更新');
    } catch {
      setError('更新 AI 策略失败');
    } finally {
      setLoading(false);
    }
  }

  async function changeGameType(gameType: GameType) {
    setSelectedGameType(gameType);
    await loadDashboard(gameType);
  }

  async function saveRiggingPlan() {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await fetch('/api/admin/cards/next-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueNo: rigIssueNo,
          gameType: selectedGameType,
          userId: rigUserId,
          targetOutcome: rigOutcome,
          handCards: rigCards,
          aiMode: rigAiMode,
          note: rigNote,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { hands?: RiggingHandRecord[]; plans?: RiggingPlan[]; error?: string }
        | null;

      if (!response.ok || !payload?.hands || !payload.plans) {
        setError(payload?.error ?? '设置控牌失败');
        return;
      }

      const hands = payload.hands;
      const plans = payload.plans;
      setData((current) => ({ ...current, hands, riggingPlans: plans }));
      setMessage('下一局控牌已锁定');
    } catch {
      setError('设置控牌失败');
    } finally {
      setLoading(false);
    }
  }

  async function saveLottery() {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await fetch('/api/admin/lottery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueNo: lotteryIssueNo,
          numbers: lotteryNumbers,
          specialNumber: Number(lotterySpecial),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { issue?: LotteryIssue; issues?: LotteryIssue[]; bets?: LotteryBet[]; error?: string }
        | null;

      if (!response.ok || !payload?.issue || !payload.issues || !payload.bets) {
        setError(payload?.error ?? '保存开奖号码失败');
        return;
      }

      const issue = payload.issue;
      const issues = payload.issues;
      const bets = payload.bets;
      setData((current) => ({
        ...current,
        lottery: { latestIssue: issue, issues, bets },
      }));
      setMessage('开奖号码已更新');
    } catch {
      setError('保存开奖号码失败');
    } finally {
      setLoading(false);
    }
  }

  async function reverseGenerate(apply: boolean) {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await fetch('/api/admin/lottery/reverse-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueNo: lotteryIssueNo, apply }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            suggestion?: ReverseLotterySuggestion;
            appliedIssue?: LotteryIssue;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.suggestion) {
        setError(payload?.error ?? '反向生成失败');
        return;
      }

      const suggestion = payload.suggestion;
      setReverseSuggestion(suggestion);

      if (apply && payload.appliedIssue) {
        const issue = payload.appliedIssue;
        setLotteryIssueNo(issue.issueNo);
        setLotteryNumbers(issue.numbers.join(','));
        setLotterySpecial(String(issue.specialNumber));
        await loadDashboard();
        setMessage('反向号码已应用开奖');
      }
    } catch {
      setError('反向生成失败');
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    window.location.reload();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffe9c6_0%,#f5d29c_22%,#6b2008_78%,#2c0a04_100%)] px-4 py-6 text-[#5c3308] sm:px-6">
      <div className="mx-auto max-w-7xl rounded-3xl border border-[#f1d8a6] bg-white/90 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:p-6">
        <header className="flex flex-col gap-4 border-b border-[#f0d2a4] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#995215]">Admin Console</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#5f2a00]">恭喜发财管理后台</h1>
            <p className="mt-2 text-sm text-[#8a5d31]">入口已接到动态路由：/admin/{adminKey}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <NavLink href={`/admin/${adminKey}`} label="总览" active={section === 'overview'} />
            <NavLink href={`/admin/${adminKey}/users`} label="用户" active={section === 'users'} />
            <NavLink href={`/admin/${adminKey}/rigging`} label="控牌" active={section === 'rigging'} />
            <NavLink href={`/admin/${adminKey}/lottery`} label="六合彩" active={section === 'lottery'} />
            <NavLink href={`/admin/${adminKey}/rooms`} label="房间" active={section === 'rooms'} />
            <NavLink href={`/admin/${adminKey}/reveal`} label="揭示" active={section === 'reveal'} />
          </div>
        </header>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[#fff7e8] px-4 py-3">
              <div className="text-xs text-[#8b5d2f]">用户总数</div>
              <div className="text-2xl font-black text-[#5f2a00]">{formatNumber(data.users.length)}</div>
            </div>
            <div className="rounded-2xl bg-[#fff7e8] px-4 py-3">
              <div className="text-xs text-[#8b5d2f]">总余额</div>
              <div className="text-2xl font-black text-[#5f2a00]">{formatNumber(totalBalance)}</div>
            </div>
            <div className="rounded-2xl bg-[#fff7e8] px-4 py-3">
              <div className="text-xs text-[#8b5d2f]">总钻石</div>
              <div className="text-2xl font-black text-[#5f2a00]">{formatNumber(totalDiamonds)}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="rounded-2xl border border-[#c18745] px-4 py-2 text-sm font-semibold text-[#6d3200] transition hover:bg-[#ffe8c1]"
            >
              {loading ? '刷新中...' : '刷新'}
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-2xl bg-[#8f1e00] px-4 py-2 text-sm font-semibold text-[#ffe8cc] transition hover:bg-[#7a1900]"
            >
              退出登录
            </button>
          </div>
        </div>

        {error ? <p className="mt-4 rounded-2xl bg-[#fff1f0] px-4 py-3 text-sm text-[#b42318]">{error}</p> : null}
        {message ? (
          <p className="mt-4 rounded-2xl bg-[#ecfdf3] px-4 py-3 text-sm text-[#027a48]">{message}</p>
        ) : null}

        {showUsers ? (
          <section className="mt-6 rounded-3xl border border-[#f0d2a4] bg-white/80 p-5">
            <h2 className="text-xl font-bold text-[#5f2a00]">1. 用户管理</h2>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm text-[#6c2f00]">
                搜索用户
                <input
                  value={userKeyword}
                  onChange={(event) => setUserKeyword(event.target.value)}
                  className="mt-2 h-11 rounded-2xl border border-[#d2a15d] px-4"
                  placeholder="昵称 / 手机号 / ID"
                />
              </label>
              <button
                type="button"
                onClick={() => void searchUsers()}
                className="h-11 rounded-2xl border border-[#d2a15d] px-4 text-sm font-semibold hover:bg-[#ffe8c1]"
              >
                查询
              </button>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[220px_160px_1fr_auto]">
              <label className="text-sm text-[#6c2f00]">
                目标用户
                <select
                  value={economyUserId}
                  onChange={(event) => setEconomyUserId(Number(event.target.value))}
                  className="mt-2 h-11 w-full rounded-2xl border border-[#d2a15d] px-4"
                >
                  {data.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      #{user.id} {user.nickname}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-[#6c2f00]">
                金额/钻石
                <input
                  type="number"
                  min={1}
                  value={economyAmount}
                  onChange={(event) => setEconomyAmount(Number(event.target.value) || 0)}
                  className="mt-2 h-11 w-full rounded-2xl border border-[#d2a15d] px-4"
                />
              </label>
              <label className="text-sm text-[#6c2f00]">
                备注
                <input
                  value={economyNote}
                  onChange={(event) => setEconomyNote(event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-[#d2a15d] px-4"
                  placeholder="可选"
                />
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <button type="button" onClick={() => void submitEconomy('recharge')} className="h-11 rounded-2xl bg-[#027a48] px-4 text-sm font-semibold text-white">充值</button>
                <button type="button" onClick={() => void submitEconomy('debit')} className="h-11 rounded-2xl bg-[#b54708] px-4 text-sm font-semibold text-white">扣款</button>
                <button type="button" onClick={() => void submitEconomy('gift_diamond')} className="h-11 rounded-2xl bg-[#175cd3] px-4 text-sm font-semibold text-white">送钻石</button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#f0d2a4] text-[#8b5d2f]">
                    <th className="py-2 pr-4">ID</th>
                    <th className="py-2 pr-4">账号</th>
                    <th className="py-2 pr-4">昵称</th>
                    <th className="py-2 pr-4">手机号</th>
                    <th className="py-2 pr-4">余额</th>
                    <th className="py-2 pr-4">钻石</th>
                    <th className="py-2">更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id} className="border-b border-[#f5e3c4]">
                      <td className="py-2 pr-4">{user.id}</td>
                      <td className="py-2 pr-4">{user.username}</td>
                      <td className="py-2 pr-4">{user.nickname}</td>
                      <td className="py-2 pr-4">{user.phone}</td>
                      <td className="py-2 pr-4">{formatNumber(user.balance)}</td>
                      <td className="py-2 pr-4">{formatNumber(user.diamonds)}</td>
                      <td className="py-2">{formatTime(user.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {showRigging ? (
          <section className="mt-6 rounded-3xl border border-[#f0d2a4] bg-white/80 p-5">
            <h2 className="text-xl font-bold text-[#5f2a00]">2. 控牌面板 + AI策略</h2>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="rounded-3xl bg-[#fff7e8] p-4">
                <h3 className="text-base font-bold">AI 策略（放水 / 收割）</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    模式
                    <select
                      value={strategyMode}
                      onChange={(event) => setStrategyMode(event.target.value as AiStrategyMode)}
                      className="mt-2 h-11 w-full rounded-2xl border border-[#d2a15d] px-4"
                    >
                      {AI_MODES.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    放水比例 {strategyRatio}%
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={strategyRatio}
                      onChange={(event) => setStrategyRatio(Number(event.target.value))}
                      className="mt-4 w-full"
                    />
                  </label>
                </div>
                <label className="mt-3 block text-sm">
                  策略说明
                  <input
                    value={strategyDescription}
                    onChange={(event) => setStrategyDescription(event.target.value)}
                    className="mt-2 h-11 w-full rounded-2xl border border-[#d2a15d] px-4"
                  />
                </label>
                <div className="mt-4 rounded-2xl bg-white/90 p-4 text-sm text-[#8a5d31]">
                  <p>目标胜率：<strong className="text-[#5f2a00]">{preview.targetWinProbability}</strong></p>
                  <p>风险等级：<strong className="text-[#5f2a00]">{preview.riskLevel}</strong></p>
                  <p className="mt-2">{preview.recommendation}</p>
                </div>
                <button type="button" onClick={() => void saveStrategy()} className="mt-4 h-11 rounded-2xl bg-[#8f1e00] px-4 text-sm font-semibold text-[#ffe8cc]">保存 AI 策略</button>
              </div>

              <div className="rounded-3xl bg-[#fff7e8] p-4">
                <h3 className="text-base font-bold">设置下一局发牌结果</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    游戏类型
                    <select
                      value={selectedGameType}
                      onChange={(event) => void changeGameType(event.target.value as GameType)}
                      className="mt-2 h-11 w-full rounded-2xl border border-[#d2a15d] px-4"
                    >
                      {GAME_TYPES.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    目标用户
                    <select
                      value={rigUserId}
                      onChange={(event) => setRigUserId(Number(event.target.value))}
                      className="mt-2 h-11 w-full rounded-2xl border border-[#d2a15d] px-4"
                    >
                      {data.users.map((user) => (
                        <option key={user.id} value={user.id}>#{user.id} {user.nickname}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="text-sm">
                    期号
                    <input value={rigIssueNo} onChange={(event) => setRigIssueNo(event.target.value)} className="mt-2 h-11 w-full rounded-2xl border border-[#d2a15d] px-4" placeholder="可选" />
                  </label>
                  <label className="text-sm">
                    目标结果
                    <select value={rigOutcome} onChange={(event) => setRigOutcome(event.target.value)} className="mt-2 h-11 w-full rounded-2xl border border-[#d2a15d] px-4">
                      <option value="玩家赢">玩家赢</option>
                      <option value="玩家输">玩家输</option>
                      <option value="可疑局">可疑局</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    AI 模式
                    <select value={rigAiMode} onChange={(event) => setRigAiMode(event.target.value as AiStrategyMode)} className="mt-2 h-11 w-full rounded-2xl border border-[#d2a15d] px-4">
                      {AI_MODES.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="mt-3 block text-sm">
                  指定手牌
                  <textarea value={rigCards} onChange={(event) => setRigCards(event.target.value)} className="mt-2 h-24 w-full rounded-2xl border border-[#d2a15d] px-4 py-3" />
                </label>
                <label className="mt-3 block text-sm">
                  备注
                  <input value={rigNote} onChange={(event) => setRigNote(event.target.value)} className="mt-2 h-11 w-full rounded-2xl border border-[#d2a15d] px-4" />
                </label>
                <button type="button" onClick={() => void saveRiggingPlan()} className="mt-4 h-11 rounded-2xl bg-[#175cd3] px-4 text-sm font-semibold text-white">锁定下一局</button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <h3 className="mb-2 text-base font-bold">当前手牌（{selectedGameType}）</h3>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#f0d2a4] text-[#8b5d2f]">
                    <th className="py-2 pr-4">用户</th>
                    <th className="py-2 pr-4">手牌</th>
                    <th className="py-2">更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hands.map((row) => (
                    <tr key={`${row.userId}-${row.gameType}`} className="border-b border-[#f5e3c4]">
                      <td className="py-2 pr-4">#{row.userId} {row.userNickname}</td>
                      <td className="py-2 pr-4">{row.handCards.join(' ')}</td>
                      <td className="py-2">{formatTime(row.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 overflow-x-auto">
              <h3 className="mb-2 text-base font-bold">控牌记录</h3>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#f0d2a4] text-[#8b5d2f]">
                    <th className="py-2 pr-4">时间</th>
                    <th className="py-2 pr-4">期号</th>
                    <th className="py-2 pr-4">用户</th>
                    <th className="py-2 pr-4">策略</th>
                    <th className="py-2 pr-4">结果</th>
                    <th className="py-2">手牌</th>
                  </tr>
                </thead>
                <tbody>
                  {data.riggingPlans.map((row) => (
                    <tr key={row.id} className="border-b border-[#f5e3c4]">
                      <td className="py-2 pr-4">{formatTime(row.createdAt)}</td>
                      <td className="py-2 pr-4">{row.issueNo}</td>
                      <td className="py-2 pr-4">#{row.userId} {row.userNickname}</td>
                      <td className="py-2 pr-4">{modeLabel(row.aiMode)}</td>
                      <td className="py-2 pr-4">{row.targetOutcome}</td>
                      <td className="py-2">{row.handCards.join(' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {showLottery ? (
          <section className="mt-6 rounded-3xl border border-[#f0d2a4] bg-white/80 p-5">
            <h2 className="text-xl font-bold text-[#5f2a00]">3. 六合彩管理</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr_160px_auto]">
              <label className="text-sm">
                期号
                <input value={lotteryIssueNo} onChange={(event) => setLotteryIssueNo(event.target.value)} className="mt-2 h-11 w-full rounded-2xl border border-[#d2a15d] px-4" />
              </label>
              <label className="text-sm">
                开奖号码（6个）
                <input value={lotteryNumbers} onChange={(event) => setLotteryNumbers(event.target.value)} className="mt-2 h-11 w-full rounded-2xl border border-[#d2a15d] px-4" />
              </label>
              <label className="text-sm">
                特别号
                <input value={lotterySpecial} onChange={(event) => setLotterySpecial(event.target.value)} className="mt-2 h-11 w-full rounded-2xl border border-[#d2a15d] px-4" />
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <button type="button" onClick={() => void saveLottery()} className="h-11 rounded-2xl bg-[#8f1e00] px-4 text-sm font-semibold text-[#ffe8cc]">保存开奖</button>
                <button type="button" onClick={() => void reverseGenerate(false)} className="h-11 rounded-2xl bg-[#444ce7] px-4 text-sm font-semibold text-white">反向生成</button>
                <button type="button" onClick={() => void reverseGenerate(true)} className="h-11 rounded-2xl bg-[#5925dc] px-4 text-sm font-semibold text-white">直接开奖</button>
              </div>
            </div>

            {reverseSuggestion ? (
              <div className="mt-4 rounded-2xl bg-[#f4f3ff] p-4 text-sm text-[#42307d]">
                <p>推荐号码：{reverseSuggestion.numbers.join(',')} + 特别号 {reverseSuggestion.specialNumber}</p>
                <p>预计赔付：{formatNumber(reverseSuggestion.expectedPayout)} / 总投注：{formatNumber(reverseSuggestion.totalBetAmount)}</p>
                <p>规避高风险号：{reverseSuggestion.avoidedHighRiskNumbers.join(',')}</p>
                <p className="mt-1">{reverseSuggestion.notes}</p>
              </div>
            ) : null}

            <div className="mt-5 overflow-x-auto">
              <h3 className="mb-2 text-base font-bold">投注详情</h3>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#f0d2a4] text-[#8b5d2f]">
                    <th className="py-2 pr-4">时间</th>
                    <th className="py-2 pr-4">用户</th>
                    <th className="py-2 pr-4">玩法</th>
                    <th className="py-2 pr-4">投注值</th>
                    <th className="py-2 pr-4">金额</th>
                    <th className="py-2 pr-4">赔率</th>
                    <th className="py-2">潜在赔付</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lottery.bets.map((bet) => (
                    <tr key={bet.id} className="border-b border-[#f5e3c4]">
                      <td className="py-2 pr-4">{formatTime(bet.createdAt)}</td>
                      <td className="py-2 pr-4">#{bet.userId} {bet.userNickname}</td>
                      <td className="py-2 pr-4">{bet.betType === 'number' ? '正码' : '特别号'}</td>
                      <td className="py-2 pr-4">{bet.betValue}</td>
                      <td className="py-2 pr-4">{formatNumber(bet.amount)}</td>
                      <td className="py-2 pr-4">{bet.odds}</td>
                      <td className="py-2">{formatNumber(bet.potentialPayout)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {showRooms ? (
          <section className="mt-6 rounded-3xl border border-[#f0d2a4] bg-white/80 p-5">
            <h2 className="text-xl font-bold text-[#5f2a00]">4. 房间概览</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#f0d2a4] text-[#8b5d2f]">
                    <th className="py-2 pr-4">房号</th>
                    <th className="py-2 pr-4">玩法</th>
                    <th className="py-2 pr-4">真人</th>
                    <th className="py-2 pr-4">AI</th>
                    <th className="py-2 pr-4">房费</th>
                    <th className="py-2 pr-4">状态</th>
                    <th className="py-2">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rooms.map((room) => (
                    <tr key={room.id} className="border-b border-[#f5e3c4]">
                      <td className="py-2 pr-4">{room.roomCode}</td>
                      <td className="py-2 pr-4">{room.gameType}</td>
                      <td className="py-2 pr-4">{room.humanPlayers}</td>
                      <td className="py-2 pr-4">{room.aiRobots}</td>
                      <td className="py-2 pr-4">{room.diamondCost}</td>
                      <td className="py-2 pr-4">{room.status}</td>
                      <td className="py-2">{formatTime(room.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {showReveal ? (
          <section className="mt-6 rounded-3xl border border-[#f0d2a4] bg-white/80 p-5">
            <h2 className="text-xl font-bold text-[#5f2a00]">5. 揭示系统</h2>
            <div className="mt-4 rounded-2xl bg-[#fff7e8] p-4 text-sm text-[#8a5d31]">
              当前路由已保留，后台导航已打通。揭示系统细化逻辑可在下一阶段继续接入实时触发与前端弹层联动。
            </div>
          </section>
        ) : null}

        {showLogs ? (
          <section className="mt-6 rounded-3xl border border-[#f0d2a4] bg-white/80 p-5">
            <h2 className="text-xl font-bold text-[#5f2a00]">经济操作日志</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#f0d2a4] text-[#8b5d2f]">
                    <th className="py-2 pr-4">时间</th>
                    <th className="py-2 pr-4">操作</th>
                    <th className="py-2 pr-4">用户</th>
                    <th className="py-2 pr-4">余额变化</th>
                    <th className="py-2 pr-4">钻石变化</th>
                    <th className="py-2 pr-4">前后余额</th>
                    <th className="py-2 pr-4">前后钻石</th>
                    <th className="py-2">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {data.economyLogs.map((log) => (
                    <tr key={log.id} className="border-b border-[#f5e3c4]">
                      <td className="py-2 pr-4">{formatTime(log.createdAt)}</td>
                      <td className="py-2 pr-4">{actionLabel(log.action)}</td>
                      <td className="py-2 pr-4">#{log.userId} {log.userNickname}</td>
                      <td className="py-2 pr-4">{log.amount === 0 ? '0' : `${log.action === 'debit' ? '-' : '+'}${formatNumber(log.amount)}`}</td>
                      <td className="py-2 pr-4">{log.diamondsChange === 0 ? '0' : `${log.diamondsChange > 0 ? '+' : ''}${formatNumber(log.diamondsChange)}`}</td>
                      <td className="py-2 pr-4">{formatNumber(log.beforeBalance)} {'->'} {formatNumber(log.afterBalance)}</td>
                      <td className="py-2 pr-4">{formatNumber(log.beforeDiamonds)} {'->'} {formatNumber(log.afterDiamonds)}</td>
                      <td className="py-2">{log.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
