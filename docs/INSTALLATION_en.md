# Installation and operation

[中文](INSTALLATION.md) · [README](../README_en.md) · [Backend behavior](BACKENDS_en.md)

Target DSH `0.2.0-rc.2`, Node `^22.19.0 || >=24` for the Host; library-only use supports Node >=20. Verify other DSH versions separately.

## Standard installation

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-prompt-assembler#v1.0.0
```

`#v1.0.0` pins this version; `#main` follows development. To reproduce another reviewed candidate, use its full reviewed commit and pin the same revision in the caller's lockfile. Standard and optional addon versions are both `1.0.0`; the addon requires exact standard peer `1.0.0`. Check their source revisions together as well.

The repository is public. Standard metadata provides `main:src/plugin.js`, `dsh.bundle:cordis.patch.yml` and prebuilt `dist/client.js`. Stock rc.2 needs no core changes. Stop/restart the intended Host, then open Settings → Prompt assembly. Save rules updates the library; Save and apply to this session saves edits before applying; new sessions bind before opening. Standalone use has no global default and does not require Tavern. Repository visibility does not establish npm, tag/release or plugin-directory publication.

## Optional advanced extension

Install standard `1.0.0` with the command above, then obtain the same tagged source and preparation-tool dependencies:

```sh
git clone --branch v1.0.0 --depth 1 https://github.com/Player-MINEPIG/dsh-prompt-assembler.git
cd dsh-prompt-assembler
npm ci
node core-extension/scripts/prepare-request-assembly.mjs /path/to/dsh-rc2-source /path/to/prepared-core
```

`dsh-rc2-source` is the complete official DSH `0.2.0-rc.2` source root. Preparation verifies pinned core source digests,
and the output directory must be separate from the source. It only creates standalone build artifacts.
Initial installation also needs an unmodified official rc.2 `stock-runtime` to verify the target and retain rollback files.
`runtime` is the target Host's runtime root, `home` is its DSH_HOME, and `profile` must match the standard plugin installation.

Stop the target Host, then run this installation command from the checkout. It installs/enables the addon, switches core builds, and retains stock builds for rollback:

```sh
node core-extension/scripts/switch-runtime.mjs install --runtime /path/to/runtime --home /path/to/dsh-home --profile web --prepared /path/to/prepared-core --stock-runtime /path/to/stock-runtime
```

Stock-runtime must contain official rc.2 `node_modules/@deepseek-ai/dsh-session` and `dsh-agent-loop`. All target/reference/prepared builds must use 0.2.0-rc.2; the standard plugin must be 1.0.0. The switch uses public `dsh-plugin-manager/operations` for package installation and activation, calling npm by default; `--npm /path/to/npm` selects a command. Switching rejects unknown builds, damaged backups and incompatible versions.

Restart the Host, choose “Advanced · core extension” in Settings → Prompt assembly, inspect the assembly result, then save and apply to the session. Installing the addon does not automatically switch existing strategies.

Subsequent installation or removal needs no prepared/stock input. Stop the Host, run the appropriate single command, then restart:

```sh
node core-extension/scripts/switch-runtime.mjs install --runtime /path/to/runtime --home /path/to/dsh-home --profile web
node core-extension/scripts/switch-runtime.mjs uninstall --runtime /path/to/runtime --home /path/to/dsh-home --profile web
```

Removal only removes the advanced addon and restores stock core. Sessions still bound to core strategies switch to standard slots; their previous selections remain in `.assembler-core-switch/selections-before-uninstall.json` within the profile. Custom strategies, native selections, disabled selections and DSH session logs remain. Reinstalling does not restore advanced selections automatically. Initial installation also preserves explicit selections; choose the advanced preset-slots strategy in the UI to compare advanced behavior. Keep `.assembler-core-switch/` backups and receipt until rollback is complete. Commands target explicit paths and require the target Host to be stopped.

Mounting requires `agentLoop.requestAssemblyVersion===1`. Prepared core alone does not enable advanced strategies; the addon must also be mounted. Missing either permits editing/preview but returns 409 on core application. The standard tarball excludes preparation tooling and the addon bundle; root `scripts/prepare-request-assembly.mjs` is only a source-development compatibility entry.

## Storage and removal

Strategies/session snapshots live in `dshHomePath('dsh-prompt-assembler')/assembly-presets.json`. Explicit `migrateLegacy(root)` merges absent IDs and retains old files and play/native scopes. Unified session selection, including null, wins over legacy mode fallback. Missing backend remains core, without automatic conversion. Standalone use has no default. Attached Tavern uses standard preset-slots-first style for unbound play sessions and new openings; installing the addon does not change that default. Existing snapshots remain unchanged.

Provider removal withdraws its sources/catalog entries while retaining applied snapshots/storage. Standard user contributions remain native history; advanced request-only contributions stop, while request/assembly remains readable. The switch command moves core selections to standard slots before returning to stock; removing the addon separately leaves retained core selections explicitly unavailable. Returning to stock uses retained standard builds. Migrations and real-profile writes require an authorized environment.

## Verification

```sh
npm ci
npm run check
DSH_ASSEMBLER_STOCK_ROOT=<stock-runtime> node --test test/native-backend.test.mjs
DSH_ASSEMBLER_CORE_ROOT=<prepared-runtime> DSH_ASSEMBLER_MANAGER_ROOT=<manager-checkout> node --test test/host.test.mjs test/plugin-host.test.mjs
```

Host fixtures loading `core-extension` from a source checkout also need its standard-package peer to resolve. After `npm ci` in the development checkout, `ln -s .. node_modules/dsh-prompt-assembler` provides that local peer link. This affects only development dependencies and is not a plugin installation step.

Host fixtures use temporary sessions and offline synthetic providers, covering native/advanced assembly, durable evidence, removal and optional Manager. Skipped fixtures do not establish acceptance. Browser/desktop checks separately cover the Settings entry, blank sessions, save/apply/preview, secure fetch, switching and removal. Real providers/user profiles require their own authorized acceptance. Directory submissions and tag/release/npm publication require explicit authorization.
