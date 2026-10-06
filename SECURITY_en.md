# Security boundaries

[中文](SECURITY.md) · [Integration contract](docs/INTEGRATION_en.md)

The Host plugin runs within DSH's trusted plugin boundary. Its API must use Host authentication, origin checks and applicable desktop-token checks; the browser entry uses the corresponding secure fetch. The library's `createAssemblyApi` only handles JSON and strategy primitives. Callers embedding it provide their own secure routing boundary. Source IDs are provider-declared, not signatures or permission isolation; installing a third-party adapter trusts its executable code.

Sources own content and read permissions. Registry contexts are detached, deeply frozen read objects; the cancellation signal remains the original object. Adapters respect read-version leases, removal and cancellation, and do not write source state during assembly or preview. Preview makes no model request and excludes pending input; it reads current resources and durable history. Public read objects do not automatically expose source internals or grant editing rights.

The selected source parser owns custom-text syntax. Third-party text does not implicitly execute ST, EJS or JavaScript. Optional Tavern parsing uses restricted read-only EJS with source-controlled helper permissions. Missing runtimes, invalid output, changed leases and parser failures reject the whole assembly, without sending partial results. Provide sensitive content only to trusted sources and trusted models.

Strategy storage, authored text and complete `request/assembly` snapshots can contain sensitive content. Protect them using the selected DSH profile's access controls and backup policy; preview and historical reads share that boundary. Plugin removal preserves these files and durable history. Removal is not data erasure. Migration also retains the original legacy file.

The protocol preparation tool produces separate core output; plugin installation does not modify DSH core. Prepared core records the actual request surface without proving provider delivery. Core replacement, migration and real-profile writes require authorization for the intended runtime.

Prefer an enabled private reporting channel for security issues; if none is available, contact the repository owner directly. Do not include credentials, session records, resource content or complete snapshots in public issues.
