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

## 接入验收

运行 npm run check 和笔记示例 library smoke，再测来源/parser 失败、并发只读 preview、逐 step、取消、关闭/卸载、角色/深度、模块可用性与过期租约。可用的 prepared Host 按[安装](INSTALLATION.md#验证)显式选择外部 fixture，以临时会话和合成 provider 核对每次只有一个 request/assembly，冻结 messages 与 llm/stream 一致。浏览器单独核对来源选择、保存与应用、切换会话及 dispose。adapter 向本仓库提交，不 import 来源私有文件。

标准版的位置和留存见[后端规则](BACKENDS.md)。来源 descriptor 描述库能力，选中的后端可进一步限制。
