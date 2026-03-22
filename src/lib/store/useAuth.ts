import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

export interface Profile {
  id: string;
  username: string;
  nickname: string;
  avatar_url: string | null;
  balance: number;
  diamonds: number;
  is_admin: boolean;
  is_banned: boolean;
  created_at: string;
  last_online: string | null;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isGuest: boolean;
  initialized: boolean;
  setGuest: (guest: boolean) => void;
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

interface SupabaseAuthSettings {
  external?: {
    email?: boolean;
  };
  disable_signup?: boolean;
  mailer_autoconfirm?: boolean;
}

const setGuestStorage = (guest: boolean) => {
  if (typeof window === 'undefined') return;

  localStorage.setItem('guest', guest ? 'true' : 'false');
  const maxAge = guest ? 60 * 60 * 24 * 30 : 0;
  document.cookie = `guest_mode=${guest ? '1' : '0'}; path=/; max-age=${maxAge}; SameSite=Lax`;
};

const toProfile = (row: Record<string, unknown>): Profile => ({
  id: String(row.id ?? ''),
  username: String(row.username ?? ''),
  nickname: String(row.nickname ?? '新玩家'),
  avatar_url: (row.avatar_url as string | null) ?? null,
  balance: Number(row.balance ?? 0),
  diamonds: Number(row.diamonds ?? 0),
  is_admin: Boolean(row.is_admin ?? false),
  is_banned: Boolean(row.is_banned ?? false),
  created_at: String(row.created_at ?? ''),
  last_online: (row.last_online as string | null) ?? null,
});

async function readAuthSettings(): Promise<SupabaseAuthSettings | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as SupabaseAuthSettings;
  } catch {
    return null;
  }
}

function normalizeAuthError(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes('load failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('networkerror') ||
    lower.includes('fetch failed')
  ) {
    return '当前账号服务连接失败。已确认线上配置指向的 Supabase 地址不可达，请更新 Supabase 项目 URL 和 Key 后再试。';
  }

  if (lower.includes('email not confirmed')) {
    return '当前 Supabase 已开启邮箱确认。请先在 Supabase 后台关闭 Confirm email（邮箱确认）后再试。';
  }

  if (lower.includes('email logins are disabled')) {
    return '当前 Supabase 未开启邮箱登录。请先在 Supabase 后台开启 Email 登录。';
  }

  if (lower.includes('signups not allowed') || lower.includes('signup is disabled')) {
    return '当前 Supabase 已禁用注册。请先在 Supabase 后台开启注册功能。';
  }

  if (lower.includes('invalid login credentials')) {
    return '账号或密码错误';
  }

  return message;
}

async function ensureAuthFlowReady(mode: 'login' | 'register') {
  const settings = await readAuthSettings();

  if (!settings) {
    return;
  }

  if (settings.external?.email === false) {
    throw new Error('当前 Supabase 未开启 Email 登录。请先在 Supabase 后台打开 Email 登录开关。');
  }

  if (mode === 'register' && settings.disable_signup) {
    throw new Error('当前 Supabase 已关闭注册。请先在后台打开注册功能。');
  }

  if (mode === 'register' && settings.mailer_autoconfirm === false) {
    throw new Error(
      '当前 Supabase 开启了邮箱确认。由于本项目使用用户名映射假邮箱注册，必须先关闭 Confirm email（邮箱确认）才能自动登录。'
    );
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isGuest: false,
  initialized: false,

  setGuest: (guest) => {
    setGuestStorage(guest);
    set({ isGuest: guest });
  },

  initialize: async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setGuestStorage(false);
        set({ user: session.user, isGuest: false, initialized: true });
        await get().refreshProfile();
        return;
      }

      const guest = typeof window !== 'undefined' && localStorage.getItem('guest') === 'true';
      set({ user: null, profile: null, isGuest: guest, initialized: true });
    } catch {
      const guest = typeof window !== 'undefined' && localStorage.getItem('guest') === 'true';
      set({ user: null, profile: null, isGuest: guest, initialized: true });
    }
  },

  login: async (username, password) => {
    await ensureAuthFlowReady('login');

    const email = `${username.trim()}@gxfc.app`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      throw new Error(normalizeAuthError(error?.message ?? '账号或密码错误'));
    }

    setGuestStorage(false);
    set({ user: data.user, isGuest: false });
    await get().refreshProfile();
  },

  register: async (username, password, nickname) => {
    await ensureAuthFlowReady('register');

    const cleanUsername = username.trim();
    const cleanNickname = nickname.trim() || '新玩家';
    const email = `${cleanUsername}@gxfc.app`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: cleanUsername,
          nickname: cleanNickname,
        },
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes('already')) {
        throw new Error('该用户名已被注册');
      }
      throw new Error(normalizeAuthError(error.message || '注册失败，请稍后重试'));
    }

    if (!data.session) {
      throw new Error(
        '当前注册未返回会话。请在 Supabase 后台关闭 Confirm email（邮箱确认）后，再重新注册。'
      );
    }

    // 尝试自动登录，确保注册后立即可进入大厅
    const signInResult = await supabase.auth.signInWithPassword({ email, password });

    if (signInResult.error || !signInResult.data.user) {
      throw new Error(normalizeAuthError(signInResult.error?.message ?? '注册成功，但自动登录失败'));
    }

    setGuestStorage(false);
    set({ user: signInResult.data.user, isGuest: false });

    // 触发器未配置时尝试补写 profile，避免页面空数据
    await supabase.from('profiles').upsert(
      {
        id: signInResult.data.user.id,
        username: cleanUsername,
        nickname: cleanNickname,
      },
      {
        onConflict: 'id',
        ignoreDuplicates: false,
      }
    );

    await get().refreshProfile();
  },

  logout: async () => {
    await supabase.auth.signOut();
    setGuestStorage(false);
    set({ user: null, profile: null, isGuest: false });
  },

  refreshProfile: async () => {
    const currentUser = get().user;

    if (!currentUser) {
      set({ profile: null });
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (error || !data) {
      const fallbackProfile: Profile = {
        id: currentUser.id,
        username:
          (currentUser.user_metadata?.username as string | undefined) ??
          currentUser.email?.split('@')[0] ??
          'guest',
        nickname: (currentUser.user_metadata?.nickname as string | undefined) ?? '新玩家',
        avatar_url: '/assets/avatars/default.png',
        balance: 1000,
        diamonds: 10,
        is_admin: false,
        is_banned: false,
        created_at: new Date().toISOString(),
        last_online: new Date().toISOString(),
      };

      set({ profile: fallbackProfile });

      await supabase.from('profiles').upsert(
        {
          id: fallbackProfile.id,
          username: fallbackProfile.username,
          nickname: fallbackProfile.nickname,
          avatar_url: fallbackProfile.avatar_url,
          balance: fallbackProfile.balance,
          diamonds: fallbackProfile.diamonds,
        },
        {
          onConflict: 'id',
          ignoreDuplicates: false,
        }
      );

      return;
    }

    set({ profile: toProfile(data as Record<string, unknown>) });
  },

  updateProfile: async (updates) => {
    const currentProfile = get().profile;

    if (!currentProfile) {
      return;
    }

    const nextProfile = {
      ...currentProfile,
      ...updates,
    };

    set({ profile: nextProfile });

    if (!get().user) {
      return;
    }

    await supabase
      .from('profiles')
      .update({
        nickname: nextProfile.nickname,
        avatar_url: nextProfile.avatar_url,
        balance: nextProfile.balance,
        diamonds: nextProfile.diamonds,
        last_online: new Date().toISOString(),
      })
      .eq('id', nextProfile.id);
  },
}));
