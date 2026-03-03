-- 恭喜发财 Phase 0 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  nickname TEXT NOT NULL DEFAULT '新玩家',
  avatar_url TEXT DEFAULT '/assets/avatars/default.png',
  balance DECIMAL(12,2) NOT NULL DEFAULT 1000.00,
  diamonds INT NOT NULL DEFAULT 10,
  is_admin BOOLEAN DEFAULT false,
  is_banned BOOLEAN DEFAULT false,
  last_online TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT UNIQUE NOT NULL,
  game_type TEXT NOT NULL CHECK (game_type IN ('fangpaofa', 'paodekuai', 'datongzi')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished', 'dissolved')),
  config JSONB NOT NULL DEFAULT '{}',
  host_id UUID REFERENCES public.profiles(id),
  diamond_cost INT NOT NULL DEFAULT 2,
  rake_percent DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  max_players INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  seat_index INT NOT NULL,
  is_ready BOOLEAN DEFAULT false,
  is_bot BOOLEAN DEFAULT false,
  bot_name TEXT,
  bot_avatar TEXT,
  score DECIMAL(12,2) DEFAULT 0,
  UNIQUE(room_id, seat_index)
);

CREATE TABLE IF NOT EXISTS public.game_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id),
  round_number INT NOT NULL DEFAULT 1,
  state JSONB DEFAULT '{}',
  result JSONB DEFAULT '{}',
  winner_id UUID,
  is_rigged BOOLEAN DEFAULT false,
  rigged_config JSONB,
  rake_amount DECIMAL(12,2) DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.lottery_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT UNIQUE NOT NULL,
  draw_time TIMESTAMPTZ NOT NULL,
  numbers INT[] DEFAULT '{}',
  special INT,
  status TEXT DEFAULT 'betting' CHECK (status IN ('betting', 'closed', 'drawing', 'finished')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lottery_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  draw_id UUID NOT NULL REFERENCES public.lottery_draws(id),
  bet_type TEXT NOT NULL,
  bet_content JSONB NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  odds DECIMAL(8,3) NOT NULL,
  result TEXT DEFAULT 'pending' CHECK (result IN ('pending', 'win', 'lose')),
  payout DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.balance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'admin_topup', 'admin_deduct',
    'game_win', 'game_lose', 'game_rake',
    'lottery_bet', 'lottery_win',
    'diamond_purchase', 'room_create'
  )),
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.diamond_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  amount INT NOT NULL,
  diamonds_after INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('admin_grant', 'room_create', 'daily_signin', 'purchase')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.platform_settings (key, value)
VALUES
  ('rake_percent', '{"default": 5, "fangpaofa": 5, "paodekuai": 5, "datongzi": 5}'),
  ('diamond_cost', '{"create_room": 2}'),
  ('lottery_schedule', '{"draw_time": "21:35:00", "close_before_minutes": 5}'),
  ('admin_key', '"gxfc2026"')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Auth users can create rooms" ON public.rooms;
DROP POLICY IF EXISTS "Hosts can update own rooms" ON public.rooms;
DROP POLICY IF EXISTS "Anyone can view room players" ON public.room_players;
DROP POLICY IF EXISTS "Users can join room players" ON public.room_players;
DROP POLICY IF EXISTS "Users can update own room player" ON public.room_players;
DROP POLICY IF EXISTS "Users can delete own room player" ON public.room_players;
DROP POLICY IF EXISTS "Users can view own bets" ON public.lottery_bets;
DROP POLICY IF EXISTS "Users can place bets" ON public.lottery_bets;
DROP POLICY IF EXISTS "Anyone can view draws" ON public.lottery_draws;
DROP POLICY IF EXISTS "Users can view own balance logs" ON public.balance_logs;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Auth users can create rooms" ON public.rooms FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Hosts can update own rooms" ON public.rooms FOR UPDATE USING (auth.uid() = host_id) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can view room players" ON public.room_players FOR SELECT USING (true);
CREATE POLICY "Users can join room players" ON public.room_players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own room player" ON public.room_players FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own room player" ON public.room_players FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own bets" ON public.lottery_bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can place bets" ON public.lottery_bets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view draws" ON public.lottery_draws FOR SELECT USING (true);
CREATE POLICY "Users can view own balance logs" ON public.balance_logs FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, nickname)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.raw_user_meta_data->>'nickname', '新玩家')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
