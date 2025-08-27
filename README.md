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
X-Api-Resource-Id: your_resource_id  # 可选

{
  "text": "要转换的文字内容",
  "voice_type": "zh_female_xinlingjitang_moon_bigtts",
  "resource_id": "your_resource_id"  # 可选，Header 优先
}
```

#### Resource ID 配置

Resource ID 是可选的资源标识符，用于访问特定的 TTS 资源或音色。

**配置方式**：
1. **前端界面配置**：在设置页面的「语音合成生成（TTS）」区域填写「Resource ID（可选）」
2. **环境变量配置**：设置 `TTS_RESOURCE_ID` 环境变量
3. **请求时指定**：通过 Header `X-Api-Resource-Id` 或 Body `resource_id` 字段传递

**优先级**：Header > Body > 环境变量

**格式要求**：
- 仅允许字母、数字、下划线、连字符
- 长度限制：1-128 字符
- 示例：`my-resource-123`、`voice_model_v2`

**缓存机制**：
- 缓存键包含 Resource ID，不同 Resource ID 的请求会分别缓存
- 相同文本 + 音色 + Resource ID 组合会命中缓存

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

4. **Resource ID 相关错误**
   
   **错误信息**: `INVALID_RESOURCE_ID: Resource ID must contain only alphanumeric characters, underscores, and hyphens (1-128 chars)`
   
   **解决方案**: 
   - 检查 Resource ID 格式，只能包含字母、数字、下划线、连字符
   - 确保长度在 1-128 字符之间
   - 示例正确格式：`my-resource-123`、`voice_model_v2`
   
   **错误信息**: `RESOURCE_NOT_FOUND: 访问受限：请求的语音资源未被授权或不存在`
   
   **解决方案**: 
   - 检查 Resource ID 是否正确
   - 确认账户是否有权限访问该资源
   - 如果启用了降级模式（`TTS_FALLBACK_ON_RESOURCE_ERROR=true`），系统会自动回退到默认音色
   - 联系服务提供商确认资源权限

5. **缓存相关问题**
   
   **问题**: 更换 Resource ID 后仍返回旧的音频
   
   **解决方案**: 
   - Resource ID 是缓存键的一部分，不同 Resource ID 会有独立缓存
   - 如需清除缓存，可重启服务或等待缓存过期（默认7天）
   - 检查前端是否正确传递了新的 Resource ID

### 环境变量配置

#### TTS 相关环境变量

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `TTS_RESOURCE_ID` | 默认 Resource ID | 空 | `my-default-resource` |
| `TTS_FALLBACK_ON_RESOURCE_ERROR` | 资源错误时是否降级到默认音色 | `false` | `true` |
| `TTS_MAX_RETRIES` | 最大重试次数 | `2` | `3` |
| `TTS_TIMEOUT` | 请求超时时间（秒） | `60` | `120` |

### 可观测性与监控

#### 日志格式

系统会输出结构化日志，包含以下字段：

```
[TTS INFO] request_id=abc12345 session_id=def67890 resource_id_hash=xyz98765 cache_hit=true latency=0.123s retry_count=0
```

**字段说明**：
- `request_id`: 请求唯一标识符
- `session_id`: 会话标识符（hash8）
- `resource_id_hash`: Resource ID 的哈希值（hash8，用于隐私保护）
- `cache_hit`: 是否命中缓存
- `latency`: 响应延迟（秒）
- `retry_count`: 重试次数
- `cost`: 费用（仅合成请求）

#### 性能指标

监控以下关键指标：
- `tts_first_byte_latency`: 首字节延迟
- `tts_total_latency`: 总延迟
- `tts_error_rate`: 错误率
- `cache_hit_rate`: 缓存命中率

### 测试工具

项目提供了测试脚本来验证 Resource ID 功能：

```bash
# 契约测试（验证各种 Resource ID 场景）
python test_resource_id.py

# 负载测试（验证性能和稳定性）
python load_test.py
```

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **后端**: Python 3.12, Vercel Functions
- **API**: 火山方舟API, 字节跳动TTS API
- **部署**: Vercel

## 许可证

MIT License