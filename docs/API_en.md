# Assembler HTTP API

[中文](API.md) · [Developer guide](DEVELOPER_GUIDE_en.md)

See [resource layout](RESOURCE_LAYOUT_en.md) for provider position declarations, reusable switches/order, conflict decisions and legacy compatibility.
The prefix is `/dsh-prompt-assembler/api/v1/assembly-presets`; paths below are relative to it. Success uses `{ok:true,...}`, failure `{ok:false,error,code?}`. URL-encode IDs. Mutation JSON body limit is 2 MiB. Library createAssemblyApi has no authentication; the bundled secureAssemblerApi checks loopback TCP peer, Host, same Origin or desktop token and JSON media type. These fences do not authenticate malicious local processes. The enclosing DSH transport owns its authentication.

| Method | Path | Input / result |
| --- | --- | --- |
| GET | /?sessionId=… | presets/defaultPresetId/selection/capability/capabilities/sourceProtocolVersion/sources |
| POST | / | Preset JSON or {preset} → 201 {preset} |
| GET | /:id | {preset} |
| PUT | /:id | Preset JSON → {preset} |
| DELETE | /:id | {ok:true} |
| PUT | /selection | {sessionId,id:string|null} → {selection} |
| POST | /preview | {sessionId,preset} or {sessionId,presetId} → {preview} |
| GET | /actual?sessionId=… | {request: durable request/assembly | null} |

Saving affects only the library. Applying copies an independent snapshot; `id:null` disables. Running Agents reject apply (409). Builtins cannot be overwritten or removed; selected preset deletion is refused. Preview uses persisted current session and current source reads without unsent input, Agent activation or model preparation. Actual reads recorded data without reevaluating parsers/macros. Unknown preset IDs use the store's error status; do not assume every missing ID has HTTP 404.

The separate token route is `GET /dsh-prompt-assembler/api/v1/request-token` with `X-Assembler-Client: embedded`; it returns `{ok:true,token}`. Desktop mutations without Origin send `X-Assembler-Request-Token`. Use the bundled createAssemblerFetch from the client-fetch module; never persist tokens or bypass the host transport. Security failures are 403, wrong mutation content type 415, oversized JSON 413, invalid JSON/schema 400. Missing actual session may return 404; running/capability/preview lease conflicts use 409 where specified. `REQUEST_ASSEMBLY_CORE_REQUIRED` means the optional addon or prepared protocol-1 core is missing, not a failed source. Application, preview and observations never prove network delivery.

Tavern's compatibility prefix `/pmp-dsh-tavern/api/v1/assembly-presets` forwards the same store/runtime through Tavern's security boundary. It does not create a second strategy system. Host service, source/block types, store and panel embedding contracts are in [INTEGRATION](INTEGRATION_en.md) and [types](../src/index.d.ts).

Strategies optionally carry `backend:native|core`; absent means legacy core. Native user rules optionally specify `delivery:context|pre-step`. Unsupported native layouts return 409 ASSEMBLY_NATIVE_UNSUPPORTED. GET actual returns `backend` and `recordKind:request/assembly`; native mode returns request:null rather than reconstructed frozen-request evidence. See [backend rules](BACKENDS_en.md).
