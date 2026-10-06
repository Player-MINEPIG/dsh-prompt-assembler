# Installation and operation

[中文](INSTALLATION.md) · [README](../README_en.md) · [Integration contract](INTEGRATION_en.md)

## Compatibility target

The exact Host target is DSH `0.2.0-rc.2`, running Node `^22.19.0 || >=24`. The assembly library runs independently on Node >=20. Other DSH versions require their own service, client-slot and protocol verification.

## Install the plugin

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-prompt-assembler#main
```

The private `Player-MINEPIG/dsh-prompt-assembler` repository requires authorized GitHub access. It is not yet eligible as a publicly accessible plugin-directory entry; no npm package is published in this work. GitHub installation uses package metadata: `main: src/plugin.js`, `dsh.bundle: cordis.patch.yml`, and `dsh.client` pointing at prebuilt `dist/client.js`. The client bundle is committed, with no source build at installation.

Restart the Host for the selected profile and open its browser UI. The sidebar offers current-session assembly and the strategy library, including blank sessions. Saving a strategy and applying it to a session are separate operations. Creating a session using a strategy binds it before opening it; there is no global default. Tavern is optional: native DSH and third-party registry sources work independently.

## Explicitly prepare the request hook

Stock rc.2 core lacks the protocol 1 `agent/assemble-request` seam. The plugin checks `agentLoop.requestAssemblyVersion === 1` and never modifies core during installation. Without prepared core, edit/import/export and read-only preview work. Applying a non-null strategy returns HTTP 409 with `REQUEST_ASSEMBLY_CORE_REQUIRED`.

Install development dependencies in the plugin source checkout, then generate separate output from exact rc.2 source:

```sh
npm ci
node scripts/prepare-request-assembly.mjs <DSH-0.2.0-rc.2-source> <separate-output>
```

Replace the angle-bracket placeholders. The tool verifies the `dsh-session` and `dsh-agent-loop` versions and pinned source digests. It rejects different source and overlapping input/output directories. It writes separate output and `receipt.json`, without modifying the source checkout or installed DSH. Review the output, stop the intended Host, back up its profile and original core, then replace the corresponding builds through that environment's existing core installation procedure and restart. This tool is not an installer. Runtime replacement must be authorized for the intended environment.

Prepared core invokes assembly before freezing the request and records a log-only `request/assembly` snapshot. This stores the actual request surface without rewriting native message history or proving provider delivery.

## Storage, migration and removal

Strategies and session selections belong to the assembler's own Host store at `dshHomePath('dsh-prompt-assembler')`, in `assembly-presets.json`. Explicitly migrate a legacy Tavern `assembly-presets.json` using `dshPromptAssembler.migrateLegacy(root)`, where `root` identifies the old store directory. Migration preserves the original file and old `play:` / `native:` mode scopes. Current owned entries win; migration merges only absent IDs. Standalone selection checks the raw session ID, then explicit `native:<id>` and `play:<id>` entries, including explicit null. New sessions without a legacy selection receive no implicit default. Reapplying binds the raw Session ID ahead of legacy mode choices, including after Tavern is reinstalled. It does not copy source resources into strategies or convert DSH history. Run migration only in an authorized runtime.

Current request records use owner `dsh-prompt-assembler`; historical reads still accept prior `pmp-dsh-tavern` snapshots. The preset catalog contains only currently registered built-ins and user-saved presets. Removing a provider withdraws its built-ins from that catalog; an applied session snapshot remains with an unavailable-provider notice and cannot be reapplied as a built-in to another session. Removing the plugin preserves strategy storage and DSH durable history, and native DSH can continue using original sessions. Prepared core is a separate change: restore the retained original core build if returning to stock rc.2, and verify the preserved durable history.

## Verification

```sh
npm ci
npm run check
```

Standard CI runs these commands. Host tests skip without an external prepared core. Run real Host checks separately and explicitly:

```sh
DSH_ASSEMBLER_CORE_ROOT=<prepared-runtime> node --test test/host.test.mjs test/plugin-host.test.mjs
DSH_ASSEMBLER_CORE_ROOT=<prepared-runtime> DSH_ASSEMBLER_MANAGER_ROOT=<manager-checkout> node --test test/host.test.mjs test/plugin-host.test.mjs
```

`test/plugin-host.test.mjs` exercises the installable plugin on the actual prepared Host; `test/host.test.mjs` covers library composition and optional Manager integration. These fixtures use temporary sessions and an offline synthetic provider. They cover assembly, durable records, source removal and optional Manager integration; they do not establish real-provider, user-data or browser acceptance. Browser and desktop checks should cover sidebar entry, sessions before their first message, strategy binding before new-session opening, save/apply/preview, secure fetch, switching and removal. Record a specific gap when the necessary runtime is unavailable.

## Public directory requirements

Before a later `awesome-dsh-plugin` submission, provide complete `dsh.bundle`, callable plugin behavior, accurate installation instructions, a repository at least one day old, and readable source when public. The current private repository cannot serve as a publicly accessible entry. Submit a directory entry only after separate authorization; it is outside this plugin preparation.
