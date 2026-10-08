# Model history filtering: standard and advanced

[中文](HISTORY_POLICY.md)

Advanced mode uses the existing protocol-1 request assembly seam to filter message copies before dispatch.
The final messages and policy evidence are recorded in `request/assembly`. Original Session events, model
streams and displayed transcripts stay unchanged. No persistent message projection interpreter is installed.
Standard mode uses the stock public pre-step and surface-replacement APIs to clean old plugin injections; it needs no protocol-1 core.

## Installed entry points and usage

Open prompt assembly settings and expand “Model history filtering” in the current-session application area. Select retained sources, inspect matching previews, then save history rules. These rules belong to the session and are saved independently from assembly strategies. Switching a strategy preserves history settings. New sessions start disabled.

The assembler plugin mounts standard cleanup using one shared `HistoryPolicyStore`; the optional core plugin mounts advanced request filtering. The actually applied backend determines API capabilities and editor controls. Editing a strategy does not change those capabilities early. When switching to advanced mode, the standard hook first restores still-live owned placeholders before filtering the request copy.

History and assembly APIs share the existing security router and browser/desktop transport. Cold-session previews use public inspect and sessions.prepare without creating an Agent. Tavern supplies the MVU example and embedding, without copying the generic engine or settings store. The `./history-policy` package export provides the Tavern example and mounting function.

Actual requests use the recorded final messages. Advanced result cards reconcile history text using `metadata.historyPolicy`, while original layout and event audit remain intact. Standard provenance uses built-in replacement events and `data.historyPolicy/sourceEventSeqs`. Layout assembly precedes history filtering.

## Standard: source cleanup

`registerStandardHistoryPolicy` automatically cleans consumed plugin `user/message` events, using exact
`source.kind` and native event positions. Identical human text stays intact. New session IDs default to disabled;
source rules share the advanced policy store. Standard mode always preserves human inputs, whole assistants
(including reasoning and MVU), tool transactions, system instructions and replay data. Only append-origin users
and this feature's own restored copies are eligible; other replacements and compaction summaries remain opaque.
Unknown sources stay with a warning; an exact selector explicitly opts that producer into the source policy.

At pre-step entry, capture the previous `step/end` sequence. Unsent tail appends, downstream pre-step injections
and this decision's messages remain. The latest reused runtime-context stays; when a new snapshot is pending,
its predecessor can be cleaned. Each target is replaced in position by an empty **developer/message**, which
derives to no model message. Empty system placeholders are unsuitable: if an injection precedes the first
system message, native system-prompt projection can take over that placeholder and break restoration.

- Saving applies at the next accepted pre-step. Capture rules before downstream hooks; saves during those hooks
  take effect next step. Stock retries reuse the committed surface and do not append duplicate cleanup events.
- Keeping a source or disabling restores still-live owned placeholders at their original positions on the next
  step, with original message IDs/content. Restoration cites placeholder and original sequences; re-exclusion
  still uses the original age. Unchanged hidden entries do not generate new replacement events each turn.
- Restart reuses persisted configuration and built-in events. A fork has a new disabled session ID and restores
  inherited placeholders on first run, unless the caller explicitly copies the parent policy first.
  Placeholders shadowed by compaction or another replacement are never revived.
- Unloading stops automation and **leaves committed cleanup in place**. Stock sessions remain readable and can
  continue with no plugin interpreter. To restore first, disable and run one step, or let an authorized caller
  invoke `applyStandardHistory` with `enabled:false` while idle. That primitive sends no model request.
- Empty developer placeholders do not participate in system-prompt routing. Only actual replacements start a
  new request series. System prompt updates continue through the native projection.

For two rounds of `preset, preset, human, preset, assistant`, request three keeps
`human, complete assistant, human, complete assistant`, followed by all required current presets and input.
The original append log remains intact and can reconstruct the native transcript.

Use the public LLM factory already loaded by the Host:

```js
const stopStandard = registerStandardHistoryPolicy(ctx, {
  store,
  readEvents: async session => (await ctx.get('sessionController').inspect(session.id)).events,
  createDeveloperMessage: hostLlm.createDeveloperMessage,
  active: agent => !runtime.requestAssemblyAvailable(agent.id), // use actual backend selection
})
```

`active` means this step uses standard mode. False restores owned placeholders at the next accepted pre-step,
so switching to advanced can filter complete effective history again. Keep this lifecycle hook alongside the
advanced hook; do not simply unmount it on backend switch. Mount it outside injection middleware so `next()`
finishes before planning. `applyStandardHistory(session, context, {createDeveloperMessage})` and
`planStandardHistory(context)` are composable primitives. The mutating primitive requires caller-owned write
access and serialized surface mutation. Context contains complete `events`, `policy`, optional
`revision/cutoffSeq/pendingMessages/turn/step`; pure planning also requires `nodes/messages`.
Production reads use public controller inspect; fixtures use complete in-memory Sessions.

Create the standard service with `mode:'standard'`, advanced with `mode:'advanced'` (default). Dispatch routes
according to the actual session backend, never a client assertion. Standard previews require native
`nodes:[...session.surface.nodes]`, effective `messages` and complete `events`. They include hidden originals
and `restore` actions, but omit not-yet-generated next-step injections, so retain the latest context for now.
GET/PUT/preview return `capabilities`. Standard UI enables source controls, locks human/model retention, and
explicitly disables content/fragment controls. Existing advanced rules stay stored but are inactive in standard.
Changing those fields through the standard API returns `HISTORY_ADVANCED_REQUIRED` rather than pretending to apply them.

Each hide event's `data.historyPolicy` carries owner/version, target/original seq, the effective original message,
rule snapshot/revision and hashes. Native `sourceEventSeqs` links the provenance. Restore events write the exact
user message and reference both hidden and original events. These are inert JSON annotations on built-in events,
not interpreter-dependent event types. Actual standard requests derive from the surface at request time.

## Advanced behavior

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
  HistoryPolicyStore, registerHistoryPolicy, registerStandardHistoryPolicy, createHistoryPolicyService,
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
`{messages,events,nodes?,tools?,config?,currentStepSeq?}`. Messages must come from the current native effective surface,
not the last filtered request. Cold reads can reuse inspect + sessions.prepare without creating an Agent.
Preview excludes unsent drafts and new contributions not assembled yet. Supply currentStepSeq to protect an
active step. Preview and runtime must use the same verified reasoning contract and effective target tools.

`createHistoryPolicyHandler({service})` is a raw route handler to mount **inside the existing assembler
security wrapper**, sharing the request token and desktop authentication transport. Standalone servers can
use `createHistoryPolicyApi({service,security})`, which includes loopback, Host, Origin, JSON and token checks.
Never expose the raw handler without that protection.

| Method and path relative to HISTORY_API_ROOT | Purpose |
| --- | --- |
| GET `?sessionId=…` | Read `{revision,policy,capabilities}` |
| PUT `?sessionId=…` | Save `{policy,expectedRevision}`; stale revisions return 409 |
| POST `/preview?sessionId=…` | Preview `{policy?}` without saving or model dispatch |

The root is `/dsh-prompt-assembler/api/v1/history-policy`; request bodies are capped at 256 KiB. Settings are
session-specific, never global. One Host owns `history-policies.json`, saved through temporary-file rename;
concurrent writes from multiple processes are unsupported.

`mountHistoryPolicyPanel(container,{sessionId,request?,fragmentPresets?})` returns `{ready,dispose}`.
Inject the existing authenticated transport for desktop. Both modes mount this panel; capabilities come from the server. Dispose and remount on session/backend switch or unload. Supply nodes to advanced previews to simulate standard-placeholder restoration on switching. The installed plugin mounts this component; independent callers can also reuse it.

## Audit and compatibility

`request/assembly.data.messages` is the final dispatched result. `metadata.historyPolicy` includes the policy
snapshot/revision, input/output hashes, original IDs/sequences, block edits, match ranges, reasons and diagnostics.
Existing `metadata.assembly` describes the layout **before filtering**. Consumers must use final messages for
sent text/counts, and historyPolicy for differences; layout node text/counts are not the filtered request.

No assistant event or provider stream is fabricated. Stock rc.2 can replay and continue sessions containing
these existing ignorable request/assembly records. `test/history-native-capabilities.test.mjs` still reproduces
the native assistant replacement and projection-unload limits; advanced filtering avoids those restricted interfaces. Standard mode uses the verified single-node user → empty developer → user path.

## Verification

```sh
DSH_ASSEMBLER_CORE_ROOT=/path/to/prepared-runtime \
DSH_ASSEMBLER_STOCK_ROOT=/path/to/stock-runtime \
node --test test/history-*.test.mjs
```

`history-standard.test.mjs` verifies the three-round preset scenario, restoration and deduplication on an unmodified stock Host. Pure tests cover sources, identical input, current context, fragments, false matches and configuration conflicts.
HTTP/DOM tests exercise preview/save/reload and security rejection. Real Host modules with a synthetic offline
adapter cover multiple turns/steps, retry revision pinning, tool transactions, disk serialization followed by
fresh Host creation, forks, native replacement compaction boundaries and continuation on unmodified stock Host.
Compaction uses a synthetic summary through real surface replacement, not a paid summarizer. Restart uses a
temporary JSON seed rather than production session-storage acceptance. No paid provider or token-saving
measurement is claimed.
