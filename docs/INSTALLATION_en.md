# Installation and operation

[中文](INSTALLATION.md) · [README](../README_en.md) · [Backend behavior](BACKENDS_en.md)

Target DSH `0.2.1-rc.2` / `0.2.1-rc.3`, Node `^22.19.0 || >=24` for the Host; library-only use supports Node >=20. Host and LLM peer ranges are `>=0.2.1-rc.2 <0.2.2-0`; later 0.2.1 RCs are admitted by policy, while 0.2.2 and its prereleases require reassessment.

For compatibility regression, point `DSH_ASSEMBLER_STOCK_ROOT` at each official rc.2 and rc.3 dependency root and run `npm run check`. Admission tests also cover later RCs, the final release and rejection of the next series; these values test policy, not execution on future Hosts. Standard Host tests use temporary data and synthetic providers. Separately check the plugin-detail entry, strategy preview/application and native sessions after removal in an isolated Web Host. Validate the official desktop and real providers separately; keep run records in `.local/`.

## Standard installation

Open **Plugins → Add plugin** in DSH. Enter this Release asset URL, then install and enable the independent Assembler.

```text
https://github.com/Player-MINEPIG/dsh-prompt-assembler/releases/download/v1.1.3/dsh-prompt-assembler-1.1.3.tgz
```

Restart the Host when prompted. Open **Plugins → Installed plugins → dsh-prompt-assembler → Configure current session**. Reading plugin details does not open the editor. A blank session before its first message can also be configured.

The CLI accepts the same source. Stop the target Host and replace `web` with the intended profile name.

```sh
dsh plugin --profile web add https://github.com/Player-MINEPIG/dsh-prompt-assembler/releases/download/v1.1.3/dsh-prompt-assembler-1.1.3.tgz
```

The `.tgz` in [Release v1.1.3](https://github.com/Player-MINEPIG/dsh-prompt-assembler/releases/tag/v1.1.3) includes the built client. It requires no stock DSH core changes or npm publication. The GUI accepts repository URLs and direct `.tgz` or `.tar.gz` asset URLs. It does not accept a Release HTML page or source `.zip`. A repository source installs the package at that commit without selecting a Release asset. Source installation can use `github:Player-MINEPIG/dsh-prompt-assembler#v1.1.3`; use a full reviewed commit for development acceptance. New versions provide standard package `1.1.3` only.

Standalone use requires neither Tavern nor Memory Manager. Installation does not apply a strategy and creates no global default. Save rules updates the library. Save and apply to this session saves edits before application. Create a session with this strategy binds before opening the session.

### Share with Tavern 4.0.0 and other plugins

Install and enable Assembler in the target profile before installing Tavern 4.0.0 or another consumer. Tavern declares Assembler peer range `~1.1.3`. DSH's `autoInstallPeers:false` does not install a missing peer, and a peer declaration does not enable its bundle. Consumers reuse `dshPromptAssembler`, `dshPromptSources` or `dshPromptStrategies` instead of starting another instance. Check every consumer's compatible range before updating the shared runtime.

Removing Tavern withdraws its sources and UI while the independent Assembler and other consumers retain shared storage. Disabling or removing Assembler stops its services and consumers that require them. DSH restores dependencies when Assembler is enabled again. This does not promise uninterrupted in-flight tasks.

### Upgrade from an Assembler bundled with Tavern

Use the CLI for these steps so the old Host stays stopped while replacing packages.

1. Stop the old Host. Retain backups of its data directory and profile configuration.
2. Use the CLI command above to install and enable independent Assembler 1.1.3 in the same profile.
3. If the old Tavern config uses a custom `assemblerStorageDir`, set that path as the independent Assembler's `storageDir`, then remove `assemblerStorageDir` from Tavern; Tavern 4.0.0 rejects the retained field. The default remains `dshHomePath('dsh-prompt-assembler')`, so existing strategy files need no move or deletion.
4. If the old Tavern `security` config also governed its bundled Assembler, configure the required `security.allowedHosts` and `security.allowRemoteClients` on the independent Assembler. Tavern 4.0.0 no longer forwards those options.
5. Update Tavern to 4.0.0 and restart the Host. Check the strategy library, applied session selections and both plugin entries.

Do not let the old Host process requests while replacing packages. Retain strategies, resources and DSH durable history. Upgrading does not rewrite sessions. Set the existing custom path before opening a new empty default store.

## Historical advanced extension

The advanced extension is frozen at Assembler `1.1.0` and DSH `0.2.0-rc.2`, with no commitment to later DSH versions. The source `core-extension/` retains that frozen version only. It is not released with new standard packages and cannot be paired with standard `1.1.3`. Use the [v1.1.0 installation guide](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/docs/INSTALLATION_en.md) and matching source for installation, switching and rollback in old environments.

Before upgrading DSH, restore the old environment to stock using its matching switch tool, then follow the target DSH upgrade procedure and install the new standard plugin. Never copy old prepared builds into newer DSH. Strategies and history remain; legacy core strategies are not converted automatically. Explicitly select and apply a standard strategy. Missing advanced capabilities return 409 `REQUEST_ASSEMBLY_CORE_REQUIRED`.

## Storage and removal

Strategies/session snapshots live in `dshHomePath('dsh-prompt-assembler')/assembly-presets.json`. Explicit `migrateLegacy(root)` merges absent IDs and retains old files and play/native scopes. Unified session selection, including null, wins over legacy mode fallback. Missing backend remains core, without automatic conversion. Standalone use has no default. Attached Tavern uses standard preset-slots-first style for unbound play sessions and new openings; installing the addon does not change that default. Existing snapshots remain unchanged.

Provider removal withdraws its sources/catalog entries while retaining applied snapshots/storage. Standard user contributions remain native history; advanced request-only contributions stop, while request/assembly remains readable. For core restoration and selection switching in the frozen advanced environment, follow the [v1.1.0 guide](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/docs/INSTALLATION_en.md). Standard package `1.1.3` does not perform those steps. Migrations and real-profile writes require an authorized environment.

## Verification

```sh
npm ci
npm run check
DSH_ASSEMBLER_STOCK_ROOT=<stock-runtime> node --test test/native-backend.test.mjs
```

Historical advanced fixtures cover only the frozen 0.2.0-rc.2 contract. New DSH acceptance uses the stock target runtime.

Host fixtures use temporary sessions and offline synthetic providers, covering standard assembly, durable evidence, removal and optional Manager. Skipped fixtures do not establish acceptance. Browser/desktop checks separately cover the installed-plugin configuration entry, blank sessions, save/apply/preview, secure fetch, switching and removal. Real providers/user profiles require their own authorized acceptance. Directory submissions and tag/release/npm publication require explicit authorization.
