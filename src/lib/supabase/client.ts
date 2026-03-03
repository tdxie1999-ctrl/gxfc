import { createBrowserClient } from '@supabase/ssr';

// 浏览器端 Supabase 客户端（用于登录、注册、查询个人数据）
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
