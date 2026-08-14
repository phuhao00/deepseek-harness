# 文件

- [Storage、附件与工作区注册表](assets-and-workspaces.md) - 说明通用 storage、内容寻址附件和 workspace registry 各自的数据所有权、恢复、并发与跨服务消费者。
- [会话持久化、恢复、查询与导出](session-persistence-and-query.md) - 说明 JSONL 与 SQLite 会话 provider、压缩与损坏恢复、投影缓存、检索索引和导出的兼容性边界。
- [会话遥测、脱敏与关闭](session-telemetry.md) - 说明 session telemetry 怎样从规范日志捕获事件、在导出前脱敏，并以非阻塞队列和有界关闭向 OTel provider 交付。
- [会话事件、投影与可回放状态](session.md) - 说明 append-only SessionEvent 日志如何成为模型历史、UI 回放、fork 与持久化的唯一事实来源。
