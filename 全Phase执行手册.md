# 恭喜发财 — 全Phase执行Prompt手册
# 配合 PRD v1.0 使用 | 交给 TRAE / Codex / Claude Code 执行

> **重要修正（PRD v1.1补丁）：**
> - 钻石消耗：创建房间真扣钻石，余额不足不能创建
> - 抽水系统：每局结算时平台抽水5%（可配置），从赢家收益中扣除
> - 六合彩抽水：内置于赔率中（赔率已低于真实概率）
> - 所有经济行为真实发生，余额实时变动，日志全记录
> - 管理后台可调抽水比例、可给用户充值/扣款

---

# ═══════════════════════════════════════
# PHASE 0：项目初始化 + 基础架构
# ═══════════════════════════════════════

## 你先手动做（不需要AI）：

1. 注册 GitHub → 创建仓库 `gxfc-app`（公开或私有都行）
2. 注册 Supabase（https://supabase.com）→ New Project
   - 项目名：gxfc
   - 密码：记好
   - 地区：选 Northeast Asia (Tokyo) 或 Southeast Asia (Singapore)
   - 创建后复制：Project URL + anon public key
3. 注册 Vercel（https://vercel.com）→ 用GitHub登录 → Import `gxfc-app` 仓库

## 粘贴给TRAE的Prompt：

```
你是一个全栈工程师。现在从零创建"恭喜发财"棋牌平台项目。

## 项目创建

npx create-next-app@14 gxfc-app --typescript --tailwind --app --src-dir --import-alias "@/*"
cd gxfc-app

## 安装依赖

npm install @supabase/supabase-js @supabase/ssr
npm install next-pwa
npm install zustand          # 全局状态管理
npm install framer-motion    # 动画
npm install uuid             # 生成房间号等

## 环境变量

创建 .env.local：
NEXT_PUBLIC_SUPABASE_URL=你的supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon_key
SUPABASE_SERVICE_ROLE_KEY=你的service_role_key

创建 .env.example（不含真实值，提交到git）：
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

## 目录结构

src/
├── app/
│   ├── layout.tsx              # 根布局
│   ├── page.tsx                # 重定向到/splash
│   ├── splash/page.tsx         # 启动页（Phase 1）
│   ├── login/page.tsx          # 登录页（Phase 1）
│   ├── register/page.tsx       # 注册页（Phase 1）
│   ├── lobby/page.tsx          # 主大厅（Phase 2）
│   ├── club/page.tsx           # 亲友圈（Phase 2）
│   ├── hall/page.tsx           # 房间大厅（Phase 2）
│   ├── room/[id]/page.tsx      # 牌桌（Phase 3-6）
│   ├── lottery/page.tsx        # 六合彩（Phase 7）
│   ├── profile/page.tsx        # 个人中心
│   ├── admin/
│   │   └── [key]/
│   │       ├── page.tsx        # 管理后台仪表盘
│   │       ├── users/page.tsx
│   │       ├── rooms/page.tsx
│   │       ├── rigging/page.tsx
│   │       ├── lottery/page.tsx
│   │       └── reveal/page.tsx
│   └── api/
│       ├── auth/route.ts
│       ├── game/route.ts
│       ├── lottery/route.ts
│       └── admin/route.ts
├── components/
│   ├── ui/                     # 通用UI组件
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   ├── Loading.tsx
│   │   └── LandscapeGuard.tsx  # 横屏检测守卫
│   ├── game/                   # 游戏组件
│   │   ├── CardTile.tsx        # 字牌组件
│   │   ├── PokerCard.tsx       # 扑克牌组件
│   │   ├── ScoreTable.tsx      # 积分表
│   │   ├── PlayerSeat.tsx      # 玩家座位
│   │   └── GameActions.tsx     # 操作按钮栏
│   ├── lottery/                # 六合彩组件
│   │   ├── BallNumber.tsx      # 号码球
│   │   ├── CountdownTimer.tsx  # 倒计时器
│   │   ├── BetPanel.tsx        # 投注面板
│   │   └── DrawHistory.tsx     # 开奖历史
│   └── layout/
│       ├── GameBackground.tsx  # 山水画背景
│       └── Header.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # 浏览器端Supabase客户端
│   │   ├── server.ts           # 服务端Supabase客户端
│   │   └── middleware.ts       # Auth中间件
│   ├── games/
│   │   ├── fangpaofa/          # 放炮罚
│   │   │   ├── algorithm/      # 从qipai_algorithm复制的胡牌算法
│   │   │   ├── rules.ts        # 娄底放炮罚规则
│   │   │   ├── engine.ts       # 游戏引擎
│   │   │   └── ai.ts           # AI出牌
│   │   ├── paodekuai/          # 跑得快
│   │   │   ├── rules.ts
│   │   │   ├── engine.ts
│   │   │   └── ai.ts
│   │   └── datongzi/           # 打筒子
│   │       ├── rules.ts
│   │       ├── engine.ts
│   │       └── ai.ts
│   ├── economy/
│   │   ├── balance.ts          # 余额操作（充值/扣款/抽水）
│   │   ├── diamond.ts          # 钻石操作
│   │   └── rake.ts             # 抽水计算
│   ├── bot/
│   │   ├── names.ts            # 随机昵称库
│   │   ├── avatars.ts          # 头像列表
│   │   └── behavior.ts         # AI行为控制
│   └── store/
│       ├── useAuth.ts          # 用户状态
│       ├── useGame.ts          # 游戏状态
│       └── useLottery.ts       # 六合彩状态
├── styles/
│   └── globals.css             # Tailwind + 自定义样式
└── public/
    ├── manifest.json
    ├── sw.js                   # Service Worker
    ├── icons/
    │   ├── icon-192.png
    │   └── icon-512.png
    └── assets/
        ├── avatars/            # 预设头像（20-30个）
        └── cards/              # 牌面素材

## PWA配置

manifest.json:
{
  "name": "恭喜发财",
  "short_name": "恭喜发财",
  "description": "财运当头 好牌在手",
  "start_url": "/splash",
  "display": "standalone",
  "orientation": "landscape",
  "theme_color": "#1a6b3c",
  "background_color": "#0d4a2a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}

## next.config.js

const withPWA = require('next-pwa')({ dest: 'public', disable: process.env.NODE_ENV === 'development' });
module.exports = withPWA({
  // Next.js config
});

## Supabase客户端

src/lib/supabase/client.ts:
import { createBrowserClient } from '@supabase/ssr';
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

src/lib/supabase/server.ts:
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export const createClient = () => {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );
};

## LandscapeGuard组件

src/components/ui/LandscapeGuard.tsx:
横屏检测组件，竖屏时全屏覆盖黑色层 + 白色文字"请将手机横屏使用" + 旋转手机图标动画。
使用 window.matchMedia('(orientation: portrait)') 监听。
export default包裹children。

## 根布局

src/app/layout.tsx:
- 设置meta viewport
- 引入全局样式
- LandscapeGuard包裹（但排除/lottery路径）

## Tailwind配置

tailwind.config.ts 扩展：
- colors: { felt: '#1a6b3c', wood: '#8B6914', gold: '#D4A017', ... }
- fontFamily: { display: 手写体或装饰体 }

## 数据库初始化

在Supabase SQL Editor中执行以下SQL：

-- 用户扩展表（Supabase Auth已有auth.users）
CREATE TABLE public.profiles (
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

-- 房间表
CREATE TABLE public.rooms (
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

-- 房间玩家
CREATE TABLE public.room_players (
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

-- 游戏局
CREATE TABLE public.game_rounds (
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

-- 六合彩期号
CREATE TABLE public.lottery_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT UNIQUE NOT NULL,
  draw_time TIMESTAMPTZ NOT NULL,
  numbers INT[] DEFAULT '{}',
  special INT,
  status TEXT DEFAULT 'betting' CHECK (status IN ('betting', 'closed', 'drawing', 'finished')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 六合彩投注
CREATE TABLE public.lottery_bets (
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

-- 余额变动日志（关键！所有钱的进出都要记录）
CREATE TABLE public.balance_logs (
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

-- 钻石变动日志
CREATE TABLE public.diamond_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  amount INT NOT NULL,
  diamonds_after INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('admin_grant', 'room_create', 'daily_signin', 'purchase')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 平台设置表
CREATE TABLE public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 插入默认设置
INSERT INTO public.platform_settings (key, value) VALUES
  ('rake_percent', '{"default": 5, "fangpaofa": 5, "paodekuai": 5, "datongzi": 5}'),
  ('diamond_cost', '{"create_room": 2}'),
  ('lottery_schedule', '{"draw_time": "21:35:00", "close_before_minutes": 5}'),
  ('admin_key', '"gxfc2026"');

-- RLS策略（Row Level Security）
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_logs ENABLE ROW LEVEL SECURITY;

-- 基础RLS策略：用户只能看自己的数据，管理员可看全部
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Auth users can create rooms" ON public.rooms FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Anyone can view room players" ON public.room_players FOR SELECT USING (true);
CREATE POLICY "Users can view own bets" ON public.lottery_bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can place bets" ON public.lottery_bets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view draws" ON public.lottery_draws FOR SELECT USING (true);
CREATE POLICY "Users can view own balance logs" ON public.balance_logs FOR SELECT USING (auth.uid() = user_id);

-- 创建触发器：注册时自动创建profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, nickname)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username', COALESCE(NEW.raw_user_meta_data->>'nickname', '新玩家'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

## 验证标准

1. npm run dev 无报错
2. 浏览器打开 localhost:3000 能看到默认页面
3. Supabase Dashboard → Table Editor 能看到所有表
4. .env.local 配置正确，Supabase连接成功
5. git push 到GitHub后 Vercel 自动部署成功
```

---

# ═══════════════════════════════════════
# PHASE 1：Splash + 登录 + 注册
# ═══════════════════════════════════════

```
基于已有的gxfc-app项目，实现启动页、登录页、注册功能。
所有页面强制横屏显示。

## 1. LandscapeGuard 组件（如果还没做）

src/components/ui/LandscapeGuard.tsx
- 监听 window.matchMedia('(orientation: portrait)')
- 竖屏时显示全屏黑色覆盖层：
  - 中间白色文字"请将手机横屏使用"
  - 下方一个手机旋转的CSS动画图标（用div+CSS做，不要用图片）
- 横屏时正常显示children
- 接受 disabled prop，六合彩页面传入 disabled={true} 跳过检测

## 2. Splash Screen — src/app/splash/page.tsx

全屏横屏页面，不显示任何浏览器UI。

背景：用纯CSS实现中国山水画风格：
- 最底层：线性渐变 从顶部天蓝(#87CEEB)到中间淡蓝(#B0D4F1)到底部深蓝绿(#1a6b3c)
- 第二层：CSS伪元素画3-4座远山剪影（用border-radius和transform做三角形/梯形，颜色从深到浅叠加：#2d5a3f, #3d7a5f, #4d9a7f）
- 第三层：底部水面反光效果（半透明渐变 + subtle动画）
- 第四层：左右两侧前景树木暗影（CSS clip-path）
- 可选：几朵白色云（CSS动画缓慢飘动）

中央内容：
- "恭喜发财"四个大字，字号48px-64px
- CSS 3D金色浮雕效果：
  color: #D4A017;
  text-shadow:
    0 1px 0 #c6960c,
    0 2px 0 #b8880a,
    0 3px 0 #aa7a08,
    0 4px 0 #9c6c06,
    0 5px 10px rgba(0,0,0,0.4),
    0 0 40px rgba(212,160,23,0.3);
  font-weight: 900;
  letter-spacing: 8px;
- 下方副标题："财运当头 好牌在手"，白色，带1px黑色text-shadow描边，字号18px，letter-spacing 4px
- 再下方：三个圆点loading动画（白色，依次跳动）
- 右上角：白色小字 "v1.0.1"

逻辑：
- useEffect中setTimeout 2500ms 后 router.push('/login')
- 如果用户已登录（检查Supabase session），直接跳/lobby

## 3. 登录页 — src/app/login/page.tsx

背景：与Splash相同的山水画CSS背景（抽成共享组件 GameBackground.tsx）

布局（横屏）：
- 上半部分：品牌名"恭喜发财"（比Splash小30%）
- 中间偏下：两个大按钮水平排列，间距24px
  - "📱 账号登录"按钮：
    - 背景：线性渐变 #F2994A → #F2C94C（橙金色）
    - 圆角16px，高度56px，宽度200px
    - 白色粗体文字，带2px文字阴影
    - 点击 → 弹出登录Modal
  - "💬 游客体验"按钮：
    - 背景：线性渐变 #27AE60 → #6FCF97（绿色）
    - 同样尺寸和样式
    - 点击 → 设置localStorage guest=true → router.push('/lobby')

- 底部小字（白色60%透明度，12px）：
  "登记号：2018SR038573 | 运营单位：恭喜发财网络科技有限公司"
  "抵制不良游戏，拒绝盗版游戏。适度游戏益脑，沉迷游戏伤身。"

登录Modal（居中弹窗）：
- 白色圆角卡片，宽360px，padding 32px
- 标题"账号登录"居中，20px加粗
- 用户名输入框：左侧👤图标，placeholder"请输入账号"，圆角12px，高度48px
- 密码输入框：左侧🔒图标，placeholder"请输入密码"，右侧👁切换显示/隐藏
- 复选框行："☐ 记住密码"左对齐 + "忘记密码？"右对齐（忘记密码点击弹Toast"请联系管理员"）
- 登录按钮：全宽，橙金渐变，"登 录"，48px高
- 底部："还没有账号？立即注册"蓝色链接 → router.push('/register')
- 点击空白处或✕关闭Modal
- 按钮加loading状态

登录逻辑：
- 用 supabase.auth.signInWithPassword
- email格式：`${username}@gxfc.app`（用户只输入用户名，代码自动拼接）
- 成功 → router.push('/lobby')
- 失败 → Toast "账号或密码错误"

## 4. 注册页 — src/app/register/page.tsx

同样山水画背景 + 居中白色弹窗

注册表单：
- 用户名：3-16位字母数字下划线
- 密码：6位以上
- 确认密码：必须一致
- 昵称：2-8位中文或字母（默认值"新玩家"可改）
- 邀请码（可选）：不填也能注册，填了可以做未来功能
- "注 册"按钮：全宽绿色渐变
- "已有账号？去登录"链接

注册逻辑：
- supabase.auth.signUp({ email: `${username}@gxfc.app`, password, options: { data: { username, nickname } } })
- 触发器自动创建profiles记录（初始余额1000，钻石10）
- 注册成功 → 自动登录 → router.push('/lobby')
- 用户名重复 → Toast "该用户名已被注册"

## 5. 中间件 — src/middleware.ts

- 保护路由：/lobby, /club, /hall, /room/*, /lottery, /profile
- 未登录且非游客 → 重定向 /login
- 已登录访问 /login, /register → 重定向 /lobby
- /admin/* 路由不在此中间件处理（管理后台有自己的验证）

## 6. Auth状态管理 — src/lib/store/useAuth.ts

Zustand store：
- user: User | null
- profile: Profile | null（包含balance, diamonds, nickname等）
- isGuest: boolean
- login(username, password) → Promise
- register(username, password, nickname) → Promise
- logout() → Promise
- refreshProfile() → 重新从profiles表获取最新余额等信息

## 验证标准

1. 手机浏览器（或Chrome DevTools模拟手机）横屏打开 → 看到Splash页 → 2.5秒后跳转登录页
2. 竖屏时显示"请横屏使用"覆盖层
3. 点击"账号登录" → 弹出登录弹窗 → 输入用户名密码 → 登录成功跳转/lobby（此时lobby可以是空白页，显示"大厅建设中"即可）
4. 点击注册 → 填写信息 → 注册成功自动登录跳转/lobby
5. Supabase Dashboard → Authentication → 能看到注册的用户
6. Supabase Dashboard → Table Editor → profiles表有对应记录，余额1000，钻石10
7. 退出登录后访问/lobby → 自动跳回/login
8. 游客模式点击后能进入/lobby
```

---

# ═══════════════════════════════════════
# PHASE 2：主大厅 + 亲友圈 + 房间大厅
# ═══════════════════════════════════════

```
基于Phase 1的项目，实现主大厅、亲友圈、房间大厅三个页面。
继续强制横屏。

## 1. 主大厅 — src/app/lobby/page.tsx

横屏全屏，山水画大背景（复用GameBackground组件，但加上额外的前景装饰元素）

### 顶部栏（固定，高度60px）
左侧：
- 圆形头像（48px，白色2px边框）从profiles.avatar_url获取
- 昵称（白色粗体14px）
- "ID:375531"（白色60%透明度12px）
- 💎钻石数量（蓝色图标+白色数字）
- 💰余额（金色数字，保留2位小数）

中间：
- 品牌名"恭喜发财"（金色，比登录页再小，24px）

右上角：
- ⚙齿轮图标（点击弹出设置面板：音效开关、退出登录）

### 滚动公告条
顶部栏下方，半透明黑底条：
- 📢 "欢迎来到恭喜发财，祝您财运亨通！新春活动火热进行中..."
- CSS animation: marquee 横向滚动，infinite循环
- 样式参考微信消息提示条

### 中间入口区域（居中）
四个大卡片，2×2网格排列，每个卡片约180×140px：

卡片1 — 亲友圈（绿色调）：
- 背景：浅绿渐变 #E8F5E9 → #C8E6C9，圆角16px
- 图标区域：麻将牌+"财"字骰子图案（CSS绘制或emoji🀄🎲）
- 文字："亲友圈"，24px粗体
- 点击 → router.push('/club')

卡片2 — 娱乐场（蓝色调）：
- 背景：浅蓝渐变
- 图标：扑克A+J + 筹码（🃏）
- 文字："娱乐场"
- 点击 → router.push('/hall')

卡片3 — 创建房间（橙色调）：
- 背景：橙色渐变
- 图标：茶杯☕
- 文字："创建房间"
- 点击 → 弹出CreateRoomModal

卡片4 — 加入房间（紫色调）：
- 背景：浅紫渐变
- 图标：🎋
- 文字："加入房间"
- 点击 → 弹出JoinRoomModal（输入6位房间号）

### 底部快捷栏（固定，高度50px）
半透明黑底，5个图标按钮水平均分：
- 📍签到（点击 → 弹出签到弹窗，每日签到送1钻石，调用diamond_logs记录）
- 🏆战绩（点击 → 弹出战绩统计面板，显示总局数/胜率/总赢输）
- 🎰购彩（点击 → router.push('/lottery')，切换竖屏）
- 🤝合作（点击 → Toast "功能开发中"）
- 📢公告（点击 → 弹出公告弹窗，显示平台公告）

### 游客模式
- 显示所有UI但点击任何功能按钮弹Toast"请先登录"
- 底部增加一个"去登录"浮动按钮

## 2. 创建房间Modal — src/components/game/CreateRoomModal.tsx

全屏半透明遮罩 + 白色大面板（宽80%，高70%，圆角16px）

左侧Tab栏（宽150px，灰色底）：
- "跑得快"（默认选中，橙色高亮）
- "打筒子"
- "娄底放炮罚"
- "邵阳剥皮"（灰色+锁图标🔒，点击Toast"即将上线"）
- "邵阳麻将"（同上）
- "红中麻将"（同上）

右侧配置区（根据Tab切换内容）：

### 跑得快配置：
翻 倍：◉不翻倍 / ○少于 [-][10][+] 分翻倍
托 管：(超时时间) ◉无 / ○1分钟 / ○2分钟 / ○3分钟 / ○5分钟
积分底分：[-] [1] [+]（范围0.5-100，步长0.5）

### 娄底放炮罚配置：
玩 法：◉15息起胡 / ○10息起胡 / ○可兑守 / ☐飘胡
托 管：◉无 / ○1分钟 / ○2分钟 / ○3分钟 / ○5分钟
翻 倍：◉不翻倍 / ○少于 [-][50][+] 分翻倍
首局坐庄：○随机 / ◉房主
切 牌：◉系统切牌 / ○手动切牌
积分底分：[-] [1] [+]

### 打筒子配置：
玩 法：☐带 / ☑一炮多响 / ☐加锤
吃 牌：◉可吃牌 / ○清一色可吃牌 / ○都不选
抓 鸟：○窝窝鸟 / ◉2鸟 / ○3鸟 / ○4鸟 / ○6鸟 / ○8鸟 / ○不抓鸟
明 杠：◉每家都出 / ○放杠者出
翻 倍：◉不翻倍 / ○少于 [-][10][+] 分翻倍
积分底分：[-] [1] [+]

底部：
- 左侧：积分底分 [-] [数字] [+]
- 右侧："创建房间 💎×2"大按钮（绿色渐变）

创建逻辑：
1. 检查用户钻石 >= 2，不足 → Toast "钻石不足，无法创建房间"
2. 扣除钻石：UPDATE profiles SET diamonds = diamonds - 2
3. 记录钻石日志：INSERT diamond_logs
4. 生成6位随机房间号（数字）
5. INSERT rooms 表
6. INSERT room_players（host自己 + 分配座位0）
7. 自动添加1个AI机器人到座位1
8. router.push(`/room/${roomId}`)

## 3. 加入房间Modal — src/components/game/JoinRoomModal.tsx

小弹窗，居中：
- 标题"加入房间"
- 6位数字输入框（大字体，居中，每位数字一个格子）
- "加入"按钮 + "取消"按钮
- 查询rooms表 room_code → 存在且status=waiting → 加入
- 房间不存在 → Toast "房间不存在"
- 房间已满 → Toast "房间已满"

## 4. 亲友圈页 — src/app/club/page.tsx

横屏，不同的山水画背景（更多远山和瀑布元素）

左上：← 返回按钮

中间：预设的亲友圈卡片（一个就够）
- 白色圆角卡片，居中
- 顶部标签："休闲竞技"（金底黑字）
- 圈主头像（固定一个好看的头像）
- 亲友圈ID: 88888
- 成员数: 999+
- "点击进入"橙色按钮 → router.push('/hall')

底部：
- "创建亲友圈"蓝色按钮 → Toast "暂不支持"
- "加入亲友圈"橙色按钮 → 弹出输入框输入圈ID，任何ID都跳转到/hall

## 5. 房间大厅 — src/app/hall/page.tsx

这是最关键的视觉页面之一。

横屏全屏，中国庭院/园林背景：
- CSS实现：浅绿草地底色 + 远处山脉剪影 + 天空渐变
- 不需要3D渲染，用2D扁平化设计+阴影模拟深度

### 顶部栏
- ← 返回箭头
- 用户头像+昵称+ID+💰余额（左侧）
- "休闲竞技 ID:17599"（居中）
- 🎁赠送 / 👥成员 / 🏆战绩（右侧图标按钮）

### 滚动公告（同大厅）

### 桌子网格区域（核心，可横向滚动）
4列×2行 = 8张桌子（可滚动显示更多）

每张桌子组件 TableCard.tsx：
- 容器：宽180px，高200px
- 桌面：椭圆形深绿(#1a5c2e)，80%宽，带棕色(#8B6914)边框3px
- 桌面上方：桌主头像（圆形40px）+ 在线/离线标签
  - 在线：绿色小圆点
  - 离线：红色"离线"标签
- 桌面中央：
  - 游戏类型标签（圆角小标签）
    - 放炮罚：蓝色底白字"娄底放炮罚"
    - 跑得快：红色底白字"跑得快"
    - 打筒子：绿色底白字"打筒子"
  - 场次描述文字（白色12px）："5毛放炮罚" / "3块巴结红黑"
  - 积分数字（金色粗体）：100
- 桌面下方："详情"橙色小按钮
- 桌子两侧：简化的椅子图案（两个小棕色矩形）

数据来源：
- rooms表查询 status != 'dissolved'
- 混合真实房间和预设假房间（假房间数据在初始化时seed到数据库）
- 假房间用随机昵称、随机头像、随机游戏类型和积分
- 每10秒刷新一次

### 预设假房间数据

在Phase 0的数据库初始化SQL之后，追加seed data：
创建8-12个假房间，用不同的game_type, 不同的积分，加入假的bot玩家。
机器人昵称从预设列表随机：["好运连连","风生水起","牌王之王","逢赌必赢","布布","小熙","燕子","巡洋战舰","好运连连","周雄飞","刘青秀","阿谦"]
机器人头像从预设头像列表（后面Phase准备，先用默认头像占位）

### 底部栏
- 左侧："玩法筛选"金色按钮 → 弹出FilterModal
- 右侧："快速加入"红色大按钮 → 随机匹配一个有空位的房间
- 中间小字："上次:5毛放炮罚把结"（最近一次游戏记录）

### 玩法筛选Modal — FilterModal.tsx
弹窗，左侧分类：
- 麻将类 / 扑克类（打筒子/跑得快/半边天炸） / 字牌类（娄底放炮罚/邵阳剥皮）
右侧：对应游戏的桌子列表
- 每行：[置顶]按钮 + 游戏名+场次 + [快速加入]绿色按钮 + [➖]删除
顶部切换：[显示全部桌子] / [一键全选☐]

## 验证标准

1. 登录后进入主大厅，看到山水画背景+四个入口卡片+顶栏用户信息
2. 余额和钻石正确显示（1000余额，10钻石）
3. 签到功能：点击签到，钻石+1，第二次点击提示"今日已签到"
4. 点击创建房间 → 弹出配置面板 → 选择跑得快 → 创建 → 钻石扣除2个 → 跳转到牌桌（此时牌桌显示"建设中"占位即可）
5. 钻石不足时创建房间提示"钻石不足"
6. 亲友圈页面显示正确 → 点击进入 → 跳转房间大厅
7. 房间大厅显示8+张桌子，混合不同游戏类型
8. 玩法筛选能过滤桌子
9. 快速加入能跳转到对应房间
10. 点击"购彩" → 跳转/lottery（此时显示"建设中"占位即可，注意解除横屏锁定）
```

---

# ═══════════════════════════════════════
# PHASE 3：牌桌UI壳（三个游戏通用框架）
# ═══════════════════════════════════════

```
实现牌桌页面的通用框架，三个游戏共享基础布局，各自有不同的手牌区和操作区。
此Phase只做UI壳和基本交互，不做游戏逻辑。

## 1. 牌桌页面 — src/app/room/[id]/page.tsx

根据room的game_type渲染不同的游戏组件：
- fangpaofa → <FangpaofaTable />
- paodekuai → <PaodekuaiTable />  
- datongzi → <DatongziTable />

### 通用牌桌布局 — src/components/game/TableLayout.tsx

横屏全屏，分区：

#### 背景层
- 绿色毡布底色：径向渐变 center #1a6b3c → edge #0d3d1f
- subtle纹理：CSS repeating pattern模拟织物
- 中央暗水印：品牌logo"恭喜发财"（opacity 0.05）

#### 顶栏（高40px，半透明黑底）
从左到右：
- 📶 WiFi信号图标（装饰，永远满格）
- 🔋 电池图标（装饰，永远80%）
- 房间号：Room 827467
- "第1局"
- 当前时间（实时更新 HH:MM）
- ⚙设置图标（点击弹出：退出房间/音效开关/举报）
- ❓帮助图标

#### 积分表（可折叠面板）— src/components/game/ScoreTable.tsx
- 白色半透明（rgba(255,255,255,0.9)），圆角
- 表格：玩家 | 历史总分 | 本局分 | 其他（根据游戏类型不同列）| 总分
- 底部有 ▽ 箭头，点击折叠/展开
- 默认展开

#### 玩家座位 — src/components/game/PlayerSeat.tsx
props: position ('bottom'|'left'|'top'|'right'), player, isCurrentTurn

2人局布局：
- bottom（自己）：屏幕左下角
- top（对手）：屏幕右上角

3人局布局：
- bottom（自己）：屏幕底部居中偏左
- left（左侧玩家）：屏幕左侧中间
- right（右侧玩家）：屏幕右侧中间

每个座位显示：
- 圆形头像（48px）+白色边框
- 昵称（白色12px）
- 当前积分（金色粗体16px）
- 在线状态小圆点（绿色在线/灰色离线）
- 当前出牌思考中：头像周围发光动画 + 倒计时环

#### 中央区域
- 品牌装饰文字（小号白色低透明度）
- 当前玩法文字（黄色小字）
- 出牌区域（打出的牌显示在这里）

#### 右侧工具栏（竖排）
- 底牌数显示（如"88底牌"，只在放炮罚/打筒子显示）
- 🎙语音按钮（点击Toast"功能开发中"）
- 💬聊天按钮（点击弹出快捷语列表：好牌！/ 快点吧！/ 运气真好 / 不错不错）

#### 底部手牌区（高120px）
根据游戏类型渲染不同牌组件

#### 底部操作按钮区（高60px）
等待状态：[退出房间] [准 备]
游戏中：根据游戏类型不同按钮（Phase 4-6实现）

## 2. 字牌组件 — src/components/game/CardTile.tsx

用于放炮罚的字牌渲染。

props: { value: string, type: 'small'|'big', isRed: boolean, isSelected: boolean, isFaceDown: boolean, size: 'normal'|'small' }

尺寸：
- normal: 36×54px（手牌）
- small: 24×36px（出牌区/明牌区）

样式：
- 正面：
  - 白色底，1px #999边框，圆角4px
  - box-shadow: 0 2px 4px rgba(0,0,0,0.3)
  - 中间文字：小写(一二三四五六七八九十) 或 大写(壹贰叁肆伍陆柒捌玖拾)
  - 红色牌(二七十贰柒拾)：color: #E74C3C
  - 黑色牌(其余)：color: #333
  - 字号：normal时18px，small时12px
- 背面：
  - 深蓝色底(#1a3a5c)，中间浅色花纹装饰
- 选中状态：
  - transform: translateY(-12px)
  - border: 2px solid #FFD700
  - 加subtle金色发光

字牌完整列表（80张）：
小写×4组：一 二 三 四 五 六 七 八 九 十
大写×4组：壹 贰 叁 肆 伍 陆 柒 捌 玖 拾

## 3. 扑克牌组件 — src/components/game/PokerCard.tsx

用于跑得快和打筒子。

props: { suit: '♠'|'♥'|'♦'|'♣'|'joker', rank: 'A'|'2'|...|'K'|'small'|'big', isSelected: boolean, isFaceDown: boolean, size: 'normal'|'small' }

尺寸：
- normal: 50×72px（手牌）
- small: 34×48px（出牌区）

样式：
- 正面：
  - 白色底，1px #ccc边框，圆角6px
  - box-shadow: 0 2px 6px rgba(0,0,0,0.2)
  - 左上角：rank + suit（红色♥♦ / 黑色♠♣）
  - 中间：大号suit图案
  - 右下角（倒转）：rank + suit
  - ♥♦：#E74C3C红色
  - ♠♣：#333黑色
  - 大小王特殊设计：大王红底金字"王"，小王黑底白字"王"
- 背面：
  - 红色底（#C0392B），白色细边框，中间菱形图案
- 选中状态：
  - transform: translateY(-15px)
  - border: 2px solid #FFD700

## 4. 手牌区域组件 — src/components/game/HandCards.tsx

props: { cards: Card[], onCardSelect: (index) => void, selectedIndices: number[], gameType: string }

布局：
- 水平排列，居中
- 牌面重叠：每张牌只露出左侧30-40%（根据总数动态计算间距）
- 最后一张完全显示
- 牌数 > 能显示的数量时，压缩间距
- 点击牌 → 切换选中状态（上移/下移）
- 支持多选（跑得快需要多选出牌）

## 5. 等待状态实现

进入房间后：
1. 从rooms表获取房间信息和玩家列表
2. 显示房间规则面板（白色半透明，列出所有config参数）
3. 显示当前玩家和AI机器人
4. 底部按钮：[退出房间] [准 备]
5. 玩家点击准备 → 更新room_players.is_ready = true
6. 所有玩家准备好 → 自动开始游戏（AI机器人延迟1-3秒自动准备）
7. 开始游戏：发牌动画（牌从中央依次飞到各玩家手牌区）

## 6. 结算页面组件 — src/components/game/Settlement.tsx

全屏覆盖弹窗（暂时用假数据展示，等游戏逻辑做完后接入真实数据）

- 顶部：日期时间 + "🎀 牌局结算 🎀"金色大字
- 提示："游戏结果仅做娱乐用途，禁止用于赌博行为！"
- 左右两个玩家卡片对比：
  - 圆角卡片，上方头像+昵称+ID
  - 赢家卡片右上角：🏆"大赢家"红底金字标签
  - 中间：各项统计数据
  - 底部：战绩数字（赢方红色+XX / 输方绿色-XX）
- 底部按钮：[分享]（Toast"截图分享给朋友"） + [再来一局]（重置游戏状态）
- 底部小字：游戏类型 + 房间号

## 验证标准

1. 创建房间后跳转到牌桌页面，绿色毡布背景正确显示
2. 顶栏信息正确（房间号、时间等）
3. 自己的头像和AI机器人头像正确显示在对应位置
4. 规则面板展示创建时选择的配置
5. 点击准备 → AI延迟准备 → 显示发牌动画（先用假牌测试）
6. 字牌和扑克牌组件正确渲染，红色/黑色区分正确
7. 手牌点击选中/取消选中正常
8. 积分表展开/折叠正常
9. 结算页面弹出正常（用测试按钮触发）
```

---

# ═══════════════════════════════════════
# PHASE 4：放炮罚游戏逻辑（核心）
# ═══════════════════════════════════════

```
实现娄底放炮罚的完整游戏逻辑。这是最复杂的Phase。

## 前置：获取算法库

从GitHub下载 yuanfengyun/qipai_algorithm 仓库中的 JS 版跑胡子算法。
路径：phzlib_js/ 目录
复制到项目 src/lib/games/fangpaofa/algorithm/ 目录下。
如果访问不了GitHub，手动实现核心算法。

## 1. 牌组定义 — src/lib/games/fangpaofa/tiles.ts

// 80张字牌定义
// 小写：一到十，每个4张
// 大写：壹到拾，每个4张
// 红色牌：二、七、十、贰、柒、拾
// 编码方式：小写1-10，大写11-20，每个值有4张(a,b,c,d)

interface Tile {
  id: number;       // 0-79唯一ID
  value: number;    // 1-10(小写) 或 11-20(大写)
  display: string;  // "一"~"拾" 或 "壹"~"拾"
  isRed: boolean;
  isSmall: boolean;  // true=小写，false=大写
}

function createDeck(): Tile[] { /* 生成80张牌 */ }
function shuffleDeck(deck: Tile[]): Tile[] { /* 洗牌 */ }

## 2. 游戏引擎 — src/lib/games/fangpaofa/engine.ts

class FangpaofaEngine {
  // 游戏状态
  players: PlayerState[];      // 2-3个玩家
  deck: Tile[];                // 牌墙（未发出的牌）
  discardPile: Tile[];         // 弃牌堆
  currentPlayerIndex: number;  // 当前出牌玩家
  dealerIndex: number;         // 庄家
  roundNumber: number;
  gamePhase: 'dealing' | 'playing' | 'finished';

  // 每个玩家的状态
  interface PlayerState {
    userId: string;
    hand: Tile[];              // 手牌
    melds: Meld[];             // 已组合的牌组（吃/碰/偎/跑/提）
    discards: Tile[];          // 打出的牌
    huXi: number;              // 当前胡息
    menZi: number;             // 门子数
    isDealer: boolean;
    score: number;
  }

  // 核心方法
  initialize(playerCount: number, config: GameConfig): void
  deal(): void                  // 发牌（庄21闲20，剩余入墙）
  drawTile(): Tile | null       // 摸牌
  discardTile(playerIndex: number, tileId: number): void  // 出牌
  
  // 动作判断
  canChi(playerIndex: number, tile: Tile): ChiOption[]     // 能否吃（返回可选组合）
  canPeng(playerIndex: number, tile: Tile): boolean         // 能否碰
  canWei(playerIndex: number, tile: Tile): boolean          // 能否偎（自摸第3张）
  canPao(playerIndex: number, tile: Tile): boolean          // 能否跑（别人出第4张）
  canTi(playerIndex: number): TiOption[]                    // 能否提（手中4张）
  canHu(playerIndex: number): boolean                       // 能否胡
  
  // 执行动作
  executeChi(playerIndex: number, option: ChiOption): void
  executePeng(playerIndex: number, tile: Tile): void
  executeWei(playerIndex: number, tile: Tile): void
  executePao(playerIndex: number, tile: Tile): void
  executeTi(playerIndex: number, option: TiOption): void
  executeHu(playerIndex: number): HuResult
  executePass(playerIndex: number): void                    // 过
  
  // 胡牌判断（核心算法）
  calculateHuXi(melds: Meld[], hand: Tile[]): number       // 计算胡息
  isValidHu(playerIndex: number): { valid: boolean, huXi: number, menZi: number }
  
  // 结算
  settle(): SettlementResult    // 满百结算或牌墙摸完
  
  // 规则配置
  config: {
    minHuXi: number;           // 起胡胡息（15或10）
    maxScore: number;           // 封顶（100或200）
    hasNiao: boolean;           // 是否打鸟
    hasPiaoHu: boolean;        // 是否飘胡
    firstDealerMode: 'random' | 'host';
    autoPlaySeconds: number;    // 托管时间（0=无）
  }
}

## 3. 胡息计算规则

组合类型及胡息值：
- 顺子（吃）：大小混搭（如 一+壹+xx）有额外胡息
  - 大对子（壹壹）= 取决于具体规则
  - 小对子（一一）= 取决于具体规则
  - 三个相同：
    - 小字碰（如三个"三"）= 1胡息
    - 大字碰（如三个"叁"）= 3胡息
    - 小字偎（如三个"三"，自摸成）= 3胡息
    - 大字偎 = 6胡息
  - 四个相同（跑/提）：
    - 小字跑 = 6胡息
    - 大字跑 = 9胡息
    - 小字提 = 9胡息
    - 大字提 = 12胡息
  - 2-7-10（二七十或贰柒拾）：特殊顺子，有额外胡息

**重要：** 胡息计算非常复杂，各地规则微差。
优先使用qipai_algorithm库中的现成函数。
如果不可用，按上述基础规则实现，后续让用户测试后微调。

## 4. "有炮必接"规则

当某玩家打出一张牌，如果其他玩家可以吃/碰/跑，则必须执行（强制接炮）。
优先级：跑 > 碰 > 吃
如果可以碰又可以吃，必须碰。

## 5. AI出牌 — src/lib/games/fangpaofa/ai.ts

class FangpaofaAI {
  // 策略等级
  level: 'easy' | 'normal' | 'controlled';
  
  // controlled模式：按管理后台指令行动
  riggedActions: any[];
  
  decideTile(hand: Tile[], melds: Meld[], gameState: any): number {
    if (this.level === 'controlled' && this.riggedActions.length > 0) {
      return this.riggedActions.shift(); // 按预设出牌
    }
    // normal: 优先打没有用的散牌，保留可能组成顺子/刻子的牌
    // easy: 随机出一张合法的牌
  }
  
  decideAction(availableActions: string[], gameState: any): string {
    // 有胡就胡
    // 能碰就碰（大多数情况）
    // 吃取决于是否有利
    // controlled模式按指令
  }
}

## 6. 游戏流程组件 — src/components/game/FangpaofaTable.tsx

整合engine和UI：

1. 进入房间 → 等待准备
2. 所有人准备 → engine.initialize() → engine.deal()
3. 发牌动画（牌从中央飞到各玩家，自己的翻面，对手的背面）
4. 游戏循环：
   a. 当前玩家摸牌（如果是自己，显示摸到的牌动画）
   b. 检查是否可以提/胡
   c. 等待出牌（自己手动选择/AI自动选择）
   d. 出牌 → 动画显示到中央
   e. 其他玩家检查是否可以吃/碰/跑/胡
   f. 如果有可操作动作 → 显示操作按钮（有炮必接则自动执行）
   g. 处理完毕 → 下一个玩家摸牌
5. 胡牌/满百/牌墙空 → 结算
6. 结算动画 → Settlement组件展示
7. 扣除抽水 → 更新余额

### 操作按钮逻辑
当轮到自己操作时，底部显示可用按钮：
- 吃（如果有多种吃法，弹出选择面板）
- 碰
- 偎
- 跑
- 提
- 过
- 胡（红色大按钮，闪烁动画）
- 出牌（选中牌后变为可点击状态）

### 抽水逻辑

结算时：
1. 计算输赢金额
2. 赢家收益 = 原始赢额 × (1 - rake_percent/100)
3. 抽水金额 = 原始赢额 × rake_percent/100
4. 更新双方profiles.balance
5. INSERT balance_logs：赢方(game_win)、输方(game_lose)、平台(game_rake)

## 7. 实时通信（Supabase Realtime）

虽然主要是人vs AI，但使用Realtime为将来多人扩展做准备：
- 房间频道：`room:${roomId}`
- 广播游戏状态变化
- AI的操作通过setTimeout延迟1-4秒后执行（模拟思考时间）

## 验证标准

1. 创建放炮罚房间 → 准备 → AI准备 → 发牌动画播放
2. 手牌正确显示21张（庄家）或20张
3. 字牌红黑颜色正确
4. 能出牌（点击选中→出牌按钮→牌飞到中央）
5. AI能自动出牌（有1-3秒延迟）
6. 吃/碰/偎/跑/提按钮在正确时机出现
7. 有炮必接规则生效
8. 胡牌判断正确（15息起胡+7门子）
9. 满百结算触发结算页面
10. 结算后余额正确变化（含抽水）
11. balance_logs记录完整
```

---

# ═══════════════════════════════════════
# PHASE 5：跑得快游戏逻辑
# ═══════════════════════════════════════

```
实现跑得快完整游戏逻辑。比放炮罚简单很多。

## 1. 牌组定义 — src/lib/games/paodekuai/cards.ts

标准54张（含大小王）或去掉部分牌的变体：
- 2人玩：每人各15张，去掉一些牌
- 3人玩：每人各16张+1张底牌 或 每人各17张去掉一张

配置项：
- 15张模式（2人，去掉3-A的部分花色）
- 16张模式（3人）

牌面大小：3<4<5<6<7<8<9<10<J<Q<K<A<2<小王<大王

## 2. 出牌类型判断 — src/lib/games/paodekuai/rules.ts

enum CardPattern {
  SINGLE,       // 单张
  PAIR,         // 对子
  TRIPLE,       // 三条
  TRIPLE_ONE,   // 三带一
  TRIPLE_TWO,   // 三带二
  FOUR_TWO,     // 四带二（炸弹带两张）
  FOUR_THREE,   // 四带三
  STRAIGHT,     // 顺子（5+张连续）
  DOUBLE_STRAIGHT, // 连对（3+对连续）
  PLANE,        // 飞机（2+组三条连续）
  BOMB,         // 炸弹（4张相同）
  ROCKET,       // 火箭（大小王）
}

function getCardPattern(cards: Card[]): { type: CardPattern, rank: number } | null
function canBeat(current: CardPattern, previous: CardPattern): boolean
function findPlayableHands(hand: Card[], lastPlay: CardPlay | null): Card[][]

## 3. 游戏引擎 — src/lib/games/paodekuai/engine.ts

class PaodekuaiEngine {
  players: PlayerState[];
  lastPlay: { cards: Card[], playerIndex: number } | null;
  currentPlayerIndex: number;
  passCount: number;            // 连续pass次数
  gamePhase: 'dealing' | 'playing' | 'finished';
  
  config: {
    cardCount: number;          // 15或16
    fourWithThree: boolean;     // 四带三
    heartsTenDouble: boolean;   // 红桃10翻倍
    smallJokerDouble: boolean;  // 小王翻倍
    autoPlaySeconds: number;
    doubleThreshold: number;    // X分以下翻倍
  }
  
  deal(): void
  playCards(playerIndex: number, cardIds: number[]): boolean
  pass(playerIndex: number): void
  
  // 特殊规则
  isSpring(): boolean           // 春天（对方一张没出）
  calculateScore(): SettlementResult
}

## 4. AI出牌 — src/lib/games/paodekuai/ai.ts

基础策略：
1. 如果是自由出牌（上轮所有人pass或自己上轮赢了）→ 从最小单张开始出
2. 如果要跟牌 → 找最小能打过的组合
3. 有炸弹时机：对方只剩1-2张牌时考虑炸
4. controlled模式：按预设策略

## 5. 跑得快UI — src/components/game/PaodekuaiTable.tsx

与放炮罚类似布局，区别：
- 扑克牌渲染（PokerCard组件）
- 多选出牌（选中多张后点出牌）
- 操作按钮简化：[不出/要不起] [出牌] [提示]
- 提示按钮：自动选出一组可以打的牌

## 验证标准

1. 创建跑得快房间 → 发牌正确
2. 扑克牌显示正确（花色颜色对）
3. 可以选中多张牌出牌
4. 出牌类型判断正确（顺子/对子/炸弹等）
5. AI能正确跟牌
6. 春天判断正确
7. 结算和抽水正确
```

---

# ═══════════════════════════════════════
# PHASE 6：打筒子游戏逻辑
# ═══════════════════════════════════════

```
打筒子使用扑克牌，规则类似放炮罚但用扑克。
具体规则复杂度介于跑得快和放炮罚之间。

## 核心规则（欢乐四喜/八喜模式）

- 使用标准扑克牌（去除部分牌，具体取决于变体）
- 2人对战
- 组合方式：顺子、三条、杠、筒子（4张同数字）
- 喜分系统（类似胡息）
- 结算以喜分×底分计算

## 实现思路

1. 复用扑克牌组件（PokerCard）
2. 引擎结构类似放炮罚
3. 喜分计算替代胡息计算
4. AI逻辑参考放炮罚AI

## 由于打筒子优先级P2，可以在Phase 4/5稳定后再详细实现

先实现基础框架（能发牌、能出牌、AI能响应），
具体规则后续根据你爸实际玩法微调。

## 验证标准（最低标准）

1. 能创建打筒子房间
2. 发牌正确
3. 基本出牌和AI对战能跑通
4. 结算能显示
```

---

# ═══════════════════════════════════════
# PHASE 7：六合彩完整功能
# ═══════════════════════════════════════

```
实现澳门六合彩的完整投注、开奖、结算功能。
这是竖屏页面，独立于棋牌模块。

## 1. 页面入口 — src/app/lottery/page.tsx

此页面解除横屏锁定（LandscapeGuard disabled）。
竖屏布局，设计参考"新葡京娱乐城"截图。

## 2. 页面结构

### 顶部固定区（蓝色渐变背景 #4A90D9→#6BB3F0）
- 返回箭头 ← （返回大厅，重新锁横屏）
- "澳门六合彩"+ 当期期号（如"2026056期"）
- 倒计时器：[时]:[分]:[秒]
  - 翻牌器动画效果（数字切换时有翻转transition）
  - 文字"投注中"/"已封盘"/"开奖中"
- 汉堡菜单≡ → 弹出：投注记录/开奖历史/路子图/玩法说明

### 上期开奖展示条
- 上期期号
- 6个彩色圆形号码球（直径36px）+ "+" + 特码球（稍大40px，金色边框）
- 每个球下方：对应生肖文字（12px）
- 最右：总和数字
- 球的颜色规则：
  红球(#E74C3C)：1,2,7,8,12,13,18,19,23,24,29,30,34,35,40,45,46
  蓝球(#3498DB)：3,4,9,10,14,15,20,25,26,31,36,37,41,42,47,48
  绿球(#27AE60)：5,6,11,16,17,21,22,27,28,32,33,38,39,43,44,49

### Tab切换
[官方] [路子图]（路子图暂显示"开发中"）

### 投注区（可滚动）

左侧固定分类导航（竖排，宽80px，白底，选中项蓝色左边框）：
色波 / 特码 / 特肖 / 正码 / 正特 / 正码1-6 / 连码 / 一肖 / 自选不中

右侧投注内容（根据选中分类变化）：

#### 色波
顶部筛选Tab：种类 / 全 / 大 / 小 / 奇 / 偶 / 清
3列网格：
红单(5.58) / 红双(5.06) / 红大(6.499)
红小(4.5) / 蓝单(5.58) / 蓝双(5.58)
蓝大(5) / 蓝小(6.58) / 绿单(5.58)
绿双(6.45) / 绿大(5.58) / 绿小(6.519)
每个选项：白色卡片，上方名称（对应颜色文字），下方赔率（灰色小字）
点击选中 → 边框变蓝 + 背景微蓝

#### 特码
顶部：12生肖图标横排（鼠牛虎兔龙蛇马羊猴鸡狗猪）+ 名称
下方：5列号码球网格（01-49），每个球：
- 圆形，对应颜色（红/蓝/绿），36px
- 下方赔率文字（48.9）
- 点击选中 → 加粗边框 + 发光效果

#### 特肖
12生肖图标大格子，2行6列，每个带赔率

#### 正码
同特码布局，赔率不同（8.02）

#### 正特
顶部子Tab：正码一 / 正码二 / 正码三 / 正码四 / 正码五 / 正码六
每个子Tab下：
- 最高奖金：285900元（动态计算）
- 大(1.98)/小(1.98)/单(1.98)/双(1.98)/合单(1.98)/合双(1.98)
- 红波(2.78)/蓝波(2.859)/绿波(2.859)

#### 连码/一肖/自选不中
简化实现，参考截图布局

### 底部固定操作栏
- 返水行：返水⊕ [进度条] ⊖ 0%
- 投注行：🗑清空 / 每注[金额输入框] / [元][角][分]Tab / [-][倍数][+]
- 选注提示条："已选X注，共XXX元"（红色背景）
- 按钮行：[近期投注] [购彩篮🛒] [添加选号⊕] [立即投注 余额:XX] [追号]

### 投注逻辑
1. 用户选号 → 显示选注提示
2. 输入每注金额 → 计算总金额
3. 点击"立即投注"：
   a. 检查余额 ≥ 总金额，不足 → Toast "账号余额不足"
   b. 扣除余额：UPDATE profiles SET balance = balance - amount
   c. 记录balance_log (lottery_bet)
   d. INSERT lottery_bets（每个选项一条记录）
   e. Toast "投注成功"
   f. 清空选中状态

## 3. 开奖历史页 — src/components/lottery/DrawHistory.tsx

从汉堡菜单进入。
列表布局，每期一行：
- "第2026052期" + "2026-02-21 21:35:10"
- 6个彩色球 + "+" + 特码球 + 生肖 + 总和
- 底部蓝色大按钮"立即投注"

数据从lottery_draws表获取，按draw_time倒序。

## 4. 倒计时逻辑 — src/components/lottery/CountdownTimer.tsx

- 从lottery_draws表获取当前期（status='betting'）的draw_time
- 实时计算距离draw_time的剩余时间
- 每秒更新显示
- 倒计时归零 → 显示"开奖中..." → 请求后端获取开奖结果
- 开奖前5分钟自动封盘（draw status → 'closed'，不再接受投注）

翻牌器动画：
- 每个数字一个独立div
- 数字变化时：旧数字向上翻出 + 新数字从下翻入
- CSS transform: rotateX() + transition

## 5. 开奖结算逻辑 — src/app/api/lottery/settle/route.ts

管理后台设置开奖号码后，调用此API：
1. 获取该期所有投注记录（lottery_bets where draw_id = X）
2. 逐条判断中奖：
   - 特码：投注号码 = 特码 → 中奖，赔率48.9
   - 色波：根据开奖号码计算红/蓝/绿/大/小/单/双 → 匹配投注
   - 特肖：特码对应生肖 = 投注生肖 → 中奖
   - 正码：投注号码在6个正码中 → 中奖
   - ...（每种bet_type对应不同的判断逻辑）
3. 更新lottery_bets.result和payout
4. 中奖的：UPDATE profiles SET balance = balance + payout
5. 记录balance_log

## 6. 号码-生肖对应表

2026年生肖对应（每年变化，这里固定一版）：
鼠：04,16,28,40
牛：03,15,27,39
虎：02,14,26,38
兔：01,13,25,37,49
龙：12,24,36,48
蛇：11,23,35,47
马：10,22,34,46
羊：09,21,33,45
猴：08,20,32,44
鸡：07,19,31,43
狗：06,18,30,42
猪：05,17,29,41

## 验证标准

1. 从大厅点"购彩" → 切换竖屏 → 显示六合彩投注页
2. 倒计时实时跳动
3. 上期开奖号码正确显示（颜色+生肖+总和）
4. 可以选号（特码/色波/生肖等所有分类）
5. 投注成功，余额正确扣除
6. 管理后台设置开奖号码后，前端显示开奖结果
7. 中奖自动加款，balance_logs记录完整
8. 开奖历史页正确显示
```

---

# ═══════════════════════════════════════
# PHASE 8：AI机器人系统
# ═══════════════════════════════════════

```
完善AI机器人系统，让整个平台"活"起来。

## 1. 昵称库 — src/lib/bot/names.ts

100+个中文昵称，风格参考地下棋牌平台：
["好运连连","风生水起","牌王之王","逢赌必赢","小财迷","一夜暴富","好好先生",
 "布布","小熙","燕子","巡洋战舰","周雄飞","刘青秀","简单","淡然",
 "牛转乾坤","财源滚滚","步步高升","花好月圆","福星高照","紫气东来",
 "六六大顺","八方来财","金玉满堂","前程似锦","心想事成","大吉大利",
 "独孤求败","常胜将军","手气王","幸运星","小赌怡情","稳如老狗",
 ...]

## 2. 头像系统 — src/lib/bot/avatars.ts

预设30个头像：
- 用CSS生成彩色渐变头像（不需要真实图片）
- 或使用DiceBear等头像生成API
- 每个机器人随机分配一个

## 3. 行为模拟 — src/lib/bot/behavior.ts

让AI机器人更像真人：
- 操作延迟：正态分布随机，均值2秒，标准差1秒，最小0.5秒最大6秒
- 偶尔显示"离线"状态3-5秒再恢复（模拟网络波动）
- 偶尔发送快捷聊天消息："好牌！"/"快点吧"/"运气真好"
- 准备延迟：进入房间后1-5秒自动准备

## 4. 房间大厅假数据刷新

每30秒自动刷新假桌子数据：
- 随机调整桌上积分数字（±10-50）
- 随机变更在线/离线状态
- 偶尔"新建"一个假桌或"关闭"一个假桌
- 让房间大厅看起来有人在活跃玩

## 5. 受控AI模式

管理后台可以：
- 指定某个AI机器人的下一步操作
- 设置AI的整体策略：aggressive(打牌凶) / passive(保守) / throw(故意输)
- 预设发牌结果（控牌）：指定谁拿到什么牌

## 验证标准

1. 房间大厅的假桌子数据每30秒有变化
2. 进入房间后AI 1-5秒内自动准备
3. AI出牌有1-4秒的延迟
4. AI偶尔发送快捷聊天消息
5. AI偶尔短暂显示离线再恢复
```

---

# ═══════════════════════════════════════
# PHASE 9：管理后台
# ═══════════════════════════════════════

```
实现完整管理后台，这是控制一切的核心。

入口：/admin/gxfc2026（URL中的key与platform_settings.admin_key匹配）
管理员登录：单独的密码验证（简单方案：固定密码存在platform_settings中）

## 1. 管理后台布局

竖屏（电脑或手机竖屏都行）
左侧侧边栏导航：
- 📊 仪表盘
- 👥 用户管理
- 🏠 房间管理
- 🎰 控牌面板
- 🎱 六合彩管理
- 💣 揭示系统
- ⚙ 系统设置

## 2. 仪表盘 — /admin/[key]/page.tsx

统计卡片：
- 注册用户数
- 当前在线用户
- 今日游戏总局数
- 今日投注总额（六合彩）
- 平台总抽水收入
- 用户余额总和

## 3. 用户管理 — /admin/[key]/users/page.tsx

表格：ID / 用户名 / 昵称 / 余额 / 钻石 / 注册时间 / 最后在线 / 状态
操作按钮：
- 💰 充值：弹窗输入金额 → UPDATE balance → INSERT balance_logs(admin_topup)
- 💸 扣款：弹窗输入金额 → UPDATE balance → INSERT balance_logs(admin_deduct)
- 💎 送钻石：UPDATE diamonds → INSERT diamond_logs(admin_grant)
- 🔒 封禁/解封
- 🔑 重置密码
- 📋 查看该用户所有balance_logs

## 4. 房间管理 — /admin/[key]/rooms/page.tsx

活跃房间列表：
- 房间号 / 游戏类型 / 状态 / 玩家 / 创建时间
- 关闭房间按钮
- 查看房间当前游戏状态

## 5. 控牌面板 — /admin/[key]/rigging/page.tsx（最核心功能）

选择目标用户后：
- 实时查看该用户当前在哪个房间
- 实时查看该用户手牌（如果在游戏中）
- 查看AI对手的手牌

### 控牌操作
a. 下一局发牌控制：
   - 指定目标用户获得的手牌（从牌库中选择）
   - 指定AI获得的手牌
   - 剩余牌自动分配到牌墙
   
b. AI策略控制：
   - 单选：正常 / 放水（故意出有利于用户的牌）/ 收割（最强策略打）/ 自杀（故意输到底）
   
c. 快捷操作：
   - "让他赢3局"：自动设置接下来3局AI为放水模式
   - "收割模式"：AI全力赢
   - "大起大落"：先赢后输交替

控牌配置保存到game_rounds.rigged_config，game_rounds.is_rigged=true

## 6. 六合彩管理 — /admin/[key]/lottery/page.tsx

### 期号管理
- 当前期号 / 状态（投注中/已封盘/已开奖）
- 创建新期：自动生成期号 + 设置开奖时间

### 开奖号码设置
- 6个正码输入框 + 1个特码输入框
- "随机生成"按钮
- "根据用户投注反向生成"按钮（核心！）：
  查询当前期所有投注 → 找出避开用户投注的号码组合 → 确保用户必输
  或者：找出让用户小赢（建立信任）的号码组合
- "确认开奖"按钮 → 更新lottery_draws → 触发结算API

### 投注详情
- 查看某期所有用户投注：用户/投注类型/投注内容/金额/赔率
- 可以看到用户投了什么，然后决定开什么

### 历史开奖
- 所有历史开奖记录列表

## 7. 系统设置 — /admin/[key]/settings/page.tsx

- 修改抽水比例（全局/每个游戏独立设置）
- 修改创建房间钻石消耗
- 修改六合彩开奖时间
- 修改管理员密码
- 修改admin URL key

## 验证标准

1. /admin/gxfc2026 可访问，需要密码验证
2. 仪表盘统计数据正确
3. 可以给用户充值/扣款，balance_logs记录正确
4. 控牌面板能查看目标用户手牌
5. 设置控牌后下一局发牌结果受控
6. 六合彩可以手动设置开奖号码并触发结算
7. "反向生成"功能能避开用户投注
```

---

# ═══════════════════════════════════════
# PHASE 10：揭示系统
# ═══════════════════════════════════════

```
最终目的实现。当时机成熟时，一键触发认知冲击。

## 1. 揭示触发 — 管理后台

/admin/[key]/reveal/page.tsx：
- 选择目标用户
- 预览揭示内容（先自己看一遍）
- "启动揭示"按钮（需要二次确认）

## 2. 数据收集

从各表汇总目标用户的所有数据：
- 总投入金额（admin_topup的总和）
- 总输赢金额（game_win + game_lose + lottery_win + lottery_bet 的净额）
- 每一局的详情：时间/游戏/对手/结果/金额
- 每一期六合彩投注：选了什么/开了什么/赢输多少
- 被控牌的局数：is_rigged=true的记录，展示"这一局，庄家提前安排了你的牌"
- 抽水总额

## 3. 揭示页面 — 用户端

当管理后台触发揭示后：
- 在目标用户的所有页面注入一个全屏不可关闭的覆盖层
- Supabase Realtime 推送 reveal 事件到目标用户的频道

### 揭示页面设计

黑色背景，白色文字，逐步展示（自动播放，不需要用户操作）：

第一屏（停留5秒）：
大字："你以为这些都是真的吗？"
副标题："每一把牌，每一个号码，都在掌控之中。"

第二屏（停留8秒）：
数据展示：
"你一共充值了 ¥XXXX"
"你一共输了 ¥XXXX"
"其中平台抽水 ¥XXXX"
数字用slot machine动画从0滚到实际值

第三屏（停留10秒）：
滚动展示控牌记录：
"2月15日 放炮罚第3局 — 你的牌是我们提前安排的"
"2月16日 六合彩第048期 — 你投了特码49，我们开了13"
...
每条记录像打字机一样逐行出现

第四屏（停留10秒）：
"所有赌博平台都是这样的。"
"你以为的运气，不过是庄家的安排。"
"赢的时候是诱饵，输的时候是收割。"

第五屏（持续）：
"这个平台是 [你的名字] 为你做的。"
"不是为了骗你，而是想让你亲眼看到真相。"
"赌博永远赢不了，因为规则不在你手上。"

底部按钮（第五屏才出现）：
"我知道了"（点击后关闭揭示页面，回到大厅）

## 4. 防关闭机制

- 揭示页面是全屏覆盖，z-index最高
- 禁用浏览器后退按钮（history.pushState占位）
- 没有关闭按钮直到最后一屏
- 如果用户关闭浏览器重新打开，再次显示揭示页面（通过数据库标记）

## 5. 数据库标记

profiles表增加字段：
- is_revealed BOOLEAN DEFAULT false
- revealed_at TIMESTAMPTZ

用户端每次打开App，检查is_revealed → true → 显示揭示页面

## 验证标准

1. 管理后台能选择用户并预览揭示内容
2. 点击启动揭示后，目标用户端立即显示揭示覆盖层
3. 动画流畅播放，数据正确
4. 用户无法关闭直到最后一屏
5. 关闭浏览器重新打开仍显示揭示
6. 点击"我知道了"后恢复正常
```

---

# ═══════════════════════════════════════
# 附录A：经济系统完整逻辑
# ═══════════════════════════════════════

```
所有金钱/钻石变动必须真实发生并记录日志。

## 余额（balance）

来源：
+ admin_topup（管理员充值，模拟微信转账）
+ game_win（游戏赢钱，已扣抽水）
+ lottery_win（六合彩中奖）

去向：
- game_lose（游戏输钱）
- game_rake（抽水，从赢家收益扣）
- lottery_bet（六合彩投注扣款）
- admin_deduct（管理员扣款）

## 钻石（diamonds）

来源：
+ admin_grant（管理员赠送）
+ daily_signin（每日签到+1）

去向：
- room_create（创建房间-2）

## 抽水逻辑

棋牌游戏：
- 抽水比例：rake_percent（默认5%，可在管理后台调整）
- 计算方式：结算金额 × 5% = 平台抽水
- 示例：A赢B 100元，抽水5元，A实得95元，B失去100元
- 抽水从赢家收益中扣除

六合彩：
- 抽水内置于赔率中（真实概率1/49=2.04%，赔率48.9倍≈97.8%返还率，平台吃2.2%）
- 正码赔率8.02（真实概率约12.24%，返还率98.2%）
- 色波赔率4.5-6.5（各有不同返还率）
- 这些赔率可在管理后台微调

## 日志格式

每条balance_log必须包含：
- user_id：谁的余额变了
- amount：变动金额（正数加/负数扣）
- balance_after：变动后余额
- type：变动类型
- description：人类可读描述（如"放炮罚房间827467第3局赢"）
- reference_id：关联的game_round_id或lottery_bet_id
- created_at：时间戳
```

---

# ═══════════════════════════════════════
# 附录B：给TRAE的注意事项
# ═══════════════════════════════════════

```
每个Phase喂给TRAE时，在Prompt最前面加上：

"你是一个全栈工程师，正在开发一个叫'恭喜发财'的棋牌平台Web App。
技术栈：Next.js 14 + TypeScript + Tailwind CSS + Supabase + Vercel。
项目已有基础代码（前面Phase的成果）。
请在现有代码基础上实现以下功能。
要求：
1. 所有代码TypeScript严格模式
2. 组件用React函数组件+Hooks
3. 样式用Tailwind CSS为主，复杂样式用CSS modules
4. 移动端优先，所有交互适配触控
5. 错误处理：所有API调用加try-catch，用户可见的错误用Toast展示
6. 代码注释用中文
7. 每个文件头部写明用途
8. 完成后列出所有新建/修改的文件清单"

TRAE如果一次输出不完（太长），说"继续"让它输出完。
每个Phase做完后在手机上测试，发现问题截图给我，我帮你写修复Prompt。
```

---

# 文档结束
# 所有Phase的Prompt已就绪，按顺序执行即可。
# Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
