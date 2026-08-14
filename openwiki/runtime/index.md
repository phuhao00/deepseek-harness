# 文件

- [Agent Loop、轮次与步骤](agent-loop.md) - 说明 AgentLoop 如何创建和回收 agent，并将 inbox、模型流、工具调用与会话事件编排为可回放轮次。
- [Agent Preset、Persona 与作用域组合](agent-presets.md) - 说明 preset/persona 如何以受信配置选择空会话、standing mount 和 agent scope 组合工具、提示词与投影。
- [子 Agent、任务与工作流生命周期](async-agents-and-workflows.md) - 定义 jobs、schedule、subagent、ACP 与 worker-thread workflow 的所有权、取消、并发和清理契约。
- [CLI、Profile 与组合启动](boot.md) - 说明 dsh 如何解析调用、组装 Profile 插件树，并以可控关闭方式运行 Web 或 headless 表层。
- [Profile、配置层与本地状态来源](configuration-and-state-sources.md) - 定义 dsh 的 Profile 解析、patch 优先级、热更新，以及 settings、credentials 和启动环境的安全状态边界。
- [LLM、提示词与运行时上下文](llm-and-context.md) - 说明 ctx.llm 的可替换流式 adapter、请求不变量，以及系统提示词和工作区上下文怎样成为可回放模型输入。
- [MCP Client 的连接与工具代际](mcp-client.md) - 说明 MCP server 如何经 stdio 或 Streamable HTTP 接入工具注册表，以及重连、超时和卸载如何保持工具代际安全。
- [工具执行、授权与受限副作用](tool-execution-and-authorization.md) - 说明模型工具从注册、审批和调度到文件、进程和 sandbox 执行的授权、取消与持久化边界。
