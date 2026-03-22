'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/useAuth';
import { useToastStore } from '@/lib/store/useToast';

export default function LoginPage() {
  const router = useRouter();
  const pushToast = useToastStore((state) => state.push);
  const login = useAuthStore((state) => state.login);
  const setGuest = useAuthStore((state) => state.setGuest);
  const user = useAuthStore((state) => state.user);
  const initialized = useAuthStore((state) => state.initialized);

  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const rememberedUsername = localStorage.getItem('remembered_username');
    if (rememberedUsername) {
      setUsername(rememberedUsername);
    }
  }, []);

  useEffect(() => {
    if (initialized && user) {
      router.replace('/lobby');
    }
  }, [initialized, router, user]);

  const handleGuestEnter = () => {
    setGuest(true);
    router.push('/lobby');
  };

  const handleLogin = async () => {
    if (loading) {
      return;
    }

    if (!username.trim() || !password.trim()) {
      pushToast('请输入账号和密码', 'error');
      return;
    }

    setLoading(true);

    try {
      await login(username, password);

      if (remember) {
        localStorage.setItem('remembered_username', username.trim());
      } else {
        localStorage.removeItem('remembered_username');
      }

      pushToast('登录成功', 'success');
      router.push('/lobby');
    } catch (error) {
      const message = error instanceof Error ? error.message : '账号或密码错误';
      pushToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-gradient-to-br from-[#0a1f0d] to-[#1a3a20] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(60,110,56,0.18)_0%,_rgba(10,31,13,0)_46%)]" />
      <div className="absolute inset-x-[-10%] bottom-[20%] h-[24%] rounded-[50%] bg-[#15311b]/80" />
      <div className="absolute inset-x-[-12%] bottom-[10%] h-[18%] rounded-[50%] bg-[#0d2413]/90" />

      <main className="relative z-10 mx-auto flex h-screen w-full max-w-5xl flex-col items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-[42px] font-black tracking-[0.35rem] text-yellow-400 drop-shadow-lg sm:text-[52px]">
            恭喜发财
          </h1>
          <p className="mt-3 text-sm tracking-[0.22rem] text-yellow-200/70 sm:text-base">
            财运当头 好牌在手
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="w-[220px] rounded-xl border border-yellow-700/50 bg-yellow-600 px-6 py-4 text-base font-bold text-black shadow-lg transition hover:bg-yellow-500"
          >
            📱 账号登录
          </button>

          <button
            type="button"
            onClick={handleGuestEnter}
            className="w-[220px] rounded-xl border border-yellow-700/50 bg-transparent px-6 py-4 text-base font-semibold text-yellow-400 transition hover:bg-yellow-900/20"
          >
            💬 游客登录
          </button>
        </div>

        <div className="mt-12 space-y-2 text-center text-xs text-yellow-200/60">
          <p>登记号：2018SR038573 | 运营单位：恭喜发财网络科技有限公司</p>
          <p>抵制不良游戏，拒绝盗版游戏。适度游戏益脑，沉迷游戏伤身。</p>
        </div>
      </main>

      {showModal ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="absolute inset-0 h-full w-full bg-black/70"
            aria-label="关闭弹窗"
          />

          <div className="relative z-10 flex h-full items-center justify-center p-4">
            <div className="w-full max-w-[420px] rounded-xl border border-yellow-700/50 bg-black/50 p-6 text-white shadow-2xl backdrop-blur-sm">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-xl font-bold text-yellow-300">账号登录</h3>
                <button
                  type="button"
                  className="rounded-full p-2 text-yellow-300/80 transition hover:bg-yellow-900/20 hover:text-yellow-200"
                  onClick={() => setShowModal(false)}
                  aria-label="关闭"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm text-yellow-200/70">👤 账号</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="请输入账号"
                    className="h-12 w-full rounded-xl border border-yellow-700/40 bg-black/30 px-3 text-base text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-yellow-200/70">🔒 密码</span>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="请输入密码"
                      className="h-12 w-full rounded-xl border border-yellow-700/40 bg-black/30 px-3 pr-12 text-base text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-500"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-yellow-300/80"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? '🙈' : '👁'}
                    </button>
                  </div>
                </label>

                <div className="flex items-center justify-between text-sm text-yellow-200/70">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-yellow-500"
                      checked={remember}
                      onChange={(event) => setRemember(event.target.checked)}
                    />
                    记住密码
                  </label>

                  <button
                    type="button"
                    className="text-yellow-400"
                    onClick={() => pushToast('请联系管理员', 'info')}
                  >
                    忘记密码？
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={loading}
                  className="h-12 w-full rounded-xl bg-yellow-600 text-lg font-bold text-black shadow-lg transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? '登录中...' : '登 录'}
                </button>

                <p className="text-center text-sm text-yellow-200/60">
                  还没有账号？
                  <button
                    type="button"
                    className="ml-1 text-yellow-400"
                    onClick={() => {
                      setShowModal(false);
                      router.push('/register');
                    }}
                  >
                    立即注册
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
