# 生产环境部署指南

## HTTP 500错误修复说明

本指南帮助您解决胎教应用在Vercel生产环境中出现的HTTP 500错误。

### 问题原因

HTTP 500错误主要由以下原因导致：
1. 缺少必要的环境变量配置
2. TTS API密钥未正确设置
3. 运行模式配置错误

### 解决方案

#### 1. 配置Vercel环境变量

登录Vercel控制台，进入项目设置，在Environment Variables中添加以下变量：

**必需的环境变量：**
```
MODE=prod
TTS_APP_ID=your_actual_tts_app_id
TTS_ACCESS_TOKEN=your_actual_tts_access_token
ARK_API_KEY=your_actual_ark_api_key
ARK_MODEL=doubao-1.5-pro-32k-250115
```

**可选的环境变量：**
```
ALLOWED_ORIGIN=https://your-domain.vercel.app
MAX_DAILY_COST=10.0
TTS_TIMEOUT=10
```

#### 2. 获取API密钥

**火山引擎TTS API：**
1. 访问火山引擎控制台
2. 开通语音技术服务
3. 创建应用获取APP_ID
4. 生成访问令牌获取ACCESS_TOKEN

**火山方舟API：**
1. 访问火山方舟控制台
2. 创建API密钥
3. 选择合适的模型

#### 3. 部署步骤

1. 确保所有环境变量已正确配置
2. 在Vercel中重新部署项目
3. 检查部署日志确认无错误
4. 测试TTS功能是否正常工作

### 错误排查

#### 常见错误信息及解决方法：

**"生产环境TTS配置错误：缺少必要的API密钥"**
- 检查TTS_APP_ID和TTS_ACCESS_TOKEN是否已设置
- 确认环境变量值不包含引号或多余空格

**"TTS认证失败：API密钥无效"**
- 验证TTS_ACCESS_TOKEN是否正确
- 检查API密钥是否已过期

**"TTS访问被拒绝：请检查API权限设置"**
- 确认TTS_APP_ID配置正确
- 检查火山引擎账户权限和配额

### 本地开发

如果您只需要本地开发，可以在`.env`文件中设置：
```
MODE=local
```

这将使用本地适配器生成占位音频，无需配置真实的API密钥。

### 技术支持

如果问题仍然存在，请检查：
1. Vercel部署日志
2. 浏览器开发者工具的网络面板
3. 确认所有环境变量已正确保存并重新部署

---

**注意：** 请妥善保管您的API密钥，不要在代码中硬编码或提交到版本控制系统。