# Gemini代码助手上下文

本文档为Gemini代码助手提供项目背景信息，以帮助其理解项目结构、开发规范和任务。

## 项目概述

本项目是一个“智能胎教助手”，使用AI生成内容，并通过文本转语音（TTS）功能进行音频播放。它采用Python后端（Vercel Functions）和原生HTML/CSS/JS前端构建。

该应用允许用户生成胎教故事并将其转换为音频，同时还包含声音克隆功能。

**主要技术栈:**

*   **后端:** Python 3.12, Vercel无服务器函数
*   **前端:** HTML5, CSS3, JavaScript (ES6+)
*   **API:**
    *   火山方舟API，用于内容生成
    *   字节跳动TTS API，用于文本转语音
    *   火山引擎声音克隆API，用于声音克隆

## 构建与运行

### 环境要求

*   Python 3.12
*   Node.js 18.x
*   Vercel CLI

### 安装

1.  **安装Python依赖:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **安装Node.js依赖:**
    ```bash
    npm install
    ```

### 本地运行项目

1.  **设置环境变量:**
    通过复制`.env.example`文件创建一个`.env`文件，并填入所需的API密钥和令牌。
    ```bash
    cp .env.example .env
    ```

2.  **启动开发服务器:**
    ```bash
    vercel dev
    ```
    这将在本地启动一个服务器，通常地址为 `http://localhost:3000`。

    或者，你也可以直接运行Python服务器：
    ```bash
    python server.py
    ```
    服务器将运行在 `http://localhost:8000`。

## 开发规范

*   **后端:** 后端代码位于`api/`目录中，按API模块组织。主服务器逻辑在`server.py`中，负责将请求路由到相应的API处理器。
*   **前端:** 前端是位于`public/`目录中的静态文件。
*   **认证:** API请求通过`X-Auth-Token`请求头进行认证。允许的令牌在`.env`文件中配置。
*   **CORS:** 跨域资源共享（CORS）配置为允许来自`ALLOWED_ORIGIN`环境变量中指定域名的请求。
*   **代码检查:** 项目使用ESLint进行JavaScript代码检查，配置文件为`eslint.config.js`。

## API端点

后端在`/api/`路径下提供以下API端点：

*   **`POST /api/ark`**: 生成胎教内容。
    *   **请求体:** `{ "prompt": "你的提示词" }`
*   **`POST /api/tts`**: 将文本转换为语音。
    *   **请求体:** `{ "text": "要转换的文本", "voice_type": "音色名称", "emotion": "情感", "quality": "音质" }`
*   **`POST /api/voice_clone`**: 从音频文件创建声音克隆。
    *   **请求体:** `{ "action": "upload", "audio_data": "base64编码的音频", "speaker_id": "说话人名称" }`
*   **`GET /api/voice_clone?action=status&speaker_id=说话人名称`**: 检查声音克隆任务的状态。
*   **`GET /api/voice_clone?action=list`**: 列出可用的克隆声音。
*   

## 注意事项
1. 本项目中所有的示例代码使用中文注释
2. 遇到问题优先使用Context7搜索最新解决方案
3. 本项目主要使用火山引擎服务，如火山方舟API、字节跳动TTS API、火山引擎声音克隆API等
4. 本项目的代码仅供参考，实际使用时请根据火山引擎的最新文档进行操作