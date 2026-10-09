# 模型历史筛选：标准版与进阶版

[English](HISTORY_POLICY_en.md)

进阶版使用已有协议 1 请求装配接口，在发送前筛选消息副本，将实际结果与规则证据一起写入
`request/assembly`。原始 Session 事件、模型 stream 和聊天展示不改；不会注册卸载后仍需保留的
消息投影解释器。标准版使用 stock DSH 的公开 pre-step 和 surface replacement 清理旧插件注入，不需要协议 1 核心。

## 正式入口与操作

打开提示词装配策略，在「装配规则与预览」下方展开「历史筛选规则与预览」。两个区域使用相同的折叠标题、规则/预览切换样式。选择保留来源并查看匹配预览，然后使用上方「保存规则」保存整份预设；「应用到当前会话」才切换实际规则。另存为、导入、导出、新会话开场与应用快照均携带可选的 `historyPolicy` 字段。保存预设不会修改已经应用的会话快照。

匹配预览用红底表示去除，蓝底表示保留，绿底表示新增（恢复之前由本功能隐藏的消息）；片段排除在原文中分别标出保留段和去除段。绿色不表示生成了新正文。预览不修改原始日志或会话。尚未创建会话时可编辑和保存，历史预览等待会话创建后使用。

旧预设没有 `historyPolicy` 时，运行时继续使用原有会话设置；编辑器读取并提示这一来源，下次保存预设时一并收录。不会批量改写已有资源。未配置的历史策略默认关闭。assembler 主插件挂载标准清理，可选 core 插件挂载进阶筛选，二者读取已应用策略快照。编辑器及只读预览跟随草稿 backend；真正运行和直接会话 API 的能力仍由已应用 backend 决定。切换进阶版时先恢复标准版仍有效的占位，再筛选请求副本。

历史 API 与装配 API 共用已有安全路由及浏览器/桌面 transport。冷会话通过公共 inspect 和 sessions.prepare 预览，不创建 Agent。Tavern 只提供 MVU 示例和界面嵌入，不复制通用引擎或策略存储。包级 `./history-policy` 导出 Tavern 示例与挂载函数。

实际请求以保存的最终 messages 为准；进阶卡片按 `metadata.historyPolicy` 对布局中的历史正文作显示修正，保留原始布局及事件审计。标准版通过内置替换事件的 `data.historyPolicy/sourceEventSeqs` 追溯。布局先装配，历史策略随后筛选。

预览条目默认全部折叠，点击条目才展开正文。它读取原生有效消息列表，包含 DSH 保存的 `system/message`。来源列表提供独立的 `system-prompt`（系统提示历史）和 `runtime-context`（运行上下文历史）开关。取消后，预览将旧副本标红：最新的旧 runtime-context 也会去除，本步需要时重新加入一份；旧 system 由 DSH 收拢为本轮有效系统提示。预览不包含尚未生成的本步内容，标红不代表当前系统提示或运行上下文也会停止发送。工具事务和 developer 指令仍受保护。旧策略缺少 system-prompt 规则时沿用保留行为；新建默认筛选策略包含该排除项，但筛选总开关默认关闭。

## 标准版：来源清理

`registerStandardHistoryPolicy` 自动清理已经消费的插件 `user/message`。可靠依据是精确 `source.kind`
和原生事件位置；正文相同的真人输入不受影响。新会话默认关闭；来源选择与进阶版共用策略存储。
标准版始终完整保留真人输入、助手正文/思考/MVU、工具调用和结果、当前系统指令及 replay 数据。
只处理原生 append 消息与本功能自己的恢复副本；其他替换或压缩摘要保持不动。未知来源保留并提示，
用户可通过精确来源规则显式决定该插件的历史是否保留。

在 pre-step 入口记录上一 `step/end` 的 seq；其后追加的未发送内容、下游 pre-step 注入与本次
`decision.messages` 均保留。取消 runtime-context 时，若 DSH 因正文相同而复用旧快照，先将其复制为本步新消息，再清理旧副本。
每条目标在原位替换成空 **developer/message**，不产生模型消息。不能用空 system 占位：
若旧注入早于首条 system，原生系统提示投影会接管该位置并破坏恢复依据。

- 应用后从下一次被接受的 pre-step 自动运行。规则在 pre-step 入口捕获，下游并发应用从下一步生效。
- stock 请求重试复用已完成的替换；不会在每次重试或每一轮为同一条已隐藏消息写无效替换。
- 改为保留某来源或关闭后，下一步把仍处于 surface 的本功能占位替换回保存的有效 user 消息，
  保留原 ID、正文与顺序。恢复事件引用占位和原始 seq；重新排除时仍按原始年龄判定。
- 重启沿用持久配置和内置事件。fork 的新 ID 默认关闭，并在首次运行时恢复继承的占位；
  调用方可先复制父策略来继续清理。压缩/其他替换已覆盖的占位不会复活。
- 卸载停止自动操作，**保留已写入的清理结果**；原生会话仍能读取和续聊，无需插件解释器。
  如需恢复，卸载前关闭并运行一步；或由持有会话写权限的调用方在空闲时使用
  `applyStandardHistory` 传入 `enabled:false`。该显式原语不发起模型调用。
- 系统提示会按原生规则更新；空 developer 占位不参与系统提示路由。发生替换或取消 system-prompt 历史保留时开启新请求系列，让 DSH 收拢系统提示。系统原始事件仍在日志中；重新勾选不会复活已被 DSH 收拢的旧系统版本。

例如两轮各有 `预设、预设、真人、预设、assistant`，第三轮请求保留前两轮
`真人、完整 assistant、真人、完整 assistant`，再发送第三轮所需预设和真人输入。
原始 append 日志完整保留，原生聊天记录可重建。

注册示例（使用 Host 自己加载的公开 LLM 工厂）：

```js
const stopStandard = registerStandardHistoryPolicy(ctx, {
  store,
  readEvents: async session => (await ctx.get('sessionController').inspect(session.id)).events,
  createDeveloperMessage: hostLlm.createDeveloperMessage,
  active: agent => !runtime.requestAssemblyAvailable(agent.id), // 按实际 backend 选择判定
})
```

`active` 表示本步使用标准版；返回 false 时在下一 accepted pre-step 恢复本功能占位，
因此切进阶版后仍可重新筛选完整原生有效历史。需要同时保留该生命周期 hook 和进阶 hook；
不要只卸载标准 hook 再切 backend。标准 hook 应作为外层 middleware，让 `next()` 完成注入后再规划。
`applyStandardHistory(session, context, {createDeveloperMessage})` 与 `planStandardHistory(context)`
是独立原语；前者必须在调用方已获写权限且可串行修改 surface 时使用。`context` 包含完整
`events`、`policy`、可选 `revision/cutoffSeq/pendingMessages/turn/step`；纯规划还需要 `nodes/messages`。
计划中的 `reconcileSystem` 为 true 时，调用方必须让本步 `startsRequestSeries:true`，由 DSH 执行系统提示收拢；`applyStandardHistory` 本身只写 user 清理替换。
生产 `readEvents` 使用公共 controller inspect；测试使用小型完整内存 Session。

标准 service 用 `mode:'standard'`，进阶用 `mode:'advanced'`（默认）。GET/PUT 根据会话实际 backend 选择 service；只读 preview 可通过 `backend:"native"|"core"` 检查草稿方式，不授予运行能力。标准预览需要 `nodes:[...session.surface.nodes]`、原生有效 `messages` 与完整 `events`。
预览包含隐藏消息的原文及 `restore` 动作；不含尚未生成的下一步注入；被排除的最新旧上下文标红，本步所需副本稍后重新加入。
GET/PUT/preview 返回 `capabilities`。标准 UI 的来源控件可操作，真人/助手来源锁定保留，
内容类型与片段控件禁用并标明进阶专用；旧进阶规则保持存储但标准运行不应用。
标准 API 修改这些进阶字段会返回 `HISTORY_ADVANCED_REQUIRED`，不会假装生效。

隐藏事件的 `data.historyPolicy` 保存 owner/version、原始/替换目标 seq、有效原文快照、规则/版本及哈希；
其 `sourceEventSeqs` 建立原生追溯。恢复写原始 user 消息并引用隐藏事件与原始事件，不创建助手回复。
审计数据是内置事件上的惰性 JSON，无插件解释器依赖；模型请求以当时原生 surface 为准。

## 进阶版行为

新会话的策略默认关闭。启用默认干净策略后，保留真人输入和助手正文；排除历史中的
`dsh-prompt-assembler`、`ptc-mode`、工具来源 user 注入及过期 `runtime-context` 副本。
按精确 `source.kind` 分类，不按角色或文本猜来源；旧版错误标成 `user` 的注入无法安全识别，仍保留。
未知来源保留，并显示 `UNKNOWN_SOURCE_RETAINED`。用户可添加精确来源并设置保留/排除。

以下内容受保护：

- 当前 step 接收的消息与本次装配的新贡献，包括当前 preset/worldbook/PHI。
- 本步重新加入的 `runtime-context`；所有匹配排除规则的旧快照（包括此前最新一条）均可去除。
- 本轮有效 system、developer 消息、完整工具调用消息、tool 结果，以及未知格式的 `source.replayState` 消息。旧 system-prompt 可按来源去除。
- 未经验证能安全省略的 reasoning。含必需 reasoning 的消息也不能按来源整条排除。

来源开关控制旧副本；关闭当前运行上下文贡献仍由已有装配配置负责。工具事务保护不因来源开关解除。
消息保留原 ID、角色和顺序；不会拼成单个 user checkpoint。

## 规则、预览和生命周期

`contentTypes` 支持 text、image、reasoning。默认保留 text/image，reasoning 仅在目标 adapter
合同明确允许时排除。没有认证的 `reasoningSafety` 回调时保留思考并提示；回调需返回
`{ canOmit: true, contract: '具体合同标识' }`。它属于可信 Host 配置，不来自客户端 JSON。
运行时只要请求携带 tools 或历史仍含工具事务就保留思考，回调不能覆盖这条保护。
DeepSeek [官方思考合同](https://api-docs.deepseek.com/guides/thinking_mode/)要求携带 tools
时回传历史思考；此实现不按 provider 名字猜协议或宣称所有模型都可删思考。

助手正文片段规则使用精确起止标记，不执行正则或脚本：

```json
{
  "id": "example-block",
  "sourceKind": "model",
  "start": "<PrivateBlock>",
  "end": "</PrivateBlock>",
  "mode": "lines",
  "enabled": true
}
```

`lines` 只匹配从行首开始的完整独立行，跳过代码围栏；`literal` 明确允许行内匹配。
嵌套、孤立闭合、未闭合标记保留并提示。默认片段规则为空。匹配范围是原始正文的 UTF-16
字符偏移 `[start,end)`，重叠范围取并集，保留其他正文。预览展示原文、有效内容、匹配片段与原因。
Tavern 提供默认关闭的 MVU wrapper 示例；通用引擎不内置 MVU 语义。

对已核对的 stock rc.2 DeepSeek Messages v1 replay 格式，可编辑 text 片段，但必须保留所有
内容块、索引、reasoning 原文和签名，甚至正文删空时也保留空 text 块。不能整条排除或移除
任何内容块。未知字段/版本回退为整条保留。`test/history-replay.test.mjs` 执行原版 adapter
的 replay 校验和 assistant 序列化函数，确认编辑后的正文被采用且签名未降级；未调用远端 API。

- 应用从**下一步进阶请求**生效，并重算现存原生有效历史，不改已经记录的请求。
- 同一步的重试沿用捕获的规则版本；中途应用的规则从下一个 step 生效。
- 启用期间开启新请求系列，以免把历史前缀变化当成原序列的纯追加。
- 关闭或卸载后，下一步恢复原生有效历史；已被原生压缩覆盖的消息不会复原。
- 重启从配置文件恢复同一 session 的选择。fork 的会话 ID 不同，默认关闭；需要继承时由调用方显式复制策略。
- 压缩摘要按当前来源处理，未知摘要保留；不会解析摘要猜测原消息来源，也不会复活 shadowed 节点。

## 独立接入

公开子路径已由包的 wildcard export 覆盖，无需修改包导出：

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
  // reasoningSafety is optional: without verified adapter facts, reasoning is retained.
})
ctx.effect(() => stop)
```

Host 上下文需注入 `agentLoop`、`dshPromptAssembler`、`sessionController`；预览还需 `sessions`。
`runtime` 是已有 assembler runtime。注册要求 prepared protocol 1 核心，且只在已选择的 core
装配策略下运行。它以 prepend middleware 在既有装配完成后筛选，不替换现有 backend、布局或 registry。
不要另造一套装配器或在标准路径挂载；移除时调用 disposer。

`createHistoryPolicyService({store, readContext, reasoningSafety})` 的 `readContext(sessionId)` 返回
`{messages, events, nodes?, tools?, config?, currentStepSeq?}`，其中 messages 必须来自原生当前有效 surface，
不是上次已经筛过的 `request/assembly`。冷会话可沿用已有 inspect + sessions.prepare 读取流程，
不启动 Agent。应同时提供 nodes，让进阶预览模拟切换时的标准占位恢复。预览不包含未发送草稿或尚未生成的本步贡献；活跃 step 可传 currentStepSeq 保留它的消息。
预览和运行时应使用同一套经过验证的 reasoningSafety；preview 的 tools 应取当前目标请求的工具配置。

`createHistoryPolicyHandler({service})` 是原始路由，须挂到**现有 assembler 安全包装内部**，
共享现有 request-token/桌面鉴权。独立服务器可用 `createHistoryPolicyApi({service,security})`
自带 loopback、Host、Origin、JSON 媒体类型和 token 防护。不要把原始 handler 直接暴露到网络。

| 方法与路径（相对 HISTORY_API_ROOT） | 作用 |
| --- | --- |
| GET `?sessionId=…` | 读取 `{revision,policy,capabilities}` |
| PUT `?sessionId=…` | 保存 `{policy,expectedRevision}`；冲突返回 409 |
| POST `/preview?sessionId=…` | 预览 `{policy?,backend?}`；不保存、不发送模型请求 |

完整根路径为 `/dsh-prompt-assembler/api/v1/history-policy`。请求体上限 256 KiB。
预设及其应用快照中的规则保存在 `assembly-presets.json`；旧会话独立设置仍保存在 `history-policies.json`。直接 PUT 对含历史规则的已应用快照作会话级更新，不修改策略库；旧快照则更新原有会话设置。revision 是不透明的数值版本，调用方只回传 GET 的值，不自行递增。两份存储均由单 Host 实例持有，使用临时文件原子 rename。
多进程共享写入不在合同中。

`mountHistoryPolicyPanel(container,{sessionId,request?,fragmentPresets?})` 返回 `{ready,dispose}`。
桌面端通过 request 注入既有鉴权 transport。独立挂载保留直接会话保存方式；策略页使用 `value/backend/onChange` 草稿模式，通过 `getPolicy()` 将编辑结果并入预设，隐藏独立保存按钮。切换会话、预设、backend 或卸载时 dispose 并重新挂载。

## 审计与兼容性

`request/assembly.data.messages` 是最终发送的消息。`metadata.historyPolicy` 保存规则快照、配置
revision、输入/输出哈希、原消息 ID/seq、每块修改及匹配范围、保留原因和诊断。既有
`metadata.assembly` 描述的是筛选前的布局，消费者应以最终 messages 为发送依据，不能把旧布局
节点里的正文或 message count 当成筛选后的结果。需要显示差异时使用 historyPolicy 与最终 messages。

没有伪造 assistant 事件或 provider stream。stock rc.2 可重放并继续包含这些既有 ignorable
request/assembly 记录的会话。标准原生 replacement 的助手校验矛盾及投影卸载限制仍由
`test/history-native-capabilities.test.mjs` 复现；进阶版不依赖那些受限接口；标准版只使用已验证的 user → 空 developer → user 单节点替换。

## 验证

```sh
DSH_ASSEMBLER_CORE_ROOT=/path/to/prepared-runtime \
DSH_ASSEMBLER_STOCK_ROOT=/path/to/stock-runtime \
node --test test/history-*.test.mjs
```

纯规则测试覆盖来源、同文输入、当前上下文、片段及误匹配、配置冲突。HTTP/DOM 测试覆盖预览、保存、
刷新、两版控件区分和安全拒绝。`history-standard.test.mjs` 在未修改 stock Host 上覆盖三轮预设场景、原位恢复及去重。真实 Host 模块配合离线合成 adapter 覆盖多轮、新步、重试版本固定、工具事务、
磁盘序列化后全 Host 重建、fork、原生 replacement 压缩边界，以及回到 stock Host 后继续对话。
压缩测试用真实 surface replacement 注入合成摘要，不调用付费摘要模型；重启使用临时 JSON seed，
不是生产 session-storage 后端验收。没有付费 provider 请求或 token 节省测量。
