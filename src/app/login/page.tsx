'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GameBackground from '@/components/layout/GameBackground';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
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
    <GameBackground>
      <main className="mx-auto flex h-full w-full max-w-5xl flex-col items-center justify-center px-6">
        <h1 className="brand-gold-text text-[42px] font-black tracking-[0.35rem] sm:text-[48px]">恭喜发财</h1>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
          <Button variant="gold" className="w-[200px]" onClick={() => setShowModal(true)}>
            📱 账号登录
          </Button>

          <Button variant="green" className="w-[200px]" onClick={handleGuestEnter}>
            💬 游客体验
          </Button>
        </div>

        <div className="mt-12 space-y-2 text-center text-xs text-white/70">
          <p>登记号：2018SR038573 | 运营单位：恭喜发财网络科技有限公司</p>
          <p>抵制不良游戏，拒绝盗版游戏。适度游戏益脑，沉迷游戏伤身。</p>
        </div>
      </main>

      <Modal open={showModal} title="账号登录" onClose={() => setShowModal(false)}>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-gray-600">👤 账号</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="请输入账号"
              className="h-12 w-full rounded-xl border border-gray-200 px-3 text-base outline-none transition focus:border-gold"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-gray-600">🔒 密码</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
                className="h-12 w-full rounded-xl border border-gray-200 px-3 pr-12 text-base outline-none transition focus:border-gold"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-gray-500"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </label>

          <div className="flex items-center justify-between text-sm text-gray-600">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              记住密码
            </label>

            <button
              type="button"
              className="text-[#4A90D9]"
              onClick={() => pushToast('请联系管理员', 'info')}
            >
              忘记密码？
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-[#F2994A] to-[#F2C94C] text-lg font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '登录中...' : '登 录'}
          </button>

          <p className="text-center text-sm text-gray-500">
            还没有账号？
            <button
              type="button"
              className="ml-1 text-[#4A90D9]"
              onClick={() => {
                setShowModal(false);
                router.push('/register');
              }}
            >
              立即注册
            </button>
          </p>
        </div>
      </Modal>
    </GameBackground>
  );
}
