# Assembler HTTP API

[English](API_en.md) · [开发者指南](DEVELOPER_GUIDE.md)

前缀 `/dsh-prompt-assembler/api/v1/assembly-presets`，下列路径相对此前缀。成功为 `{ok:true,...}`，失败为 `{ok:false,error,code?}`；ID 须 URL 编码，mutation JSON 上限 2 MiB。库 createAssemblyApi 不提供认证；bundle secureAssemblerApi 检查 loopback TCP peer、Host、同 Origin 或 desktop token、JSON 媒体类型。这些防护不认证恶意本机进程；外层 DSH transport 拥有其认证。

| Method | Path | Input / result |
| --- | --- | --- |
| GET | /?sessionId=… | presets/defaultPresetId/selection/capability/capabilities/sourceProtocolVersion/sources |
| POST | / | 策略 JSON 或 {preset} → 201 {preset} |
| GET | /:id | {preset} |
| PUT | /:id | 策略 JSON → {preset} |
| DELETE | /:id | {ok:true} |
| PUT | /selection | {sessionId,id:string|null} → {selection} |
| POST | /preview | {sessionId,preset} 或 {sessionId,presetId} → {preview} |
| GET | /actual?sessionId=… | {request: durable request/assembly | null} |

保存只改库；应用复制独立快照，id:null 关闭。生成中的 Agent 拒绝切换（409），内置策略不可覆盖/删除，已应用策略拒绝删除。preview 读取当前持久会话与来源，不含未发送输入、不激活 Agent、不准备模型。actual 读取记录，不重算 parser/macros。缺策略 ID 遵循 store 的错误状态，不能假定所有缺失 ID 都是 HTTP 404。

独立 token 路由为 GET /dsh-prompt-assembler/api/v1/request-token，带 X-Assembler-Client: embedded，返回 {ok:true,token}。desktop 无 Origin 的 mutation 携带 X-Assembler-Request-Token。使用 client-fetch 模块的 createAssemblerFetch，不持久化 token、不绕开宿主 transport。安全拒绝 403、mutation 媒体类型错误 415、正文超限 413、JSON/schema 错误 400；会话缺失可返回 404，生成中/capability/preview 租约冲突按合同返回 409。REQUEST_ASSEMBLY_CORE_REQUIRED 表示进阶缺 addon 或协议 1，不是来源故障。应用、preview、观察都不证明网络送达。

Tavern 旧前缀 /pmp-dsh-tavern/api/v1/assembly-presets 经其自身安全边界转发同一 store/runtime，不创建第二套策略系统。Host 服务、来源/block 类型、store 与界面嵌入合同见 [INTEGRATION](INTEGRATION.md) 和 [类型](../src/index.d.ts)。

策略可带 backend:native|core，缺省为旧 core。标准 user 规则可带 delivery:context|pre-step。不支持的原生布局返回 409 ASSEMBLY_NATIVE_UNSUPPORTED。GET actual 返回 backend 与 recordKind:request/assembly；当前标准模式返回 request:null，不伪造冻结请求证据。见[后端规则](BACKENDS.md)。
