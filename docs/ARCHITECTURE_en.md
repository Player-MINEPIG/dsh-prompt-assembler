# Prompt Assembler architecture

[中文](ARCHITECTURE.md) · [Interactive diagram](assets/architecture/assembler.en.html) · [Developer guide](DEVELOPER_GUIDE_en.md)

The advanced path is retained only as the frozen Assembler 1.1.0 / DSH 0.2.0-rc.2 contract; new versions provide no core changes or commitment to future advanced adaptation.

The independently enabled src/plugin.js owns the single registry/store/runtime and provides dshPromptSources and dshPromptAssembler. Tavern 4.0.0 and other consumers reuse this instance through peers and service injection, without carrying or starting another Host runtime. `dshPromptAssembler.version` identifies the running package from its own manifest. Source and ordering protocols retain their separate version fields. The browser entry registers package-keyed configuration through plugins.bundle.config and mounts the guarded strategy editor through shell.overlay; HTTP remains a composable factory wrapped by bundle security. assembly-presets.json owns user presets and independently applied session snapshots, not source bodies or native history.

The browser `apply(ctx, { configurationPackage })` can attach configuration to a composition host’s package page; omission uses `dsh-prompt-assembler`. The entry and overlay share one session controller.

Standard flow: selected native strategy → read-only sources → official sections/context → accepted pre-step messages → native freezing, provider and durable history. Optional core flow: the same sources → validated complete-system projection → protocol-1 hook → log-only request/assembly. See [backend boundaries](BACKENDS_en.md). Only the addon registers the advanced request hook; no silent fallback.

adapters/dsh supplies public native inputs; adapters/tavern and adapters/memory-manager call optional source services. The package has no production dependency on their packages. Providers own identity, data, permissions, parsers and edits. Disposal removes future contributions and provider builtins while preserving applied snapshots and durable historical bodies; unavailable sources receive explicit diagnostics. Tavern compatibility aliases share this runtime, not an additional hook.

Source blocks/context, migration, request/snapshot lifetimes and preview contracts are in [INTEGRATION](INTEGRATION_en.md), [HTTP API](API_en.md) and [installation](INSTALLATION_en.md). Editable Archify JSON is stored next to the diagram.

Ordering executes `layout.priority` through a request snapshot of `PositionStrategyRegistry`; built-in and third-party algorithms share registration. Manual positions and native anchors are excluded from automatic claims. `AssemblyPresetStore.registerPresets` owns provider catalog lifecycle while applied snapshots remain independent. Source descriptor `ownsSlots` replaces fixed source IDs for slot ownership. See [third-party extensions](DEVELOPER_GUIDE_en.md#register-ordering-strategies-and-preset-catalogs).
