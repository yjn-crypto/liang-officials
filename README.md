# 梁代职官查询换算系统 — 网页版

> 南朝梁官班制查询 + 刺史年表 + **AI 智能识别（DeepSeek）**

将微信小程序转换为 GitHub Pages 网页版，通过 Cloudflare Worker 安全代理 DeepSeek API。

---

## 📂 项目结构

```
├── index.html                  # 前端页面（单页应用）
├── governors.json              # 刺史年表数据
├── cloudflare-worker/          # DeepSeek API 代理
│   ├── src/index.js            # Cloudflare Worker 脚本
│   ├── wrangler.toml           # Worker 配置
│   └── package.json            # 依赖
├── .gitignore
└── README.md
```

## 🚀 快速部署

### 1. 部署 GitHub Pages

```bash
# 在 GitHub 新建仓库，然后：
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

然后在 GitHub 仓库 → **Settings** → **Pages**：
- Source: **Deploy from a branch**
- Branch: `main`
- Folder: `/`
- 点 **Save**

### 2. 部署 Cloudflare Worker（AI 功能）

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
npx wrangler login

# 进入 Worker 目录
cd cloudflare-worker

# 安装依赖
npm install

# 部署 Worker
npx wrangler deploy

# 设置 DeepSeek API Key（重点！）
npx wrangler secret put DEEPSEEK_API_KEY
# 然后粘贴你的 DeepSeek API Key，回车确认
```

### 3. 配置前端

打开 `index.html`，找到开头的 `WORKER_URL` 变量，改成你的 Worker 地址：

```js
var WORKER_URL = 'https://liang-officials-api.xxxx.workers.dev';
```

提交并推送：

```bash
git add index.html
git commit -m "配置 Worker URL"
git push
```

---

## 🔒 安全说明

| 内容 | 是否可提交到公开仓库 |
|------|:-------------------:|
| `index.html`（前端代码） | ✅ 可以（无 API Key） |
| `cloudflare-worker/`（代理代码） | ✅ 可以（无 API Key） |
| **DeepSeek API Key** | ❌ **绝对不要** |

**API Key 存在 Cloudflare Worker 的环境变量中**（通过 `wrangler secret put` 设置），不会出现在任何代码文件里。前端通过 `fetch(WORKER_URL)` 调用 Worker，Worker 再携带 API Key 请求 DeepSeek。

---

## 🧩 功能说明

### 官班查询
- **精确搜索**：直接匹配本地数据库
- **模糊搜索**：子串匹配 + 组件拆解 + 错别字纠正
- **🤖 AI 智能查询**：本地查不到时，点击按钮调用 DeepSeek 推理

### 批量识别
- **开始识别**：本地算法扫描文本中的官职
- **🤖 AI 补全遗漏官职**：DeepSeek 智能提取并补全

### 刺史年表
- 交互式表格，点击可查看详情
- **🤖 AI 解析史料**：从文本中提取刺史任命信息

---

## 🛠️ 技术栈

- **前端**：纯 HTML / CSS / JavaScript（无框架依赖）
- **AI 代理**：Cloudflare Workers
- **AI 模型**：DeepSeek Chat
- **部署**：GitHub Pages

## ⚠️ 注意事项

1. Cloudflare Worker 免费版每天有 10 万次请求额度，个人使用完全足够
2. DeepSeek API 调用会产生费用（极低），请关注 [DeepSeek 官网](https://platform.deepseek.com/) 的用量
3. 如果不需要 AI 功能，可以不部署 Worker，所有本地功能（精确/模糊搜索）仍然可用
