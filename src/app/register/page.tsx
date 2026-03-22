'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/useAuth';
import { useToastStore } from '@/lib/store/useToast';

const usernameRegex = /^[A-Za-z0-9_]{3,16}$/;
const nicknameRegex = /^[\u4e00-\u9fa5A-Za-z0-9_]{2,8}$/;

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const pushToast = useToastStore((state) => state.push);

  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('新玩家');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    if (!usernameRegex.test(username)) {
      pushToast('用户名需为3-16位字母数字下划线', 'error');
      return;
    }

    if (password.length < 6) {
      pushToast('密码至少6位', 'error');
      return;
    }

    if (password !== confirmPassword) {
      pushToast('两次输入的密码不一致', 'error');
      return;
    }

    if (!nicknameRegex.test(nickname)) {
      pushToast('昵称需为2-8位中文或字母数字', 'error');
      return;
    }

    setLoading(true);

    try {
      await register(username, password, nickname);

      // 预留邀请码逻辑，当前仅做留存
      if (inviteCode.trim()) {
        localStorage.setItem('gxfc_invite_code', inviteCode.trim());
      }

      pushToast('注册成功，欢迎进入大厅', 'success');
      router.push('/lobby');
    } catch (error) {
      const message = error instanceof Error ? error.message : '注册失败，请稍后再试';
      pushToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-[#0a1f0d] to-[#1a3a20] px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[420px] flex-col justify-center">
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="mb-4 w-fit text-sm text-yellow-400/70"
        >
          ← 返回登录
        </button>

        <form
          onSubmit={handleSubmit}
          className="w-full rounded-xl border border-yellow-700/50 bg-black/50 p-6 text-white shadow-2xl backdrop-blur"
        >
          <h1 className="mb-6 text-center text-2xl font-black text-yellow-300">注册账号</h1>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-yellow-100/80">用户名</span>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-11 w-full rounded-xl border border-yellow-700/40 bg-black/30 px-3 text-white outline-none transition focus:border-yellow-500"
                placeholder="3-16位字母数字下划线"
                autoComplete="off"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-yellow-100/80">昵称</span>
              <input
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="h-11 w-full rounded-xl border border-yellow-700/40 bg-black/30 px-3 text-white outline-none transition focus:border-yellow-500"
                placeholder="2-8位中文或字母"
                autoComplete="off"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-yellow-100/80">密码</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-xl border border-yellow-700/40 bg-black/30 px-3 text-white outline-none transition focus:border-yellow-500"
                placeholder="至少6位"
                autoComplete="new-password"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-yellow-100/80">确认密码</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-11 w-full rounded-xl border border-yellow-700/40 bg-black/30 px-3 text-white outline-none transition focus:border-yellow-500"
                placeholder="请再次输入密码"
                autoComplete="new-password"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-yellow-100/80">邀请码（可选）</span>
              <input
                type="text"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                className="h-11 w-full rounded-xl border border-yellow-700/40 bg-black/30 px-3 text-white outline-none transition focus:border-yellow-500"
                placeholder="不填也可注册"
                autoComplete="off"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 h-12 w-full rounded-xl bg-yellow-600 font-bold text-black transition hover:bg-yellow-500 disabled:opacity-60"
          >
            {loading ? '注册中...' : '注 册'}
          </button>

          <p className="mt-4 text-center text-sm text-gray-400">
            已有账号？
            <button type="button" className="ml-1 text-yellow-400" onClick={() => router.push('/login')}>
              去登录
            </button>
          </p>
        </form>
      </div>
    </main>
  );
}
