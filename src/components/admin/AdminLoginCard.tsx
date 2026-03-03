'use client';

import { FormEvent, useState } from 'react';

interface AdminLoginCardProps {
  title?: string;
  subtitle?: string;
}

export default function AdminLoginCard({
  title = '后台鉴权',
  subtitle = '请输入管理密码后进入管理后台。',
}: AdminLoginCardProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? '登录失败');
        return;
      }

      window.location.reload();
    } catch {
      setError('网络异常，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-[#ecc588] bg-white/95 p-6 text-[#5f2a00] shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
      <p className="text-xs uppercase tracking-[0.25em] text-[#aa6a1f]">Admin Access</p>
      <h1 className="mt-2 text-2xl font-black">{title}</h1>
      <p className="mt-2 text-sm text-[#8a5d31]">{subtitle}</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-[#6b3707]">
          管理密码
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-[#d7a760] px-4 outline-none transition focus:border-[#8f1e00]"
            placeholder="输入管理员密码"
            required
          />
        </label>

        {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-2xl bg-[#8f1e00] text-base font-semibold text-[#ffe8cc] transition hover:bg-[#7a1900] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? '登录中...' : '进入后台'}
        </button>
      </form>
    </div>
  );
}
