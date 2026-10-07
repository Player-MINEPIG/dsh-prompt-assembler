# Installation and operation

[中文](INSTALLATION.md) · [README](../README_en.md) · [Backend behavior](BACKENDS_en.md)

Target DSH `0.2.0-rc.2`, Node `^22.19.0 || >=24` for the Host; library-only use supports Node >=20. Verify other DSH versions separately.

## Standard installation

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-prompt-assembler#main
```

The repository is public. Standard metadata provides `main:src/plugin.js`, `dsh.bundle:cordis.patch.yml` and prebuilt `dist/client.js`. Stock rc.2 needs no core changes. Stop/restart the intended Host, then use the sidebar. Saving and applying are separate; new sessions bind before opening. Standalone use has no global default and does not require Tavern. Repository visibility does not establish npm, tag/release or plugin-directory publication.

## Optional advanced extension

Pack core-extension separately from the same checkout, then explicitly enable its tgz:

```sh
npm ci
npm run build
npm pack ./core-extension --ignore-scripts --pack-destination .local/packages
node core-extension/scripts/prepare-request-assembly.mjs <DSH-0.2.0-rc.2-source> <separate-output>
dsh plugin --profile web add /path/to/dsh-prompt-assembler-core-0.2.0.tgz
```

Replace placeholder paths. The addon peers with `dsh-prompt-assembler@0.2.0`, sharing its store/UI. Preparation verifies pinned Session/AgentLoop versions and source digests, writes separate output and a receipt, and refuses overlapping paths. It does not modify source or installed core. Review output, stop/back up the authorized Host, then replace builds through that environment's core installation procedure. Plugin installation, preparation and runtime replacement are separate actions.

Mounting requires `agentLoop.requestAssemblyVersion===1`. Prepared core alone does not enable advanced strategies; the addon must also be mounted. Missing either permits editing/preview but returns 409 on core application. The standard tarball excludes preparation tooling and the addon bundle; root `scripts/prepare-request-assembly.mjs` is only a source-development compatibility entry.

## Storage and removal

Strategies/session snapshots live in `dshHomePath('dsh-prompt-assembler')/assembly-presets.json`. Explicit `migrateLegacy(root)` merges absent IDs and retains old files and play/native scopes. Unified session selection, including null, wins over legacy mode fallback. Missing backend remains core, without automatic conversion. Standalone use has no default. Attached Tavern uses standard ST style for unbound play sessions and new openings; explicitly installed addons can retain the advanced default. Existing snapshots remain unchanged.

Provider removal withdraws its sources/catalog entries while retaining applied snapshots/storage. Standard user contributions remain native history; advanced request-only contributions stop, while request/assembly remains readable. Disable or switch core strategies before removing the addon; retained core selections fail explicitly. Returning to stock uses the original retained core builds. Migrations and real-profile writes require an authorized environment.

## Verification

```sh
npm ci
npm run check
DSH_ASSEMBLER_STOCK_ROOT=<stock-runtime> node --test test/native-backend.test.mjs
DSH_ASSEMBLER_CORE_ROOT=<prepared-runtime> DSH_ASSEMBLER_MANAGER_ROOT=<manager-checkout> node --test test/host.test.mjs test/plugin-host.test.mjs
```

Host fixtures use temporary sessions and offline synthetic providers, covering native/advanced assembly, durable evidence, removal and optional Manager. Skipped fixtures do not establish acceptance. Browser/desktop checks separately cover sidebar, blank sessions, save/apply/preview, secure fetch, switching and removal. Real providers/user profiles require their own authorized acceptance. Directory submissions and tag/release/npm publication require explicit authorization.
