# 来源接入合同（协议 1）

[English](INTEGRATION_en.md) · [安装](INSTALLATION.md) · [运行示例](examples/notes.js)

## 最小接入

```js
import { RequestSourceRegistry, assembleRequestAsync, FORMAT } from 'dsh-prompt-assembler'
import { registerNotes } from './notes.js' // 本文的示例文件
const registry = new RequestSourceRegistry()
const stop = registerNotes(registry, myNotesStore)
const preset = { format: FORMAT, version: 1, name: 'Notes', rules: [
  { id: 'notes', kind: 'example.notes', role: 'user', lifetime: 'request', depth: 0 },
] }
const result = await assembleRequestAsync({ registry, preset, nativeMessages, inputIds, sessionId })
stop()
```

示例 `myNotesStore.read({sessionId,signal})` 返回 `{id,text}[]`，接入方自行实现。注册不会加入策略或写入历史。`result.messages` 是逻辑贡献。标准 Host 通过共享 runtime 的官方 sections/context/pre-step 接入，不直接发送该数组。进阶完整请求替换才需要 `projectSystemSnapshots` 和显式准备的协议 1 pre-freeze `agent/assemble-request` 钩子。Stock DSH `0.2.0-rc.2` 没有该钩子，插件安装不会修改核心。不要用逻辑消息直接替代原生 durable history。

## 来源及解析器

`register` 必填 `id/pluginId/name`，并至少实现 `resolve` 或 `parseText`。其他字段：`version`（默认 1）、`stability`、`dependencies`、`multiple`、`roles`、`lifetimes`、`depth`、`generationRequiresPlugin`。`list()` 返回 JSON 描述和 `acceptsText`，不返回可执行函数。来源身份是提供方声明，不是签名或权限隔离。

`resolve(context,rule)` 获取来源内容，与 `parseText(context,rule)` 是独立能力，至少实现一个。来源只有分散内容而不能提供独立模块时，可只注册 `parseText`；也可显式设置 `supportsModule:false` 保留旧 resolver 的兼容用途。此类来源不进入模块添加菜单，但仍出现在文本解析器菜单。`moduleAvailable({sessionId})` 可选，是同步、只读的 metadata 布尔判断：当前会话没有独立内容时返回 false；不是使用权限，不执行检索或正文解析。`registry.list({sessionId})` 的 descriptor 同时返回 `supportsModule`、`moduleAvailable`、`acceptsText`。

用户通过“添加自定义文本”选解析器，生成 `inputMode:'text'` 规则；该路径只调用来源的 `parseText`，接受 `{blocks,macros?,diagnostics?}`，位置、角色、深度及快照由选中后端管理。选择解析器不添加或恢复对应来源模块，多个文本规则可使用同一解析器。第三方文本不会隐式运行 ST、EJS 或 JavaScript。`renderText({text,context,variables,block,diagnostics,identity})` 可选，必须同步返回字符串；默认保持正文，在已声明的来源宏引用展开之后运行。

Tavern 的统一 `tavern.text` 解析器按固定顺序处理：先对手填正文执行只读 EJS，再识别 history/input/world-info 引用，最后展开角色、用户等内容宏及 ST 宏。引用来的文本不再次执行 EJS；EJS helper 的访问许可与来源租约不变。没有模板运行时遇到 EJS 会明确失败，不把代码当作普通正文发送。ST setvar/getvar 在本请求内共享临时变量，顺序可能影响结果；它们不是 MVU 持久变量。

Tavern 的存储模板仅在当前会话存在启用且支持的资源时可作为模块添加。统一 Tavern 文本解析器可独立使用只读 EJS 子集，包括 `<%- await getpreset("fragment") %>`、`<%- await getchar("card-id") %>`、有使用租约的 `getwi`；不创建模板资源、不授予访问或写入权限。界面只有 DSH 文本和统一 Tavern 文本两个内置解析器入口。旧 preset/custom/template 的手填规则仍能执行；descriptor 的 `textParserAliasFor` 指向 `tavern.text`，菜单不重复列出，界面预览、导出及明确保存时规范化为统一规则，不在打开时修改存储。统一 Tavern 文本使用 request 保留方式；旧 custom 的 snapshot 不被后台迁移，新保存的文本每次重新装配。MVU 的独立状态/更新指令块仅在当前绑定存在有效资源时可添加；Manager 的独立检索块要求有可管理的装配配置，来源已负责的 MVU、世界书和模板不重复纳入。

模块 descriptor 可提供 `contentGuide:{contains,origin,editable,editAt}`，四个字段均为 `[中文, English]` 非空字符串。adapter 必须据真实能力说明输出字段、资源来源、可编辑性和实际编辑路径；无编辑器须明确说明，不能伪造入口。UI 在所有模块展开项显示这四项，并提示用只读预览查看具体正文/资源 ID。未声明时分别显示“来源未说明”，不猜测权限或编辑能力。规则不会改变这些说明或取得正文写权限。

`context` 为本请求固定、分离且深冻结的 `sessionId/turn/step/preview/preset/assets/nativeMessages/inputIds/signal`；Signal 保持原对象。不得写状态；预览可能并发，turn/step 为 null，不含待发输入。响应卸载、取消与自己的读取版本租约；解析器失败或返回非法内容时整次请求拒绝，不发送部分结果。已开始的请求使用捕获的注册集合。资源发生变更时，可用同步 `validateResolved(context)` 在所有异步来源完成后核对租约。

`assets` 由调用方的只读资源 provider 提供，是不透明 JSON，不保证有 Tavern 字段。standalone DSH custom parser 读取 `assets.nativeVariables`。Tavern adapter 读取其公开资产快照（preset/character/user/selection/lore/official sections），Manager adapter 只调用 Manager 的公开资源快照和 trigger/observation 接口。

## 内容块与位置

| 块 | 字段 | 含义 |
| --- | --- | --- |
| text | id/text；可选 role/depth/order/name/stability/source | 一条来源文本贡献；来源字段保持 provenance |
| native | id/messageIds | 引用本次原生消息，不能伪造正文或拆开工具事务 |
| reference | id/sourceId；可选 blockIds/group | 引用依赖来源的块，来源必须在 dependencies 中声明 |

块 ID 在同一规则内稳定且唯一。text 可提供 `literalMacros` 给自己的 renderer；核心不会擅自解释。`macros` 将宏名映射到本来源 text 块 ID；使用方须声明该来源为依赖，循环/重复宏拒绝。`referenceOnly` 块仅供引用。claims/targetSourceId 等跨来源指向也必须声明依赖。返回输出的 rule/descriptor 字段不能替换注册身份。单来源上限 8 MiB/10,000 块，策略上限 128 条规则，单条手填文本上限 524,288 字符。

按模块列表放置时，明确列出的输出块由列表控制位置与深度；引用与正文宏不能搬走或重新启用它。未列出的依赖按引用方位置输出，未引用的注册来源不会自动出现。referenceOnly 字段可由引用方消费，例如角色 PHI。ST 放置由 Tavern adapter 保留插槽和深度语义；同深度 injection_order 升序。原生系统更新边界与工具调用/结果必须完整；非法顺序拒绝。

`role:'preserve'` 保留来源的 role（未给出时 system）；进阶策略可覆盖 system/user/assistant；标准策略遵循 [BACKENDS](BACKENDS.md) 的投递与角色边界，原生模块只支持 preserve/request。深度 0 为末尾，正数从原生非 system 消息末尾计数，工具事务中间向后调整。`request` 每次重算，`snapshot` 变化时保留原文和历史锚点；来源禁用、卸载或改为 request 后旧快照不再注入，已有日志正文仍可读。

## 内置接入与宿主组合

- `createDshRegistry()` 提供原生基础指令、历史、本步输入和 `dsh.text`。后者用原生 `{{变量名}}` 插值，缺变量明确拒绝；不接受 ST 特有宏。DSH Skill 的 pre-step metadata、tool 正文、slash 继续由 DSH 运行，不复制注入。
- `adapters/tavern` 提供 `registerTavernSources`、`parseTavernText`、模板与 MVU 注册函数，以及兼容 preset。Tavern 手填内容与 preset 共用 history/input/world-info 引用解析和 ST 宏，来源文本原文只读；资源编辑仍在 Tavern。
- `adapters/memory-manager` 的 `connectMemoryManager(ctx,registry)` 随 `dshMemoryManager` 服务出现/卸载注册来源。Manager 的 `requestAssemblyResources()` 返回分离配置快照；`trigger` 执行只读检索，排除由来源自己管理的 MVU/世界书/模板，避免重复注入。 observer 核对冻结实际消息与 source 节点；进阶使用 request/assembly 哈希，标准使用 system 全文、context section 或 pre-step 消息身份，然后才记录 applied；不代表网络送达。

独立插件在 Host 中组合自己的 store、registry、runtime、HTTP 与浏览器界面。package `main` 为 `src/plugin.js`；`./plugin` 提供 Host 入口，`./client` 提供浏览器入口；根导出仍为库原语。`dsh.bundle` 指向 `cordis.patch.yml`，`dsh.client` 指向提交的 `dist/client.js`。共享来源服务是 `dshPromptSources`。

`dshPromptAssembler` 提供 `{store,runtime,registry,attachTavern(options),migrateLegacy(root)}`。插件自有存储位于 Host 的 `dshHomePath('dsh-prompt-assembler')`，文件名为 `assembly-presets.json`。新独立会话没有隐式策略或全局默认；设置侧边栏的“提示词装配”入口在第一条消息之前也可用，策略库的“使用此策略新建会话”先绑定策略再打开会话。

`attachTavern({resources,sessionReads,mode,builtins,defaultPresetId,afterAssembly})` 接收来源拥有的公开只读资源对象、读取租约及兼容配置，返回 disposer。Tavern 通过 `registerTavernSources` 将来源注册到共享 registry；注册与卸载跟随来源的 scoped context，不重复注册 DSH 内置来源。assembler 不依赖 Tavern/Manager 包，不读取其内部文件。来源内容、解析权限与资源编辑仍归来源。Tavern 要求独立安装并挂载的 assembler 服务，保留旧 service/HTTP 转发到同一 owned store/runtime；新接入使用 assembler 服务与 API。不要给同一请求同时安装两个独立策略 hook。

`migrateLegacy(root)` 校验旧 `assembly-presets.json`，只合并当前存储缺少的 ID；当前 assembler 条目优先，旧文件不改写。旧 `play:` / `native:` scope 保留。独立选择先查原始 session ID，再回退到显式 `native:<id>`、`play:<id>`，包括显式 null；独立运行且未挂 Tavern 时没有默认策略。尚未重新应用的旧选择按 Tavern 当前 mode 读取；在独立插件中重新应用后，以 session ID 统一绑定，重装 Tavern 或切换视图不会恢复旧选择。`adapters/tavern-runtime` 继续提供兼容组合原语。

Tavern 默认使用标准预设插槽优先；安装 addon 不改变默认方案。现有统一/旧 scope 快照保留原后端；独立运行没有隐式默认。

当前请求 metadata owner 为 `dsh-prompt-assembler`，历史读取仍接受旧 `pmp-dsh-tavern` 快照。移除来源或卸载插件不转换原生历史，标准 user 贡献已在原生历史中，进阶不将旧装配正文复制进历史；插件卸载保留自己的策略存储与 DSH durable history。

进阶库调用方先显式注册 `CoreRequestBackend`；标准 Host 接入复用插件的公开接口钩子。独立宿主使用 `RequestAssembler({ctx,store,resources,registry,sessionReads,owner})`。resources 提供只读 `compile({agent,sessionId,resolveOnly:true})` 和当前 `assembledFor(agent)` 快照（assemblyInput、officialAssembly、diagnostics），可设 maxProfileBytes。库调用方在 DSH 资源装配后、冻结请求前调用 execute，并接入 store.copySelection 的会话继承。Preview 使用当前官方 systemPrompt 和独立 Session；`createSessionReadContext` 仅共享一次读取租约，不附着冷 Session。不要同时给同一请求安装两个独立策略 hook。

独立插件把 API 放在 Host 的认证、同源校验与适用的 desktop 令牌边界内，并在浏览器使用安全 fetch。库的 HTTP factory 负责 JSON/规则原语，不负责认证。调用方在已认证路径下调用 `createAssemblyApi({store,runtime,agents,sessions,inspect,readActual?,notify,root})`。UI 用 `AssemblyPanel({sessionId,fetcher,apiRoot,locale,traceRoot?,refreshEvent,close})`；desktop 必须传入其安全 fetch wrapper。core 能力要求 addon 挂载及 `agentLoop.requestAssemblyVersion===1`；缺任一拒绝进阶应用，标准策略检查 native 能力；核心须通过 [安装说明](INSTALLATION.md)中的准备工具显式准备。

## 第三方验收

```sh
node --test test/integration.test.mjs
npm pack
```

对新 adapter 补上动态内容和手填 parser 的正常/失败路径、preview 只读、每 step 求值、列表/深度、禁用/卸载、取消、来源身份与变更租约测试。向本仓库提 PR，adapter 不导入来源包的内部文件。Tavern/Manager 的真正 Host 与浏览器组合由各自集成测试验证；fixture 不等于真实 provider 或用户数据验收。

Tavern 的 preset/custom/template 保留旧手填解析兼容入口；新界面通过 tavern.text 统一选择；角色、用户与世界书通过资源编辑器管理，不声明该输入模式。DSH adapter 的 `registerDshSources(registry,{sectionPlugin})` 可接受只读来源标签映射；Tavern adapter 在此保留其官方 section 的显示身份，通用 DSH adapter 不猜测 Tavern 身份。

真实 Host 验证在[安装说明](INSTALLATION.md#验证)中单独列出，通过 `DSH_ASSEMBLER_CORE_ROOT` 和可选 `DSH_ASSEMBLER_MANAGER_ROOT` 显式选择外部 fixture。标准 CI 的 `npm ci` / `npm run check` 不提供这些运行环境；跳过不等于 Host 或浏览器验收通过。使用临时会话和离线合成 provider，不请求真实模型。

`AssemblyPresetStore.applySnapshot(sessionId, presetOrNull)` 验证并保存独立策略快照，不写入预设库。适用于先保存插件草稿、再创建真实 DSH 会话的调用方；`null` 解除装配策略。与 `apply` 相同，保存后该会话的快照成为请求装配的权威，不随库中同名预设修改而变化。

嵌入 `AssemblyPanel` 的调用方可传 `selectionTarget: { id, editable, getSelection(), applyAssembly(presetIdOrNull) }`，以异步方式读写插件自己的开场配置；`applyAssembly` 返回 `{ selection }`。此时不传 `sessionId`，面板按 target 身份挂载、显示其已保存快照，并继续使用装配器的规则库。应用/重置/禁用交给调用方持久保存，首次发送时再用 `applySnapshot` 接入真实会话。该 target 不模拟 DSH 会话；展开预览和请求轨迹仅对真实 `sessionId` 开放。

Host 启用与旧策略迁移遵循[后端规则](BACKENDS.md)。上文 depth/snapshot/projectSystemSnapshots/协议 1 的合同属于进阶库路径。标准生命周期为 nativeAssembly/nativePreStep；execute 仅在 addon 显式 registerRequestBackend 后委托。应用使用 requireAvailable(preset) 检查。

## 实际请求与历史来源

`GET /assembly-presets/actual?sessionId=…` 读取最近的冻结请求，不因当前策略是 native 而拒绝已有 `request/assembly`。附加 provider 可通过 `attachTavern({…,readActual})` 或 HTTP factory 的 `readActual(sessionId)` 返回 `{request,backend,recordKind,seq}`；按 DSH 日志序号与持久冻结记录比较。Tavern 的原生 observer 只保存请求边界和整组消息哈希，读取时用公共 Session detached replay 恢复该边界并核验哈希，不复制正文、不重新装配。缺少历史引用或旧会话没有当次记录时明确返回不可用。没有该 observer 的普通原生宿主无法提供完整历史请求。

实际请求视图按实际消息顺序展示当时记录的来源段落，不重新求值当前预设。新原生请求的 `nativeSourceRefs` 保存 version 1、条目名称、来源字段/资源标识及消息哈希和 UTF-16 范围；system、context、pre-step PHI 和可唯一核验的嵌套引用均可关联。正文只从 DSH 历史读取。旧记录可利用已核验段落引用恢复来源标识，缺失的条目名称明确标为未记录；无法核验的区间显示“来源未记录”，不将合并的 system 全文标为官方基础指令。 同日志序号的 provider 结果只有带历史装配明细时才用于增强冻结请求展示；缺失证据不会覆盖该次冻结正文。

旧预设条目可附带 `sourceStatus:current-name` 的当前名称标签；界面明确区分该标签与请求时保存的名称。未解析的来源标识保留在详情，摘要使用可读序号。

`actualAssemblyResult(record)` 是公开的只读展示投影，入口为 `dsh-prompt-assembler/actual-result`。调用方先验证 durable 记录，再传入该次的 `{messages,metadata}`；该 helper 不负责读取、授权或核验记录。返回的 `messages` 保持 `record.messages` 原数组与实际顺序，不把来源模块改写成请求消息，也不重新执行来源。`metadata.assembly` 描述布局；历史筛选发生在布局之后，最终正文/数量必须取 `messages`，差异取 `metadata.historyPolicy`。helper 只按已记录筛选决策协调节点展示，保留原始 audit。

Tavern Trace 使用 v3 按记录 ID 核验过的 `requestAssembly` 或 `nativeRequest`。仅当请求缺少 `metadata.assembly` 时，调用方可把该记录的 `nativeProvenance` 作为展示 metadata 传入；不补其他记录或当前配置。Trace 保留全部 system/user/assistant/tool 消息的原顺序；system 内按来源小模块及嵌套 section 展示，模块正文与完整 system 原文独立展开。这是调用方的展示方式，不是新的消息协议。

来源关联只使用记录坐标（如 `messageIndex`、`reference.messageId`）、`requestMessageIds` 或节点消息 ID。进阶 `systemProjection.version:1` / `semantics:complete-snapshots` 的每项包含 `index`、`messageId`、`inputIds` 和 `contributorIds`；后续完整 system 快照还包含较早贡献，调用方用节点的 `inputMessageIds` 与该快照的 `contributorIds` 关联它们，不能只靠相邻模块或文本相等推断。如果最终 system 字节被历史筛选修改而模块证据未刷新，应显示该次完整原文并明确来源不足，不能沿用旧模块正文归因。名称状态 `current-name` 只说明当前名称回退，不证明正文或名称在当时已记录。

最小展示组合（`verifiedRequest` 由调用方完成该次记录核验）：

```js
import { actualAssemblyResult } from 'dsh-prompt-assembler/actual-result'
const view = actualAssemblyResult(verifiedRequest)
// view.messages 是该次记录的完整消息；view.nodes 是来源展示证据。
// 历史记录缺证据时明确返回不可用，不调用 /actual 或 /preview 补齐。
```
