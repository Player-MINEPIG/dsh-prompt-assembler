# Optional core assembly extension

[中文](README.md) · [Standard package](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/README_en.md) · [Installation and core preparation](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/docs/INSTALLATION_en.md)

`dsh-prompt-assembler-core` explicitly registers the validated advanced executor with the standard assembler. It owns mounting/removing the single protocol-1 hook and separate core-preparation tooling. Strategies, registry, primitives and UI remain shared in `dsh-prompt-assembler`. Neither Tavern nor the standard package depends on this addon.

Requires exact standard version 1.1.0 and explicitly prepared DSH 0.2.0-rc.2 (`requestAssemblyVersion:1`). Stock core refuses mounting. A protocol marker alone does not enable the addon. Core strategies use advanced projection; native strategies continue through public interfaces. Both backends never replace the same request.

Use `node core-extension/scripts/switch-runtime.mjs install|uninstall --runtime <runtime> --home <DSH_HOME> --profile web` for installation/removal. Initial installation also needs `--prepared <prepared-output> --stock-runtime <stock-runtime>`. The command packs/enables the addon; removal restores stock builds and moves advanced selections to standard preset-slots-first. Stop the target Host first and restart afterwards; see the linked installation guide. Strategies and logs remain across repeated switches.
