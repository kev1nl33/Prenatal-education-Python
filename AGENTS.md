# Repository Guidelines
请使用本指南以一致、稳定地推进智能胎教助手的迭代。

## 项目结构与模块组织
- `server.py` 充当本地 HTTP 入口，将 `/api/...` 请求转发给 Vercel 风格处理器，同时提供 `public/` 静态资源。
- `api/` 存放请求处理器，例如 `ark.py`（内容生成）与 `tts.py`，依赖 `services/` 内的共用工具。
- `services/` 汇集缓存、日志、语音适配等工具模块（`cache.py`、`speech/`、`fixtures/`），导入时应保持无副作用。
- `scripts/` 保存维护脚本，如 `make_fixtures.py`，需在仓库根目录运行。
- 静态资产位于 `public/`；生成的音频示例存放在 `demo-sounds/` 与 `services/fixtures/`。

## 构建、测试与开发命令
- `pip install -r requirements.txt` 安装 Python 侧 API 处理器所需依赖。
- `npm install` 拉取 `vercel dev` 所需的最小前端工具链。
- `npm run dev`（即 `vercel dev`）启动本地混合环境；通过环境变量或 `.env` 注入配置。
- `python server.py 8003` 便于在不依赖 Vercel 的情况下调试纯 Python 路由器。
- `python test_resource_id.py` 针对运行中的服务验证 TTS 契约；正常流程期待 200，非法 ID 触发 400。
- `python load_test.py` 压测缓存与限流；提交前按需调整并发参数。

## 编码风格与命名规范
- Python 模块遵循 PEP 8：四空格缩进、`snake_case` 命名、具描述性的模块级文档字符串；倾向显式导入。
- 共用服务应暴露纯函数或轻量类；除日志初始化外避免在导入阶段执行逻辑。
- `public/` 下的前端脚本遵循 ESLint 约束：两空格缩进、单引号、强制分号、禁止 `var`。
- 配置与基准数据文件统一采用小写连字符命名（如 `demo-sounds/voice-map.json`）。

## 测试指南
- 将新增单测放在相关代码旁（如 `api/ark_tests.py`），或归整于未来的 `tests/` 包；文件名以 `test_` 开头。
- 若引入与缓存相关的改动，请在 `test_resource_id.py` 中补充场景函数，便于回归验证。
- 自动化不足时，在 PR 描述中记录手动验证步骤，尤其涉及音频输出或第三方服务调用。

## 提交与 PR 要求
- 参考历史记录使用 Conventional Commits（`feat:`、`fix:`、`chore:`），主题不超过 72 个字符，采用祈使句。
- 需要时在正文引用 Issue ID 或中文上下文，保持摘要便于双语阅读。
- PR 请说明问题背景、验证方式（命令、示例响应），UI 调整附截图，TTS 改动可补充音频样例。

## 环境与配置
- 必需密钥：`ARK_API_KEY`、`ARK_MODEL`、`TTS_APP_ID`、`TTS_ACCESS_TOKEN`、`AUTH_TOKEN`、`ALLOWED_ORIGIN`；本地使用 `.env`，线上配置于 Vercel。
- 通过 `services.state` 提供的辅助函数控制干跑与紧急停用（支持 `X-Dry-Run`、环境变量覆盖）；测量新价格前可利用 `services/cache_backup.py` 清理缓存。
