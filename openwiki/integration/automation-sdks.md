---
type: 自动化协议设计
title: ACP、TypeScript SDK 与 Python SDK
description: 说明进程外自动化接口的 stdio 生命周期、会话语义、权限边界与 TypeScript/Python 分发契约。
tags: [integration, acp, sdk, python, json-rpc]
---

# ACP、TypeScript SDK 与 Python SDK

这些接口面向程序，而非 Web 展示层。它们创建/驱动 Agent，最终仍受[Agent Loop](../runtime/agent-loop.md)、会话日志和[工具授权](../runtime/tool-execution-and-authorization.md)约束。

## ACP

`packages/acp/acp/src/index.ts` 是自动化专用 Agent Client Protocol JSON-RPC stdio server。它创建 bridge-owned fresh agents；只向 wire 发送已提交 assistant text（图片变为文本占位），不泄露 chunks、reasoning、工具 trace、计划或标题。一个 session 同时只允许一个 prompt；prompt 的完成关联其 turn，并等 whole-agent idle。

`approval/request` 被映射为 `allow-once`/`reject-once`，未知响应绝不成为持久 grant。断连/dispose 时停止准入、取消 owned agents 并 child-first drain continuable descendants；drain 失败不得妨碍父 cleanup。重点测试：`packages/acp/acp/tests/dispose.spec.ts`。

## TypeScript 与 Python

`packages/sdk/protocol` 定义 SDK runtime 通信，`sdk/client` 驱动外部运行时，`sdk/server` 经 stdio JSON-RPC 服务请求。调用方提供可执行 runtime 和 `cordis.yml`；SDK 组本身不构建用户项目。

Python 的 `python/sdk` 发布 `deepseek-harness-sdk`（import `deepseek_harness`），默认拉取同版本 `deepseek-harness-runtime-bin` 平台 wheel。`DeepSeekHarness` 保留启动的子进程以复用多次调用，必须作为 context manager 或调用 `close()`。默认运行 `dsh-jsonrpc-agent`，通过 `DSH_CORDIS_CONFIG` 注入默认配置；显式 `runtime_bin`、`bridge_bin` 或 `launch_args_override` 会禁用该注入。`Session.run()` 返回 root session 的活动区间结果，后代通知可进入 notifications，但 `events` 只含 root。

## Python SDK：启动、回合与 JSON-RPC

`DeepSeekHarness` 的子进程惰性启动：`start()` 在 `_initialized` 已为真时无操作，否则 `HarnessClient.start()` 后发送 `initialize(cwd, provider, model, max_tokens)`；`max_tokens is None` 时 wire payload 省略 `maxTokens`，否则为 `maxTokens`。`__enter__` 调用 `start()`，`__exit__` 与显式 `close()` 都关闭 client 并将 `_initialized` 复位为 false；initialize 失败会调用 `HarnessClient.close()`，所以失败的运行时不会残留。

`cwd` 是 agent/workspace 的绝对路径，同时写入 `DSH_CWD` 并放入 initialize payload；`runtime_cwd` 单独决定 subprocess `Popen(cwd=...)`，缺省为 `cwd`；`session_root` 只写 `DSH_SESSION_ROOT`。`api_key`/`base_url` 分别写 `DEEPSEEK_API_KEY`/`DEEPSEEK_BASE_URL`，`cordis` 写 `DSH_CORDIS_CONFIG`；这些均是子进程环境覆盖，默认 config 不内联 secret。仅当使用 bundled runtime、没有显式 launch/runtime/bridge channel 且 `DSH_CORDIS_CONFIG` 为空或缺失时，client 注入 bundled `runtime/cordis.yml`；非空显式配置及非 bundled 启动绝不覆盖。该默认 config 用环境 credential chain 和 base URL，`DSH_SESSION_ROOT ?? ./.sessions` 选 JSONL 根，`DSH_CWD ?? process.cwd()` 配置 bash 与 fs。

`Session.run()` 先调用 `session/prompt` 获得 `messageId`，订阅中只在根 session 的 `session.event`/`agent/inbox/spliced.data.inserted[]` 出现同 id 后才开始收集；先前或不匹配通知跳过。仅 root `session.status: idle` 结束本次区间。`events` 只收集 root `session.event`，而 session-tree subscription 的 `notifications` 含已知递归 subagent 后代。最后有效 `assistant/message` 的文本块拼成 `final_response`；反向找到的最后 `turn/end` 缺少字符串 `data.reason.kind` 时抛 `SdkProtocolError`。

`HarnessClient` 是 stdio JSON-RPC multiplexer：每个请求用 UUID 创建单 waiter 并登记 `_responses`；收到仅带 id 的消息即弹出 waiter，`error` 变为 `JsonRpcError`，否则交付 `result`，最终 `request()` 要求 result 为 JSON object 并以 Pydantic response model 校验。带 `id` 和 `method` 的入站消息进入 `IncomingRequest` 队列；只带 `method` 的消息是 `Notification`。宿主以 `respond(id, result)` 写 `{jsonrpc,id,result}`，或 `respond_error` 写 `{jsonrpc,id,error:{code,message,data?}}`。

通知收到 `subagent.started` 时记录 child→parent；`subagent.started`/`finished` 用 parent 或 exact child 判断，普通通知沿父链追溯根。`visited` 集合使环终止，child id 复用时新映射覆盖旧父；未投递给任何订阅者的通知仍进入全局队列，`NotificationSubscription.close()` 幂等注销。

请求 timeout 用 `time.monotonic()` 计算剩余时间、移除 waiter，并附加最多 400 行 stderr tail/exit code。reader stdout 结束或异常会同时失败 response waiters、订阅者、全局 notification queue 和 incoming-request queue；stdin write 失败转换为带诊断的 `TransportClosedError`。关闭顺序固定为尝试 shutdown、关闭 stdin、terminate、等待，超时则 kill，随后 reset process 并 fail waiters，因此可重复调用。

## Bundled runtime carrier

`python/sdk-runtime` 同时有 production `exe` 和 dev-only `node` carrier。`resolve_bundled_launch_args(mode)` 优先显式 `mode`，其次 `DSH_RUNTIME_MODE`，最后自动；自动只选择单文件 exe，node 必须显式 `node`。支持 `linux`/`darwin` 到 `linux`/`macos`，`x86_64`/`amd64` 到 `x64`、`arm64`/`aarch64` 到 `arm64`；不支持平台、未知 mode 或缺 artifact 均明确失败。macOS exe 额外要求相邻 `-spawn-helper`；node 模式要求完整 `runtime/node` deploy closure、其中的 packaged bin，以及 PATH 上 Node >=22.19，不能用于 production wheel/sdist。

重点 Python 测试：`python/sdk/tests/test_client.py` 的 `test_initialize_failure_reaps_started_runtime`（initialize 失败回收）、cwd/initialize、late idle、桥接 request、subscription、timeout/close 和 explicit config cases；`test_runtime_resolution.py` 的 mode precedence、platform 与 macOS helper。Python runtime 的可执行闭包、平台 wheel 与 release 见[发布制品与生成契约](../engineering/release-artifacts-and-generated-contracts.md)。聚焦验证：`pnpm vitest run packages/acp packages/sdk`，Python 运行 `python -m pytest python/sdk/tests`（依赖已安装环境）。