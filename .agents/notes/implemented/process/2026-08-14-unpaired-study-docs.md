# Agent Note: Unpaired Chinese study walkthroughs under docs/study/

Status: implemented

English | [中文](2026-08-14-unpaired-study-docs.zh.md)

## Problem

A full-package implementation walkthrough of `packages/` is a learning artifact: it restates control flow, draws mermaid diagrams, and cites source files. Putting that tree under `docs/` makes relative links to architecture pages and package READMEs mechanically checkable, but the pairing gate treats every `docs/**` file as a bilingual product document. Forcing an English counterpart and a word-budget entry would either duplicate the official contract pages or invent a second authority for the same facts.

## Decision

- **Study walkthroughs live at [docs/study/packages/](../../../../docs/study/packages/README.md).** Each group has one Chinese Markdown file. Pages open with a disclaimer that package READMEs and [docs/subsystems/](../../../../docs/subsystems/README.md) remain the contracts.
- **The tree is an explicit pairing exclusion.** [scripts/translation-pairing.manifest.json](../../../../scripts/translation-pairing.manifest.json) lists `docs/study/`. Files there are Chinese `*.md` only; a `.zh.md` or `.i18n.yaml` under the prefix is a gate failure. The exclusion is also listed in [docs/i18n/README.md](../../../../docs/i18n/README.md).
- **Other Markdown gates still apply.** `verify-md-wrap`, `verify-md-links`, and `verify-mermaid` scan `docs/**`. Study pages use one physical line per paragraph, resolvable relative links, and valid mermaid. They do not use info-string `ts` fences, so `doc-typecheck` does not treat excerpts as compile units.
- **The study tree is unpublished.** [website/docs.ts](../../../../website/docs.ts) does not list these pages. [scripts/doc-budgets.manifest.json](../../../../scripts/doc-budgets.manifest.json) does not give them a ceiling. Standing docs (`AGENTS.md`, [packages/README.md](../../../../packages/README.md)) do not link into the tree.

## Alternatives considered

- **Keep the walkthrough outside `docs/` (for example `study/packages/` at the repo root)** — rejected: every relative link to `docs/architecture.md` and package READMEs would leave the Markdown link gate, and readers would have two documentation roots.
- **Pair every study page as a bilingual product document** — rejected: the walkthrough restates implementation flow that already has a contract home. An English pair would either copy those homes or become a second contract.
- **Exclude the tree from every Markdown gate** — rejected: broken links and invalid mermaid in a 200-package walkthrough would rot silently. Pairing is the only gate that would force a second-language contract.

## Consequences

- Contributors can add or revise Chinese study pages without a counterpart or a budget raise; they still owe wrap, link, and mermaid checks.
- The pairing policy remains exclusions-only. A new unpaired tree still needs a manifest row and a sentence in [docs/i18n/README.md](../../../../docs/i18n/README.md).
- Official architecture and package READMEs stay the lookup home; the study tree may drift and must be rewritten from source when a package's control flow changes.
