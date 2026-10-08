# Advanced model history filtering

[中文](HISTORY_POLICY.md)

Advanced mode uses the existing protocol-1 request assembly seam to filter message copies before dispatch.
The final messages and policy evidence are recorded in `request/assembly`. Original Session events, model
streams and displayed transcripts stay unchanged. No persistent message projection interpreter is installed.
Standard mode is unchanged and does not enable this feature.

## Behavior

Policies are disabled for new session IDs. Enabling the default clean policy keeps human input and assistant
text, while excluding obsolete `dsh-prompt-assembler`, `ptc-mode`, tool-origin user injections and old
`runtime-context` snapshots. Classification uses exact `source.kind`, never text or role alone. Legacy
injections incorrectly labeled `user` cannot be distinguished safely and remain. Unknown sources are retained
with `UNKNOWN_SOURCE_RETAINED`; users can explicitly add exact source selectors.

Protected content includes:

- Current-step messages and new assembly contributions, including current preset/worldbook/PHI.
- The latest effective runtime-context snapshot, which DSH reuses when unchanged. Age does not make it obsolete.
- System/developer messages, complete assistant tool-call messages, tool results and messages containing unknown `source.replayState` formats.
- Reasoning without a verified omission contract. Source exclusion cannot remove a whole message containing required reasoning.

Source controls affect old copies. Existing assembly controls still own current runtime-context contributions.
Protection of tool transactions cannot be overridden by source controls. Remaining message IDs, roles and
order are preserved; history is never flattened into one user checkpoint.

## Rules, previews and lifecycle

`contentTypes` controls text, image and reasoning. Defaults retain text/images and omit reasoning only when
explicitly certified safe for the target adapter. Without a trusted `reasoningSafety` callback, reasoning
remains with a warning. The callback must return `{canOmit:true,contract:'specific-contract-id'}`; this is
trusted Host configuration, never client JSON. Requests carrying tools or histories containing tool
transactions retain reasoning regardless of that callback. DeepSeek's [official thinking contract](https://api-docs.deepseek.com/guides/thinking_mode/)
requires historical reasoning with tools. This implementation does not guess protocols from provider names
or promise reasoning removal for every model.

Assistant text rules use exact delimiters, without regex or script execution:

```json
{"id":"example-block","sourceKind":"model","start":"<PrivateBlock>","end":"</PrivateBlock>","mode":"lines","enabled":true}
```

`lines` matches complete standalone lines starting at column zero and skips code fences. `literal` explicitly
allows inline matches. Nested, orphaned and unclosed markers are retained with diagnostics. Fragment rules
are empty by default. Ranges use original UTF-16 offsets `[start,end)`; overlapping ranges are merged and
surrounding prose is preserved. Preview shows original/effective content, matched spans and retention reasons.
Tavern supplies an opt-in MVU wrapper preset; the generic engine has no MVU-specific parsing.

For the verified stock rc.2 DeepSeek Messages v1 replay format, text fragments may change while every
block/index, reasoning byte and signature remains. Even fully removed text keeps its empty text block.
Whole-message and block removal are prohibited. Unknown fields/versions retain the entire message.
`test/history-replay.test.mjs` executes the shipped adapter replay validator and assistant serializer,
confirming changed text is used without signature degradation. No remote API is contacted.

- Saves apply from the next advanced **step**, re-evaluating the current native effective history without changing recorded requests.
- Retries within a step retain the captured policy revision. Concurrent saves take effect on the next step.
- Active filtering starts a new request series because earlier prefixes may change without native surface mutations.
- Disabling/unloading restores native effective history on the next step; native compaction cannot be undone by this policy.
- Restart reloads settings for the same session ID. A fork has a new ID and defaults to disabled; callers may explicitly copy a policy.
- Compaction summaries use their current source. Unknown summaries remain; shadowed originals are not resurrected or inferred from summary text.

## Independent integration

Existing wildcard package exports expose the new entry points:

```js
import {
  HistoryPolicyStore, registerHistoryPolicy, createHistoryPolicyService,
  createHistoryPolicyHandler, HISTORY_API_ROOT,
} from 'dsh-prompt-assembler/history-policy'
import { mountHistoryPolicyPanel } from 'dsh-prompt-assembler/history-client'

const store = new HistoryPolicyStore(storageDir)
const stop = registerHistoryPolicy(ctx, {
  store, runtime,
  readEvents: async session => (await ctx.get('sessionController').inspect(session.id)).events,
  // Optional reasoningSafety: retain reasoning when adapter facts are unverified.
})
ctx.effect(() => stop)
```

Inject `agentLoop`, `dshPromptAssembler`, `sessionController`, and `sessions` for previews. `runtime` is the
existing assembler runtime. Registration requires the prepared protocol-1 core and runs only with a selected
core assembly strategy. A prepend middleware filters after existing assembly; it does not replace the backend,
layout or registry. Do not mount it on the standard path. Call its disposer on removal.

`createHistoryPolicyService({store,readContext,reasoningSafety})` expects `readContext(sessionId)` to return
`{messages,events,tools?,config?,currentStepSeq?}`. Messages must come from the current native effective surface,
not the last filtered request. Cold reads can reuse inspect + sessions.prepare without creating an Agent.
Preview excludes unsent drafts and new contributions not assembled yet. Supply currentStepSeq to protect an
active step. Preview and runtime must use the same verified reasoning contract and effective target tools.

`createHistoryPolicyHandler({service})` is a raw route handler to mount **inside the existing assembler
security wrapper**, sharing the request token and desktop authentication transport. Standalone servers can
use `createHistoryPolicyApi({service,security})`, which includes loopback, Host, Origin, JSON and token checks.
Never expose the raw handler without that protection.

| Method and path relative to HISTORY_API_ROOT | Purpose |
| --- | --- |
| GET `?sessionId=…` | Read `{revision,policy}` |
| PUT `?sessionId=…` | Save `{policy,expectedRevision}`; stale revisions return 409 |
| POST `/preview?sessionId=…` | Preview `{policy?}` without saving or model dispatch |

The root is `/dsh-prompt-assembler/api/v1/history-policy`; request bodies are capped at 256 KiB. Settings are
session-specific, never global. One Host owns `history-policies.json`, saved through temporary-file rename;
concurrent writes from multiple processes are unsupported.

`mountHistoryPolicyPanel(container,{sessionId,request?,fragmentPresets?})` returns `{ready,dispose}`.
Inject the existing authenticated transport for desktop. Mount for core sessions and dispose on switching or
unload. Hide it in standard mode. This change supplies an independent component, leaving root wiring and the
other implementation branch's client files to the integrator.

## Audit and compatibility

`request/assembly.data.messages` is the final dispatched result. `metadata.historyPolicy` includes the policy
snapshot/revision, input/output hashes, original IDs/sequences, block edits, match ranges, reasons and diagnostics.
Existing `metadata.assembly` describes the layout **before filtering**. Consumers must use final messages for
sent text/counts, and historyPolicy for differences; layout node text/counts are not the filtered request.

No assistant event or provider stream is fabricated. Stock rc.2 can replay and continue sessions containing
these existing ignorable request/assembly records. `test/history-native-capabilities.test.mjs` still reproduces
the native assistant replacement and projection-unload limits; this feature does not depend on those interfaces.

## Verification

```sh
DSH_ASSEMBLER_CORE_ROOT=/path/to/prepared-runtime \
DSH_ASSEMBLER_STOCK_ROOT=/path/to/stock-runtime \
node --test test/history-*.test.mjs
```

Pure tests cover sources, identical input, current context, fragments, false matches and configuration conflicts.
HTTP/DOM tests exercise preview/save/reload and security rejection. Real Host modules with a synthetic offline
adapter cover multiple turns/steps, retry revision pinning, tool transactions, disk serialization followed by
fresh Host creation, forks, native replacement compaction boundaries and continuation on unmodified stock Host.
Compaction uses a synthetic summary through real surface replacement, not a paid summarizer. Restart uses a
temporary JSON seed rather than production session-storage acceptance. No paid provider or token-saving
measurement is claimed.
