# 智能胎教助手

用AI为你和宝宝创造美好的胎教时光

## 功能特性

- 🤖 AI生成胎教内容（基于火山方舟API）
- 🔊 文字转语音功能（基于字节跳动TTS API）
- 📱 响应式设计，支持移动端
- 🎨 现代化UI界面
- 📝 历史记录保存

## 部署说明

### 1. 环境变量配置

#### 方式一：在前端界面配置（推荐）

1. 打开应用首页
2. 在「配置设置」区域填写以下信息：
   - **文本大模型API Key**: 火山引擎豆包模型 API Key
   - **模型 Endpoint ID**: 火山引擎豆包模型 Endpoint ID（可选，默认使用doubao-1.5-pro-32k-250115）
   - **TTS AppID**: 火山引擎 TTS App ID
   - **TTS Access Token**: 火山引擎 TTS Access Token
3. 点击「保存配置」按钮

#### 方式二：在Vercel项目设置中配置

在Vercel项目设置中配置以下环境变量：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `ALLOWED_ORIGIN` | 允许的跨域来源 | `https://your-domain.vercel.app` |
| `ARK_API_KEY` | 火山引擎豆包API密钥 | `your_ark_api_key` |
| `ARK_MODEL` | 豆包模型名称 | `doubao-1.5-pro-32k-250115` |
| `TTS_ACCESS_TOKEN` | TTS API访问令牌 | `your_tts_token` |
| `TTS_APP_ID` | TTS应用ID | `your_app_id` |

### 2. Vercel部署步骤

1. 将代码推送到GitHub仓库
2. 在Vercel中导入GitHub项目
3. 在项目设置 → Environment Variables 中配置上述环境变量
4. 重新部署项目

### 3. 本地开发

```bash
# 安装依赖
pip install -r requirements.txt

# 创建.env文件并配置环境变量
cp .env.example .env
# 编辑.env文件，填入实际的API密钥

# 启动本地服务器
vercel dev
```

## API接口

### 生成胎教内容

```
POST /api/ark
Content-Type: application/json
X-Auth-Token: your_auth_token

{
  "prompt": "请生成一个关于小动物的胎教故事",
  "model": "kimi-k2-250711"
}
```

### 文字转语音

```
POST /api/tts
Content-Type: application/json
X-Auth-Token: your_auth_token

{
  "text": "要转换的文字内容",
  "voice_type": "zh_female_xinlingjitang_moon_bigtts"
}
```

## 故障排除

### 常见错误

1. **AUTH_TOKEN 缺失**
   
   **错误信息**: `生成内容失败：AUTH_TOKEN environment variable is required`
   
   **解决方案**: 
   - **前端配置（推荐）**: 在应用首页的「配置设置」区域填写「访问令牌 (AUTH_TOKEN)」字段并保存
   - **后端配置**: 在 Vercel 项目设置中添加 `AUTH_TOKEN` 环境变量
   - **本地开发**: 创建 `.env` 文件并添加 `AUTH_TOKEN=your_token_here`
   
   **注意**: AUTH_TOKEN 是用于API访问控制的认证令牌，可以设置为任意字符串，前后端需要保持一致

2. **CORS错误**
   - 确保`ALLOWED_ORIGIN`环境变量设置为正确的域名
   - 检查前端请求是否包含正确的`X-Auth-Token`头部

3. **API调用失败**
   - 检查火山方舟API密钥是否有效
   - 检查TTS API令牌是否正确配置

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **后端**: Python 3.12, Vercel Functions
- **API**: 火山方舟API, 字节跳动TTS API
- **部署**: Vercel

## 许可证

MIT License