# Model history policy and native capability boundary

[中文](HISTORY_POLICY.md)

The target is DSH `0.2.0-rc.2`. **There is no complete history filtering feature or settings panel to enable.**
Public APIs can replace some history, but cannot jointly provide partial assistant editing,
original per-message roles and order, unchanged audit evidence, and native continuation after uninstall.
Flattening the conversation into a user checkpoint or rewriting provider streams does not satisfy this contract.

## Reproducible capability boundary

`test/history-native-capabilities.test.mjs` runs real Cordis services, Session, Agent Loop and a
synthetic offline model adapter. It does not use a fake Session or contact a model service.

```sh
DSH_ASSEMBLER_STOCK_ROOT=/path/to/stock-runtime node --test test/history-native-capabilities.test.mjs
```

The directory must contain `package.json` and resolvable stock rc.2 dependencies. Without the variable,
the tests explicitly skip.

| Path | Native behavior | Consequence |
| --- | --- | --- |
| Replace one old injection with an empty `system/message` | No longer sent; original event retained; remaining roles and order preserved | Demonstrates injection hiding, not a complete policy |
| Replace that empty node with a `user/message` | Original injection and empty node may be cited to restore the injection | Demonstrates restoration for this user node only |
| Assistant replacement without source references | Rejects: `sourceEventSeqs must include every shadowed surface node` | Cannot edit assistant body or reasoning |
| Same replacement with source references | Rejects: `assistant/message embeds its source stream and cannot carry sourceEventSeqs` | References do not resolve the conflict |
| Edit assistant through `registerMessageProjection` | Content changes with message ID retained while loaded | Removing a used interpreter blocks cached reads and future append |
| Project to `content: []` | Empty user message remains | Empty content is not deletion; public return type is `Map<SessionSeq, Message>` |
| Native `image/offload` | Rejects assistant targets; only specified user/tool images supported | Cannot serve as a general text interpreter |

The minimal conflict is the following pair of calls against an existing assistant event.
Both reject without changing the log or effective history:

```js
const surfaceOp = { op: 'replace', startSeq: assistant.seq, endSeq: assistant.seq }
session.append('assistant/message', editedData, { surfaceOp })
session.append('assistant/message', editedData, { surfaceOp, sourceEventSeqs: [assistant.seq] })
```

The runnable tests obtain the original assistant event and stream from an actual offline model turn.
`editedData` exists only in rejected negative cases, never in a production log. Copying the old stream
beside changed text cannot truthfully represent the original model output.

## Missing public primitive

A durable edit decision understood by native Session, replayable without the plugin, must support at least:

- Hiding original message coordinates and editing assistant blocks or text spans while preserving remaining roles, order and identities.
- Associating decisions with original events, rule versions and exact match ranges; leaving original model streams unchanged.
- Defined native replay, fork, compaction and uninstall behavior without a removed interpreter dependency.
- Traceable revision and undo semantics, plus atomic policy application or a transaction boundary that prevents sending partially updated history.

An in-memory `messages[]` override alone does not provide audit reconstruction. Another plugin-owned
projection type alone does not solve uninstall. A native capability or another verified public interface
meeting the same contract is required before runtime policy registration. This repository neither patches
DSH core nor exposes a placeholder apply API.

## Integration constraints

These are requirements for future implementation, not shipped features:

- Classify by `source.kind` and producer metadata. User role does not imply human authorship. Preserve unknown sources with a warning, never guess from text.
- Producers still assemble current preset/worldbook/PHI content. Exclude only obsolete copies; new steps and retries must retain injections required for their current request.
- Rules need source, content type and explicit span boundaries. Preview original text, removed ranges and retained output. Defaults must not remove ordinary RP prose.
- Saving and applying rules are separate operations. Retroactive application and disabling behavior must agree between UI and durable decisions. Do not promise full restoration without native undo support.
- Protect tool transactions, paired results and reasoning/replay data required by the actual adapter.
- A compacted summary is not original per-message history. Do not guess its sources or replace already shadowed coordinates.

The official DeepSeek [Thinking Mode contract](https://api-docs.deepseek.com/guides/thinking_mode/)
distinguishes requests carrying `tools`: these must return historical `reasoning_content`, including turns
without an actual tool call. Without `tools`, the documented behavior excludes prior reasoning from context.
A completed turn alone therefore does not establish safe reasoning removal. This does not prove token
behavior for every DSH provider/protocol; the actual adapter request still needs verification.

## Verification scope

Tests cover identical human/plugin text with distinct sources, hiding obsolete injections while retaining
current injections, original roles/order and audit, user-injection restoration, native fork, JSON Session
replay, rejected assistant replacements, projection unload failure, empty-content semantics and image-offload limits.

JSON Session replay is not disk Host restart acceptance. A synthetic adapter is not DeepSeek wire/API
acceptance. No product UI, persisted settings API or runtime policy is provided, so browser saving, tool
transactions, automatic retry, policy reapplication after native compaction and disk Host restart remain
unverified. Integration must not count passing capability tests as product acceptance.
