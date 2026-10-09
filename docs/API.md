# Assembler HTTP API

[English](API_en.md) · [开发者指南](DEVELOPER_GUIDE.md)

资源位置声明、可复用开关/排列、冲突结果与兼容策略见[资源布局](RESOURCE_LAYOUT.md)。
前缀 `/dsh-prompt-assembler/api/v1/assembly-presets`，下列路径相对此前缀。成功为 `{ok:true,...}`，失败为 `{ok:false,error,code?}`；ID 须 URL 编码，mutation JSON 上限 2 MiB。库 createAssemblyApi 不提供认证；bundle secureAssemblerApi 检查 loopback TCP peer、Host、同 Origin 或 desktop token、JSON 媒体类型。这些防护不认证恶意本机进程；外层 DSH transport 拥有其认证。

| Method | Path | Input / result |
| --- | --- | --- |
| GET | /?sessionId=… | presets/defaultPresetId/selection/capability/capabilities/sourceProtocolVersion/sources/strategyProtocolVersion/strategies |
| POST | / | 策略 JSON 或 {preset} → 201 {preset} |
| GET | /:id | {preset} |
| PUT | /:id | 策略 JSON → {preset} |
| DELETE | /:id | {ok:true} |
| PUT | /selection | {sessionId,id:string|null} → {selection} |
| POST | /preview | {sessionId,preset} 或 {sessionId,presetId} → {preview} |
| GET | /actual?sessionId=… | 最近的已记录请求 `{request,backend,recordKind,seq?}`；无可用记录时 `request:null` |

保存只改库；应用复制独立快照，id:null 关闭。生成中的 Agent 拒绝切换（409），内置策略不可覆盖/删除，已应用策略拒绝删除。preview 读取当前持久会话与来源，不含未发送输入、不激活 Agent、不准备模型。actual 读取记录，不重算 parser/macros。缺策略 ID 遵循 store 的错误状态，不能假定所有缺失 ID 都是 HTTP 404。

独立 token 路由为 GET /dsh-prompt-assembler/api/v1/request-token，带 X-Assembler-Client: embedded，返回 {ok:true,token}。desktop 无 Origin 的 mutation 携带 X-Assembler-Request-Token。使用 client-fetch 模块的 createAssemblerFetch，不持久化 token、不绕开宿主 transport。安全拒绝 403、mutation 媒体类型错误 415、正文超限 413、JSON/schema 错误 400；会话缺失可返回 404，生成中/capability/preview 租约冲突按合同返回 409。REQUEST_ASSEMBLY_CORE_REQUIRED 表示进阶缺 addon 或协议 1，不是来源故障。应用、preview、观察都不证明网络送达。

Tavern 旧前缀 /pmp-dsh-tavern/api/v1/assembly-presets 经其自身安全边界转发同一 store/runtime，不创建第二套策略系统。Host 服务、来源/block 类型、store 与界面嵌入合同见 [INTEGRATION](INTEGRATION.md) 和 [类型](../src/index.d.ts)。

策略可带 backend:native|core，缺省为旧 core。标准 user 规则可带 delivery:context|pre-step。不支持的原生布局返回 409 ASSEMBLY_NATIVE_UNSUPPORTED。`GET /actual` 默认读取最近的 durable `request/assembly`，返回 `backend` 与 `recordKind:request/assembly`。已挂载的 `readActual(sessionId)` provider 也可提供经核验的原生请求及其 `recordKind`、`seq`；按日志序号选择最近记录，同序号只有带历史装配明细的 provider 结果用于增强展示。没有 provider 且没有已有 `request/assembly` 的标准会话返回 `request:null`，不能从当前历史或预览伪造冻结证据。当前策略切换为 native 不隐藏先前的 core 记录。见[后端规则](BACKENDS.md)和[实际请求合同](INTEGRATION.md#实际请求与历史来源)。

## API 范围

策略库、会话应用快照、当前只读预览和最近实际请求是不同的可组合能力。`/actual` 没有历史记录 ID 选择器；不能用它填充另一 turn/step 的记录，也不能用 `/preview` 重建历史。逐条历史读取、来源正文授权和 Trace 展示由调用方组合公开接口；Assembler 不拥有来源资源编辑器或另一套会话历史。
