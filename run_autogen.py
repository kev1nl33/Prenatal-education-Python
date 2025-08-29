import autogen
from autogen.agentchat import UserProxyAgent, AssistantAgent, GroupChat, GroupChatManager

# 配置LLM - 使用DeepSeek
config_list = [
    {
        "model": "deepseek-chat",
        "api_key": "sk-75cf4b2233914fc2985af5afc410ba5c",
        "base_url": "https://api.deepseek.com/v1"
    }
]

# 定义llm_config，用于传递给Agent
llm_config = {
    "config_list": config_list,
    "timeout": 180,
}

# ----------------- 最终版专业团队定义 -----------------

# 1. 您的代理 (执行者)
user_proxy = UserProxyAgent(
    name="User_Proxy",
    system_message="人类管理员，负责执行代码、运行测试，并将结果报告给团队。请使用中文与团队沟通。",
    code_execution_config={"work_dir": ".", "use_docker": False},
    human_input_mode="TERMINATE",
)

# 2. 产品经理
product_manager = AssistantAgent(
    name="Product_Manager",
    system_message="作为产品经理，你的职责是定义功能需求、用户故事和验收标准，并协调团队。请聚焦于需要调用火山引擎API实现的功能。请务必使用中文进行交流。",
    llm_config=llm_config,
)

# 3. UX设计师
ux_designer = AssistantAgent(
    name="UX_Designer",
    system_message="作为UI/UX设计师，你的职责是设计与AI生成内容交互的界面流程。你不写代码，而是提供文字描述和指导。请务必使用中文进行交流。",
    llm_config=llm_config,
)

# 4. 前端工程师
frontend_developer = AssistantAgent(
    name="Frontend_Developer",
    system_message="作为前端工程师，你的职责是实现Web界面，并调用后端工程师提供的API来展示从火山引擎获取的内容。请务必使用中文进行交流。",
    llm_config=llm_config,
)

# 5. 后端工程师
backend_developer = AssistantAgent(
    name="Backend_Developer",
    system_message="作为后端工程师，你的职责是开发和维护server.py中的API端点，作为前端和AI工程师服务之间的桥梁。请务必使用中文进行交流。",
    llm_config=llm_config,
)

# 6. AI工程师
ai_engineer = AssistantAgent(
    name="AI_Engineer",
    system_message="作为AI工程师，你是火山引擎API专家。你的职责是编写和维护api/ark.py和api/tts.py中的代码，负责设计prompt、调用外部API、处理错误和优化结果。请务必使用中文进行交流。",
    llm_config=llm_config,
)

# 7. 测试工程师
qa_engineer = AssistantAgent(
    name="QA_Engineer",
    system_message="作为QA工程师，你的职责是为API集成编写pytest测试用例，特别是验证对火山引擎API的调用、错误处理和内容过滤是否符合预期。请务必使用中文进行交流。",
    llm_config=llm_config,
)

# 8. 运维工程师
devops_engineer = AssistantAgent(
    name="DevOps_Engineer",
    system_message="作为DevOps工程师，你的职责是规划API密钥等环境变量的管理，并从监控API延迟、错误率和成本的角度提供建议。请务必使用中文进行交流。",
    llm_config=llm_config,
)

# ----------------- 群聊设置 -----------------

ai_agents = [product_manager, ux_designer, frontend_developer, backend_developer, ai_engineer, qa_engineer, devops_engineer]

group_chat = GroupChat(
    agents=ai_agents,
    messages=[],
    max_round=50
)

# 创建群聊管理器，并为其设定强化指令
manager = GroupChatManager(
    groupchat=group_chat, 
    llm_config=llm_config,
    system_message=(
        "你是一个聊天协调员。你的职责是根据对话历史，选择下一个最合适的发言者。"
        "同时，你必须严格执行一个规定：所有成员的发言都必须是中文。如果有人使用了其他语言，你要提醒他们。"
        "请仅输出被选中成员的名称。"
    )
)

# ----------------- 任务定义与执行 -----------------

task = """
我们需要对项目前端界面进行一次彻底的美化升级，目标是实现一个现代化、专业、美观且响应式的用户界面。

**核心要求:**
1.  **技术框架:** 全面引入 **Bootstrap 5** CSS 框架作为基础。
2.  **设计理念:** 遵循 **Material Design** 的设计原则，注重简洁、直观和用户体验。

**具体执行指令:**
*   **产品经理:** 请你主导此项任务。首先，请定义清晰的用户故事和验收标准，确保团队对最终效果有共同的理解。
*   **UX设计师:** 请基于Bootstrap 5和Material Design原则，规划整体布局、配色方案和字体选型。请使用卡片式设计（Card-based design）来组织不同功能模块，如内容生成、音频播放和声音复刻。
*   **前端工程师:**
    1.  在 `public/index.html` 中引入 Bootstrap 5 的官方CDN链接（包括CSS和JS）。
    2.  重构 `public/index.html` 的HTML结构，使用 Bootstrap 的栅格系统（container, row, col）进行布局。
    3.  将现有的按钮、表单、下拉菜单等元素全部替换为对应的 Bootstrap 组件样式（如 `.btn`, `.form-control`, `.card` 等）。
    4.  根据UX设计师的方案，在 `public/styles.css` 中实现自定义样式，覆盖或补充 Bootstrap 的默认样式，确保视觉风格统一。移除文件中与新设计冲突的旧CSS规则。
*   **QA工程师:** 任务完成后，请验证界面的响应式设计在不同尺寸屏幕（桌面、平板、手机）上均能正常显示，并测试所有交互功能是否正常。

请团队开始工作，确保所有讨论都使用中文。
"""

user_proxy.initiate_chat(manager, message=task)
