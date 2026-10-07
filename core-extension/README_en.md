# Optional core assembly extension

[中文](README.md) · [Standard package](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/main/README_en.md) · [Installation and core preparation](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/main/docs/INSTALLATION_en.md)

`dsh-prompt-assembler-core` explicitly registers the validated advanced executor with the standard assembler. It owns mounting/removing the single protocol-1 hook and separate core-preparation tooling. Strategies, registry, primitives and UI remain shared in `dsh-prompt-assembler`. Neither Tavern nor the standard package depends on this addon.

Requires exact standard version 0.2.0 and explicitly prepared DSH 0.2.0-rc.2 (`requestAssemblyVersion:1`). Stock core refuses mounting. A protocol marker alone does not enable the addon. Core strategies use advanced projection; native strategies continue through public interfaces. Both backends never replace the same request.

Run `npm pack ./core-extension` from the repository root and enable the resulting package separately. `core-extension/scripts/prepare-request-assembly.mjs` only generates separate output; it does not install or back up a runtime. Follow the installation contract. Removing the addon revokes the backend while retaining strategies/logs. Retained core selections fail explicitly until disabled or switched to native.
