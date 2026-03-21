# 部署说明

## Vercel 部署步骤
1. 打开 https://vercel.com，用 GitHub 账号登录
2. 点 "Add New Project"，选择 gxfc-app 仓库
3. Framework 会自动识别为 Next.js
4. 在 "Environment Variables" 里添加以下变量（从 .env.local 复制对应值）：
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - ADMIN_ENTRY_KEY
   - ADMIN_PASSWORD
5. 点 Deploy，等待部署完成
6. 部署成功后会得到一个 .vercel.app 结尾的网址

## 每次更新部署
- 在 Codex 里点"提交"按钮 → 填写说明 → 提交
- 如果 GitHub 已连接，Vercel 会自动检测到提交并重新部署
- 部署过程约 1-2 分钟，完成后网址自动更新
