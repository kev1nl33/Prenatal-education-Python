# Vercel 部署配置示例

## 📋 部署前准备

### 1. 修改前端配置

在 `script.js` 中修改以下配置：

```javascript
// 将 API_BASE 替换为你的 Vercel 域名
const API_BASE = "https://your-project-name.vercel.app";

// 设置访问令牌（与后端环境变量 AUTH_TOKEN 保持一致）
let AUTH_TOKEN = "your-secure-auth-token-here";
```

### 2. 环境变量配置

在 Vercel 项目设置中配置以下环境变量：

```bash
# 必需的环境变量
ALLOWED_ORIGIN=https://your-project-name.vercel.app
AUTH_TOKEN=your-secure-auth-token-here
ARK_API_KEY=your-volc-ark-api-key
TTS_ACCESS_TOKEN=your-volc-tts-access-token

# 可选的环境变量
ARK_MODEL=doubao-1.5-pro-32k-250115
TTS_APP_ID=your-tts-app-id
```

## 🚀 部署步骤

### 方法一：使用 Vercel CLI（推荐）

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录 Vercel
vercel login

# 3. 在项目根目录初始化
vercel

# 4. 部署到生产环境
vercel --prod
```

### 方法二：GitHub 集成

1. 将代码推送到 GitHub 仓库
2. 在 [Vercel Dashboard](https://vercel.com/dashboard) 中导入项目
3. 配置环境变量
4. 部署

## 🔧 环境变量设置详解

### 在 Vercel Dashboard 中设置

1. 进入项目 → Settings → Environment Variables
2. 添加以下变量：

| 变量名 | 值 | 说明 |
|--------|----|---------|
| `ALLOWED_ORIGIN` | `https://your-project-name.vercel.app` | 允许的前端域名 |
| `AUTH_TOKEN` | `your-secure-token-123` | 访问令牌（自定义） |
| `ARK_API_KEY` | `your-volc-ark-key` | 火山方舟 API 密钥 |
| `TTS_ACCESS_TOKEN` | `your-volc-tts-token` | 火山引擎 TTS 访问令牌 |
| `ARK_MODEL` | `doubao-1.5-pro-32k-250115` | 默认模型（可选） |
| `TTS_APP_ID` | `your-app-id` | TTS 应用 ID（可选） |

### 使用 Vercel CLI 设置

```bash
# 设置生产环境变量
vercel env add ALLOWED_ORIGIN production
vercel env add AUTH_TOKEN production
vercel env add ARK_API_KEY production
vercel env add TTS_ACCESS_TOKEN production

# 查看环境变量
vercel env ls
```

## 🔒 安全配置

### 1. 访问令牌生成

```javascript
// 生成安全的访问令牌
function generateSecureToken() {
    return crypto.randomUUID() + '-' + Date.now();
}

// 示例：a1b2c3d4-e5f6-7890-abcd-ef1234567890-1703123456789
```

### 2. 域名配置

确保 `ALLOWED_ORIGIN` 与实际部署域名完全匹配：

```bash
# 正确示例
ALLOWED_ORIGIN=https://prenatal-assistant.vercel.app

# 错误示例（不要使用通配符）
ALLOWED_ORIGIN=*
ALLOWED_ORIGIN=https://*.vercel.app
```

## 📝 部署检查清单

- [ ] 修改 `script.js` 中的 `API_BASE` 为实际域名
- [ ] 设置 `AUTH_TOKEN` 与后端环境变量一致
- [ ] 在 Vercel 中配置所有必需的环境变量
- [ ] 确认 `ALLOWED_ORIGIN` 与部署域名匹配
- [ ] 测试 API 接口是否正常工作
- [ ] 验证 CORS 配置是否正确

## 🧪 测试部署

### 1. 本地测试

```bash
# 使用 Vercel 本地开发服务器
vercel dev

# 访问 http://localhost:3000 测试
```

### 2. 生产环境测试

部署后访问你的 Vercel 域名，测试以下功能：

1. 配置保存功能
2. 文本内容生成
3. 语音合成功能
4. 错误提示是否正常显示

## 🔧 故障排除

### 常见问题

1. **401 Unauthorized**
   - 检查 `AUTH_TOKEN` 是否在前后端保持一致
   - 确认环境变量已正确设置

2. **CORS 错误**
   - 验证 `ALLOWED_ORIGIN` 是否与访问域名匹配
   - 检查是否包含协议（https://）

3. **API 调用失败**
   - 确认火山引擎 API 密钥是否有效
   - 检查网络连接和 API 配额

### 调试方法

```javascript
// 在浏览器控制台中调试
console.log('API_BASE:', API_BASE);
console.log('AUTH_TOKEN:', AUTH_TOKEN);

// 测试 API 连接
fetch(`${API_BASE}/api/ark`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': AUTH_TOKEN
    },
    body: JSON.stringify({ prompt: 'test', model: 'test' })
}).then(r => console.log('Status:', r.status));
```

## 📚 相关文档

- [Vercel 部署文档](https://vercel.com/docs)
- [Vercel 环境变量](https://vercel.com/docs/concepts/projects/environment-variables)
- [火山引擎 API 文档](https://www.volcengine.com/docs/)