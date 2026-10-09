# 第三方来源接入指南

[English](DEVELOPER_GUIDE_en.md) · [完整来源合同](INTEGRATION.md) · [HTTP API](API.md) · [架构](ARCHITECTURE.md)

adapter 在 assembler 仓库维护，调用提供方的公开接口。提供方拥有身份、正文语法、访问权限、revision 与编辑；assembler 管 descriptor、用户选中的位置、角色、保留方式、完整 system 投影及请求 metadata。生产包不依赖 Tavern 或 Memory Manager。

## 注册 Host 来源

[笔记示例](examples/notes.js)同时提供可独立选择的模块和 `[[note-id]]` 手填文本解析器。notes store 实现 read({sessionId,signal})，在来源授权后返回 {id,text}[]。可信 Cordis 插件可这样挂载：

```js
import { registerNotes } from './notes.js'
export function apply(ctx) {
  return ctx.inject(['dshPromptSources', 'myNotes'], scope => {
    const registry = scope.get('dshPromptSources')
    if (registry.version !== 1) throw new Error('Unsupported source protocol')
    scope.effect(() => registerNotes(registry, scope.get('myNotes')))
  })
}
```

myNotes 是接入方自己的服务，不是内置服务；需发布其读取合同并启用对应 bundle。可选 scoped injection 在两个服务存在时挂载，任一卸载时撤销。返回全部 disposer，不添加第二个请求钩子；重复来源 ID 拒绝。注册只让来源可选，用户还需显式添加规则并应用。新独立会话无隐式策略。

规则为 `{id:'notes',kind:'example.notes',role:'system',lifetime:'request',depth:null}`。手填规则另加 `inputMode:'text',text:'Read [[scene]]'`，只调用 parseText，不添加来源模块。纯解析器可不提供 resolve。同步 moduleAvailable({sessionId}) 只读 metadata，不检索或授权。双语 contentGuide 说明正文、来源、能否编辑与实际入口，不伪造编辑器或权限。

## 解析与失败语义

resolver 接收分离、深冻结的请求 context，实际请求与 preview 都保持只读并响应取消。block ID 稳定，跨来源依赖须声明，返回 text/native/reference 块。native 引用保持完整工具事务。来源租约不进入 JSON；validateResolved 在全部异步来源完成后同步复验。缺注册报告 ASSEMBLY_SOURCE_UNAVAILABLE 并略去其正文/快照；非法输出或 resolver/parser 错误拒绝请求。应区分合法空结果与未授权/读取失败，不回退 raw read。

进阶 request 每次重算；snapshot 在启用期间把变化正文留在原锚点。卸载来源阻止后续注入，保留已记录 DSH 正文。逻辑 assembleRequestAsync 结果需在冻结前通过 projectSystemSnapshots；库调用方不能用逻辑结果替换 durable history。Host 插件接入复用现有 runtime，不另挂请求钩子。

## API、存储与界面

通过 Host dshPromptAssembler.store/runtime/registry 组合能力。保存只改策略库，apply 或 applySnapshot 为会话绑定独立快照；子会话继承。migrateLegacy 只合并缺少 ID 并保留旧文件。统一 session 绑定（含 null）优先于旧 play/native scope。界面/桌面端使用 [INTEGRATION](INTEGRATION.md) 定义的安全 fetch、AssemblyPanel props 与可选 selectionTarget。

应用前调用 runtime.requireAvailable(preset)，capabilities() 区分 native 与可选 core。stock 支持标准策略；进阶要求 addon 与协议 1 核心。预览和观察不证明 provider 送达。


## 注册排序策略与预设目录

排序执行器现在是公开 registry，不依赖 Tavern。`RequestSourceRegistry.strategies`、Host `dshPromptStrategies` 和 `dshPromptAssembler.strategies` 指向同一实例。`version === 1`；`register({id,pluginId,name:[中文,English],execute})` 返回可重复调用的 disposer，重复 ID 拒绝。内置 `preset/resource/default` 通过同一合同注册。纯库可传 `new RequestSourceRegistry({strategies})`，使用 `createPositionStrategyRegistry()` 获取内置规则；空 `new PositionStrategyRegistry()` 供调用方自行组成。

[笔记末尾示例](examples/notes-last.js)给出一个独立算法。Host 插件将注册绑定在公开服务的生命周期上：

```js
import { registerNotesLast } from './notes-last.js'
export function apply(ctx) {
  return ctx.inject(['dshPromptStrategies'], scope => {
    const strategies = scope.get('dshPromptStrategies')
    if (strategies.version !== 1) throw new Error('Unsupported strategy protocol')
    scope.effect(() => registerNotesLast(strategies))
  })
}
```

注册不修改已有策略。用户在资源位置页添加并排列该规则，或保存 `layout.priority:['example.notes-last','preset','resource','default']` 后显式应用。顺序数组保留唯一的三个内置 ID，可加入命名空间 ID，总计最多 128 项；`user` 是兼容输入，规范化后移除，手动定位始终优先。`default` 消耗所有剩余节点，因此放在它后面的算法不会再取得内容。

`execute({nodes,remainingNodeIds,preset,logical})` 是同步只读回调，输入分离并深冻结。返回 `{claimedNodeIds,order?,adaptPosition?,detachSlotNodeIds?,depthNodeIds?,diagnostics?}`：认领的 ID 只能来自剩余节点；`order` 若提供，必须是所有节点的完整排列，并保留未认领节点之间的相对顺序。后续规则不会再次认领已定位节点。`detachSlotNodeIds` 仅解除已认领节点的插槽锁；`depthNodeIds` 仅给已有来源深度作说明，不改变深度。回调不能改正文、角色或消息，不能丢失/创建节点，也不能认领手动位置、原生历史、留存快照和深度边界。宏已经嵌入的子内容仍属于宿主节点，不能独立移动。`order` 默认允许布局明确启用的位置身份适配；`adaptPosition:false` 继续按来源角色/投递区域投影，内置资源策略使用此选项。标准后端保留身份时受投递区域约束；只有明确允许位置适配时才在原生投递前转换身份。完整 system 投影及工具事务检查仍在排序之后执行。

请求开始时捕获策略和来源注册；异步来源解析期间卸载不会改变该次策略执行，下一请求读取新目录。结果 `resourceLayout.strategies/sortingStages` 保存当时的描述和每阶段认领 ID。策略缺失返回 `409 POSITION_STRATEGY_UNAVAILABLE`，非法回调输出返回 `409 POSITION_STRATEGY_INVALID`；缺失算法不按来源回退设置静默降级。同步回调抛错或返回 Promise 同样拒绝装配。界面保留缺失 ID 并显示未注册，供用户移除或重装提供方；冻结结果使用当时名称。运行中热加载后使用已有 `dsh-prompt-assembler:refresh` 事件或重新打开面板刷新目录。

`dshPromptAssembler.registerPresets({pluginId,presets})` 与 `store.registerPresets` 是独立预设目录原语，不必调用 `attachTavern`。每个预设需有稳定 ID，使用既有字母/数字/下划线/连字符合同（最多 200 字符）；来源和策略 ID 允许点号等命名空间。注册规范化并复制完整数组，拒绝全局 ID 冲突，返回 disposer；条目标为 `builtin:true`、带 `pluginId`，须复制后编辑。卸载撤销目录，不删除已应用的会话快照，也不修改默认选择。调用方自行组合来源、算法、预设及其 disposer；无需新的请求钩子或 HTTP endpoint。

## 第三方插槽与隐式依赖

来源声明 `ownsSlots:true` 后，其正文及嵌套引用可组成原生插槽骨架，不要求来源 ID 为 `preset`。引用块可声明 `role:'system'|'user'|'assistant'`；节点 `slotOwner` 保留真实来源 ID，`slotOwnerRuleId` 区分同一来源的多条规则。标准后端仍要求历史、本步输入和合法角色顺序；该能力不绕过运行时边界。旧 `preset` 来源默认拥有插槽，其余来源默认不拥有，可显式关闭。

声明依赖但未在预设列表中列出时，合成规则按依赖 descriptor 选择合法角色（优先 `preserve`）及保留方式（优先 `request`），不再固定写死；显式规则优先，包括禁用规则。依赖的读取权限、同步/异步解析及 snapshot 留存仍遵循既有来源合同。

## 接入验收

运行 npm run check 和笔记示例 library smoke，再测来源/parser 失败、并发只读 preview、逐 step、取消、关闭/卸载、角色/深度、模块可用性与过期租约。可用的 prepared Host 按[安装](INSTALLATION.md#验证)显式选择外部 fixture，以临时会话和合成 provider 核对每次只有一个 request/assembly，冻结 messages 与 llm/stream 一致。浏览器单独核对来源选择、保存与应用、切换会话及 dispose。adapter 向本仓库提交，不 import 来源私有文件。

标准版的位置和留存见[后端规则](BACKENDS.md)。来源 descriptor 描述库能力，选中的后端可进一步限制。
