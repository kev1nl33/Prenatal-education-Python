# 智能胎教助手 - 外部访问部署指南

## 📋 项目概述

本项目是一个基于火山引擎API的智能胎教助手，包含：
- **前端**：HTML + CSS + JavaScript 纯静态网页
- **后端**：Python代理服务器（解决CORS跨域问题）

## 🚀 推荐部署方案

### 方案一：Vercel（推荐）

**优势**：免费、全球CDN、支持无服务器函数、自动HTTPS

**步骤**：

1. **创建Vercel配置**
   ```json
   // vercel.json
   {
     "functions": {
       "api/proxy.py": {
         "runtime": "python3.9"
       }
     },
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "/api/proxy.py"
       }
     ]
   }
   ```

2. **创建API函数**
   ```python
   # api/proxy.py
   import json
   import urllib.request
   from urllib.error import HTTPError

   def handler(request):
       # 处理CORS和API转发
       # 具体实现见下方完整代码
   ```

3. **部署到Vercel**
   ```bash
   npm i -g vercel
   vercel login
   vercel --prod
   ```

### 方案二：Netlify

**优势**：一体化解决方案、表单处理、分支预览

**步骤**：

1. **创建netlify.toml**
   ```toml
   [build]
   publish = "."
   
   [[redirects]]
   from = "/api/*"
   to = "/.netlify/functions/:splat"
   status = 200
   ```

2. **创建Functions**
   ```javascript
   // netlify/functions/proxy.js
   exports.handler = async (event, context) => {
     // API代理逻辑
   }
   ```

### 方案三：GitHub Pages + 外部API代理

**适用场景**：纯静态托管 + 第三方API代理服务

1. **GitHub Pages部署**
   - 推送代码到GitHub
   - Settings → Pages → 选择分支

2. **使用第三方CORS代理**
   - 修改API调用地址
   - 使用cors-anywhere等服务

## 🔧 本地开发环境

```bash
# 启动Python代理服务器
python3 proxy-server.py

# 在浏览器打开
open http://localhost:8012
```

## 📁 完整部署文件结构

```
prenatal-education-assistant/
├── index.html              # 主页面
├── script.js               # 前端逻辑
├── styles.css              # 样式文件
├── proxy-server.py         # 本地开发代理
├── requirements.txt        # Python依赖
├── vercel.json            # Vercel配置
├── api/
│   └── proxy.py           # Vercel函数
└── netlify/
    └── functions/
        └── proxy.js       # Netlify函数
```

## 🔑 环境变量配置

部署时需要配置的环境变量：

```bash
# 可选：预设API密钥（不推荐在客户端代码中硬编码）
VOLC_TEXT_API_KEY=your_text_api_key
VOLC_TTS_ACCESS_TOKEN=your_tts_token
```

## 🌐 域名配置

### 自定义域名绑定

1. **Vercel**
   - Vercel Dashboard → 项目 → Settings → Domains
   - 添加域名并配置DNS

2. **Netlify**
   - Netlify Dashboard → Site Settings → Domain Management
   - 添加自定义域名

3. **GitHub Pages**
   - Repository Settings → Pages → Custom Domain

## 🔒 安全考虑

1. **API密钥安全**
   - 用户在前端输入密钥
   - 不在代码中硬编码密钥
   - 使用HTTPS传输

2. **CORS配置**
   - 严格控制允许的来源
   - 验证请求头

3. **速率限制**
   - 在代理层添加请求限制
   - 防止API滥用

## 🚦 部署检查清单

- [ ] 前端资源正常加载
- [ ] API代理功能正常
- [ ] CORS头正确配置
- [ ] HTTPS证书有效
- [ ] 自定义域名解析正确
- [ ] 移动端兼容性测试
- [ ] API密钥输入功能正常
- [ ] 音频播放功能正常

## 📞 技术支持

如遇到部署问题，可以：
1. 检查浏览器控制台错误信息
2. 查看服务器日志
3. 验证API密钥配置
4. 测试网络连接

## 🔄 更新部署

每次代码更新后：
1. 提交到Git仓库
2. 自动触发重新部署
3. 验证新功能正常运行

---

**建议优先选择Vercel方案**，因为它提供了最佳的开发体验和免费额度。