# Installation and operation

[中文](INSTALLATION.md) · [README](../README_en.md) · [Backend behavior](BACKENDS_en.md)

Target DSH `0.2.1-rc.2`, Node `^22.19.0 || >=24` for the Host; library-only use supports Node >=20. Verify other DSH versions separately.

## Standard installation

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-prompt-assembler#codex/dsh-021-compat
```

`#codex/dsh-021-compat` selects this compatibility branch; `#main` follows development. To reproduce another reviewed candidate, use its full reviewed commit and pin the same revision in the caller's lockfile. New versions distribute standard `1.1.1` only, without accompanying core changes.

The repository is public. Standard metadata provides `main:src/plugin.js`, `dsh.bundle:cordis.patch.yml` and prebuilt `dist/client.js`. Stock rc.2 needs no core changes. Stop/restart the intended Host, then open Plugins → Installed plugins → dsh-prompt-assembler → Prompt assembly. Save rules updates the library; Save and apply to this session saves edits before applying; new sessions bind before opening. Standalone use has no global default and does not require Tavern. Repository visibility does not establish npm, tag/release or plugin-directory publication.

## Historical advanced extension

The advanced extension is frozen at Assembler `1.1.0` and DSH `0.2.0-rc.2`, with no commitment to later DSH versions. The source `core-extension/` retains that frozen version only. It is not released with new standard packages and cannot be paired with standard `1.1.1`. Use the [v1.1.0 installation guide](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/docs/INSTALLATION_en.md) and matching source for installation, switching and rollback in old environments.

Before upgrading DSH, restore the old environment to stock using its matching switch tool, then follow the target DSH upgrade procedure and install the new standard plugin. Never copy old prepared builds into newer DSH. Strategies and history remain; legacy core strategies are not converted automatically. Explicitly select and apply a standard strategy. Missing advanced capabilities return 409 `REQUEST_ASSEMBLY_CORE_REQUIRED`.

## Storage and removal

Strategies/session snapshots live in `dshHomePath('dsh-prompt-assembler')/assembly-presets.json`. Explicit `migrateLegacy(root)` merges absent IDs and retains old files and play/native scopes. Unified session selection, including null, wins over legacy mode fallback. Missing backend remains core, without automatic conversion. Standalone use has no default. Attached Tavern uses standard preset-slots-first style for unbound play sessions and new openings; installing the addon does not change that default. Existing snapshots remain unchanged.

Provider removal withdraws its sources/catalog entries while retaining applied snapshots/storage. Standard user contributions remain native history; advanced request-only contributions stop, while request/assembly remains readable. The switch command moves core selections to standard slots before returning to stock; removing the addon separately leaves retained core selections explicitly unavailable. Returning to stock uses retained standard builds. Migrations and real-profile writes require an authorized environment.

## Verification

```sh
npm ci
npm run check
DSH_ASSEMBLER_STOCK_ROOT=<stock-runtime> node --test test/native-backend.test.mjs
```

Historical advanced fixtures cover only the frozen 0.2.0-rc.2 contract. New DSH acceptance uses the stock target runtime.

Host fixtures use temporary sessions and offline synthetic providers, covering standard assembly, durable evidence, removal and optional Manager. Skipped fixtures do not establish acceptance. Browser/desktop checks separately cover the installed-plugin configuration entry, blank sessions, save/apply/preview, secure fetch, switching and removal. Real providers/user profiles require their own authorized acceptance. Directory submissions and tag/release/npm publication require explicit authorization.
