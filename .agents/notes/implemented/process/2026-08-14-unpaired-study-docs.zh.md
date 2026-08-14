# Agent Note: 将中文单语学习走读放在 docs/study/ 且不配对

Status: implemented

[English](2026-08-14-unpaired-study-docs.md) | 中文

## 问题

对 `packages/` 做全包实现走读是学习产物：它复述控制流、绘制 mermaid 图，并引用源文件。把这棵树放在 `docs/` 下，才能让指向架构页和包 README 的相对链接接受机械检查；但配对门禁会把每个 `docs/**` 文件当作双语产品文档。若强制英文对侧和字数预算条目，要么重复官方合同页，要么为同一事实再造第二处权威。

## 决策

- **学习走读位于 [docs/study/packages/](../../../../docs/study/packages/README.md)。** 每个分组对应一份中文 Markdown。页面开头声明：包 README 与 [docs/subsystems/](../../../../docs/subsystems/README.md) 仍是合同。
- **该树是显式配对排除项。** [scripts/translation-pairing.manifest.json](../../../../scripts/translation-pairing.manifest.json) 列出 `docs/study/`。其中只有中文 `*.md`；该前缀下的 `.zh.md` 或 `.i18n.yaml` 会使门禁失败。排除项也写在 [docs/i18n/README.md](../../../../docs/i18n/README.md)。
- **其余 Markdown 门禁仍然生效。** `verify-md-wrap`、`verify-md-links` 和 `verify-mermaid` 会扫描 `docs/**`。学习页遵守一段一行、可解析的相对链接和合法 mermaid。它们不使用 info-string 为 `ts` 的围栏，因此 `doc-typecheck` 不会把摘录当作编译单元。
- **学习树不发布。** [website/docs.ts](../../../../website/docs.ts) 不收录这些页面。[scripts/doc-budgets.manifest.json](../../../../scripts/doc-budgets.manifest.json) 不给它们字数上限。常设文档（`AGENTS.md`、[packages/README.md](../../../../packages/README.md)）不链入该树。

## 备选方案

- **把走读放在 `docs/` 之外（例如仓库根目录的 `study/packages/`）** — 否决：指向 `docs/architecture.md` 和包 README 的相对链接会离开 Markdown 链接门禁，读者也会面对两处文档根。
- **把每份学习页配成双语产品文档** — 否决：走读复述的实现流程已有合同归属。英文对侧要么抄那些归属页，要么变成第二份合同。
- **让该树避开全部 Markdown 门禁** — 否决：一份覆盖约 200 个包的走读若链接断裂或 mermaid 非法，会静默腐烂。配对是唯一会强制第二语言合同的门禁。

## 后果

- 贡献者可以增改中文学习页，无需对侧或提高字数上限；他们仍须通过换行、链接和 mermaid 检查。
- 配对政策仍是「仅排除项」。新增一棵不配对的树，仍然需要一行 manifest 和 [docs/i18n/README.md](../../../../docs/i18n/README.md) 中的一句说明。
- 官方架构文档和包 README 仍是查阅归属；学习树可能漂移，包的控制流变化时必须对照源码重写。
