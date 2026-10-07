# Installation and operation

[中文](INSTALLATION.md) · [README](../README_en.md) · [Backend behavior](BACKENDS_en.md)

Target DSH `0.2.0-rc.2`, Node `^22.19.0 || >=24` for the Host; library-only use supports Node >=20. Verify other DSH versions separately.

## Standard installation

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-prompt-assembler#main
```

The repository is public. Standard metadata provides `main:src/plugin.js`, `dsh.bundle:cordis.patch.yml` and prebuilt `dist/client.js`. Stock rc.2 needs no core changes. Stop/restart the intended Host, then use the sidebar. Saving and applying are separate; new sessions bind before opening. Standalone use has no global default and does not require Tavern. Repository visibility does not establish npm, tag/release or plugin-directory publication.

## Optional advanced extension

Stop the target Host, then run one installation command from the same checkout. It installs/enables the addon, switches core builds, and retains stock builds for rollback:

```sh
node core-extension/scripts/switch-runtime.mjs install --runtime /path/to/runtime --home /path/to/dsh-home --profile web --prepared /path/to/prepared-core --stock-runtime /path/to/stock-runtime
```

Before the first install, generate prepared-core with `node core-extension/scripts/prepare-request-assembly.mjs /path/to/dsh-rc2-source /path/to/prepared-core`. Stock-runtime must contain unmodified official rc.2 `node_modules/@deepseek-ai/dsh-session` and `dsh-agent-loop`. All target/reference/prepared builds must use 0.2.0-rc.2; the standard plugin must be 0.2.0. The switch uses public `dsh-plugin-manager/operations` for package installation and activation, calling npm by default; `--npm /path/to/npm` selects a command. Preparation verifies pinned source digests; switching rejects unknown builds, damaged backups and incompatible versions.

Subsequent installation or removal needs no prepared/stock input. Stop the Host, run the appropriate single command, then restart:

```sh
node core-extension/scripts/switch-runtime.mjs install --runtime /path/to/runtime --home /path/to/dsh-home --profile web
node core-extension/scripts/switch-runtime.mjs uninstall --runtime /path/to/runtime --home /path/to/dsh-home --profile web
```

Removal only removes the advanced addon and restores stock core. Sessions still bound to core strategies switch to native ST; their previous selections remain in `.assembler-core-switch/selections-before-uninstall.json` within the profile. Custom strategies, native selections, disabled selections and DSH session logs remain. Reinstalling does not restore advanced selections automatically. Initial installation also preserves explicit selections; choose an advanced ST/cache/PHI strategy in the UI to compare advanced behavior. Keep `.assembler-core-switch/` backups and receipt until rollback is complete. Commands target explicit paths and require the target Host to be stopped.

Mounting requires `agentLoop.requestAssemblyVersion===1`. Prepared core alone does not enable advanced strategies; the addon must also be mounted. Missing either permits editing/preview but returns 409 on core application. The standard tarball excludes preparation tooling and the addon bundle; root `scripts/prepare-request-assembly.mjs` is only a source-development compatibility entry.

## Storage and removal

Strategies/session snapshots live in `dshHomePath('dsh-prompt-assembler')/assembly-presets.json`. Explicit `migrateLegacy(root)` merges absent IDs and retains old files and play/native scopes. Unified session selection, including null, wins over legacy mode fallback. Missing backend remains core, without automatic conversion. Standalone use has no default. Attached Tavern uses standard ST style for unbound play sessions and new openings; explicitly installed addons can retain the advanced default. Existing snapshots remain unchanged.

Provider removal withdraws its sources/catalog entries while retaining applied snapshots/storage. Standard user contributions remain native history; advanced request-only contributions stop, while request/assembly remains readable. The switch command moves core selections to native ST before returning to stock; removing the addon separately leaves retained core selections explicitly unavailable. Returning to stock uses retained standard builds. Migrations and real-profile writes require an authorized environment.

## Verification

```sh
npm ci
npm run check
DSH_ASSEMBLER_STOCK_ROOT=<stock-runtime> node --test test/native-backend.test.mjs
DSH_ASSEMBLER_CORE_ROOT=<prepared-runtime> DSH_ASSEMBLER_MANAGER_ROOT=<manager-checkout> node --test test/host.test.mjs test/plugin-host.test.mjs
```

Host fixtures use temporary sessions and offline synthetic providers, covering native/advanced assembly, durable evidence, removal and optional Manager. Skipped fixtures do not establish acceptance. Browser/desktop checks separately cover sidebar, blank sessions, save/apply/preview, secure fetch, switching and removal. Real providers/user profiles require their own authorized acceptance. Directory submissions and tag/release/npm publication require explicit authorization.
