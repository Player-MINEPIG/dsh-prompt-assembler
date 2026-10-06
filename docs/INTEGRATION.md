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

示例 `myNotesStore.read({sessionId,signal})` 返回 `{id,text}[]`，接入方自行实现。注册不会加入策略或写入历史。`result.messages` 是逻辑贡献；实际 DSH 请求还需 `projectSystemSnapshots`，以及显式准备的协议 1 pre-freeze `agent/assemble-request` 钩子。Stock DSH `0.2.0-rc.2` 没有该钩子，插件安装不会修改核心。不要用逻辑消息直接替代原生 durable history。

## 来源及解析器

`register` 必填 `id/pluginId/name`，并至少实现 `resolve` 或 `parseText`。其他字段：`version`（默认 1）、`stability`、`dependencies`、`multiple`、`roles`、`lifetimes`、`depth`、`generationRequiresPlugin`。`list()` 返回 JSON 描述和 `acceptsText`，不返回可执行函数。来源身份是提供方声明，不是签名或权限隔离。

`resolve(context,rule)` 获取来源内容，与 `parseText(context,rule)` 是独立能力，至少实现一个。来源只有分散内容而不能提供独立模块时，可只注册 `parseText`；也可显式设置 `supportsModule:false` 保留旧 resolver 的兼容用途。此类来源不进入模块添加菜单，但仍出现在文本解析器菜单。`moduleAvailable({sessionId})` 可选，是同步、只读的 metadata 布尔判断：当前会话没有独立内容时返回 false；不是使用权限，不执行检索或正文解析。`registry.list({sessionId})` 的 descriptor 同时返回 `supportsModule`、`moduleAvailable`、`acceptsText`。

用户通过“添加自定义文本”选解析器，生成 `inputMode:'text'` 规则；该路径只调用来源的 `parseText`，接受 `{blocks,macros?,diagnostics?}`，位置、角色、深度及快照仍由 assembler 管理。选择解析器不添加或恢复对应来源模块，多个文本规则可使用同一解析器。第三方文本不会隐式运行 ST、EJS 或 JavaScript。`renderText({text,context,variables,block,diagnostics,identity})` 可选，必须同步返回字符串；默认保持正文，在已声明的来源宏引用展开之后运行。

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

`role:'preserve'` 保留来源的 role（未给出时 system）；用户可覆盖 system/user/assistant，原生模块只支持 preserve/request。深度 0 为末尾，正数从原生非 system 消息末尾计数，工具事务中间向后调整。`request` 每次重算，`snapshot` 变化时保留原文和历史锚点；来源禁用、卸载或改为 request 后旧快照不再注入，已有日志正文仍可读。

## 内置接入与宿主组合

- `createDshRegistry()` 提供原生基础指令、历史、本步输入和 `dsh.text`。后者用原生 `{{变量名}}` 插值，缺变量明确拒绝；不接受 ST 特有宏。DSH Skill 的 pre-step metadata、tool 正文、slash 继续由 DSH 运行，不复制注入。
- `adapters/tavern` 提供 `registerTavernSources`、`parseTavernText`、模板与 MVU 注册函数，以及兼容 preset。Tavern 手填内容与 preset 共用 history/input/world-info 引用解析和 ST 宏，来源文本原文只读；资源编辑仍在 Tavern。
- `adapters/memory-manager` 的 `connectMemoryManager(ctx,registry)` 随 `dshMemoryManager` 服务出现/卸载注册来源。Manager 的 `requestAssemblyResources()` 返回分离配置快照；`trigger` 执行只读检索，排除由来源自己管理的 MVU/世界书/模板，避免重复注入。 observer 只有核对持久 `request/assembly`、实际消息哈希与节点身份后才记录 applied；不代表网络送达。

独立插件在 Host 中组合自己的 store、registry、runtime、HTTP 与浏览器界面。package `main` 为 `src/plugin.js`；`./plugin` 提供 Host 入口，`./plugin-client` 提供浏览器入口；根导出仍为库原语。`dsh.bundle` 指向 `cordis.patch.yml`，`dsh.client` 指向提交的 `dist/client.js`。共享来源服务是 `dshPromptSources`。

`dshPromptAssembler` 提供 `{store,runtime,registry,attachTavern(options),migrateLegacy(root)}`。插件自有存储位于 Host 的 `dshHomePath('dsh-prompt-assembler')`，文件名为 `assembly-presets.json`。新独立会话没有隐式策略或全局默认；侧栏当前会话入口在第一条消息之前也可用，策略库的“使用此策略新建会话”先绑定策略再打开会话。会话标题可提供可选快捷入口。

`attachTavern({resources,sessionReads,mode,builtins,defaultPresetId,afterAssembly})` 接收来源拥有的公开只读资源对象、读取租约及兼容配置，返回 disposer。Tavern 通过 `registerTavernSources` 将来源注册到共享 registry；注册与卸载跟随来源的 scoped context，不重复注册 DSH 内置来源。assembler 不依赖 Tavern/Manager 包，不读取其内部文件。来源内容、解析权限与资源编辑仍归来源。Tavern 要求独立安装并挂载的 assembler 服务，保留旧 service/HTTP 转发到同一 owned store/runtime；新接入使用 assembler 服务与 API。不要给同一请求同时安装两个独立策略 hook。

`migrateLegacy(root)` 校验旧 `assembly-presets.json`，只合并当前存储缺少的 ID；当前 assembler 条目优先，旧文件不改写。旧 `play:` / `native:` scope 保留。独立选择先查原始 session ID，再回退到显式 `native:<id>`、`play:<id>`，包括显式 null；没有旧选择的新会话不回退到默认策略。接入 Tavern 的 mode 回调时保留其原有 mode 语义。`adapters/tavern-runtime` 继续提供兼容组合原语。

当前请求 metadata owner 为 `dsh-prompt-assembler`，历史读取仍接受旧 `pmp-dsh-tavern` 快照。移除来源或卸载插件不转换原生历史，不将旧装配正文复制进历史；插件卸载保留自己的策略存储与 DSH durable history。

独立宿主使用 `RequestAssembler({ctx,store,resources,registry,sessionReads,owner})`。resources 提供只读 `compile({agent,sessionId,resolveOnly:true})` 和当前 `assembledFor(agent)` 快照（assemblyInput、officialAssembly、diagnostics），可设 maxProfileBytes。库调用方在 DSH 资源装配后、冻结请求前调用 execute，并接入 store.copySelection 的会话继承。Preview 使用当前官方 systemPrompt 和独立 Session；`createSessionReadContext` 仅共享一次读取租约，不附着冷 Session。不要同时给同一请求安装两个独立策略 hook。

独立插件把 API 放在 Host 的认证、同源校验与适用的 desktop 令牌边界内，并在浏览器使用安全 fetch。库的 HTTP factory 负责 JSON/规则原语，不负责认证。调用方在已认证路径下调用 `createAssemblyApi({store,runtime,agents,sessions,inspect,notify,root})`。UI 用 `AssemblyPanel({sessionId,fetcher,apiRoot,locale,traceRoot?,refreshEvent,close})`；desktop 必须传入其安全 fetch wrapper。核心能力检查为 `agentLoop.requestAssemblyVersion===1`。缺少能力时编辑与只读预览仍可用，应用非空策略返回 HTTP 409（`REQUEST_ASSEMBLY_CORE_REQUIRED`）；核心须通过 [安装说明](INSTALLATION.md)中的准备工具显式准备。

## 第三方验收

```sh
node --test test/integration.test.mjs
npm pack
```

对新 adapter 补上动态内容和手填 parser 的正常/失败路径、preview 只读、每 step 求值、列表/深度、禁用/卸载、取消、来源身份与变更租约测试。向本仓库提 PR，adapter 不导入来源包的内部文件。Tavern/Manager 的真正 Host 与浏览器组合由各自集成测试验证；fixture 不等于真实 provider 或用户数据验收。

Tavern 的 preset/custom/template 保留旧手填解析兼容入口；新界面通过 tavern.text 统一选择；角色、用户与世界书通过资源编辑器管理，不声明该输入模式。DSH adapter 的 `registerDshSources(registry,{sectionPlugin})` 可接受只读来源标签映射；Tavern adapter 在此保留其官方 section 的显示身份，通用 DSH adapter 不猜测 Tavern 身份。

真实 Host 验证在[安装说明](INSTALLATION.md#验证)中单独列出，通过 `DSH_ASSEMBLER_CORE_ROOT` 和可选 `DSH_ASSEMBLER_MANAGER_ROOT` 显式选择外部 fixture。标准 CI 的 `npm ci` / `npm run check` 不提供这些运行环境；跳过不等于 Host 或浏览器验收通过。使用临时会话和离线合成 provider，不请求真实模型。
