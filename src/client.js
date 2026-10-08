import { AssemblyError } from './assembly-error.js'
import { HistoryPanel, historyPanelCss } from './history-panel.js'
import { actualAssemblyResult } from './actual-result.js'
import { layoutPlacement } from './resource-layout.js'
import { ResourcePositionEditor, PositionDecisions, SummaryMetadata } from './resource-layout-client.js'
import { contextControlRows, isContextControl } from './native-context.js'
import { createElement as h, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BUILTINS } from './model.js'
import { validateNativePreset } from './native-policy.js'

const labels = {
  'dsh.runtime-context': ['DSH 原生运行环境提示（总开关）', 'DSH runtime environment prompts (master)'],
  'dsh.sandbox-policy': ['沙箱策略提示 · sandbox:policy', 'Sandbox prompt · sandbox:policy'],
  'dsh.approval-policy': ['审批策略提示 · approval:policy', 'Approval prompt · approval:policy'],
  contextControlHint: ['只控制 DSH 原生提示文字，不改变工具权限、审批机制、原生对话或其他模块的 context 内容。位置和封装由 DSH 管理。关闭不删除历史中已有快照；后续请求按原生快照规则更新。', 'Controls DSH prompt text only, retaining tool permissions, approval enforcement, conversation history and other modules’ context. DSH owns placement and framing. Existing historical snapshots remain; later requests use native snapshot updates.'],
  contextMasterHint: ['总开关只管理 sandbox:policy、approval:policy、subagent:delegation。总开关关闭时，子项设置保留但暂不发送。其他来源保留，有剩余 context 时封装文字仍会出现。', 'The master covers only sandbox:policy, approval:policy and subagent:delegation. When off, child settings are retained but not sent. Other sources remain; framing remains whenever any context survives.'],
  contextControlled: ['原生上下文 · 仅控制发送开关', 'Native context · transmission toggle only'],
  contextPreview: ['DSH 原生运行环境提示', 'DSH runtime environment prompts'],
  contextIncluded: ['本次保留', 'Included'], contextExcluded: ['本次关闭', 'Disabled'],

  sourceIdentity: ['按来源条目身份', 'Per source entry'],
  backend: ['接入方式', 'Backend'], backendNative: ['标准版 · 官方接口', 'Standard · public interfaces'], backendCore: ['进阶版 · 核心扩展', 'Advanced · core extension'],
  'native-roles': ['预设身份优先', 'Preset roles first'],
  'native-slots': ['预设插槽优先', 'Preset slots first'],
  nativeRolesHint: ['按预设条目的 system/user 身份分组；system 放在历史前，user 按投递方式放在历史之后。预设与世界书的条目角色不受整块角色覆盖；同一投递区域内优先遵循预设插槽，其次条目顺序，再次模块顺序。原生历史与输入保留。', 'Group preset entries by authored system/user role. System content precedes history; user content follows history through the selected delivery. Module overrides do not replace preset or worldbook entry roles. Within a delivery region, preset slots precede entry order, then module order. Native history/input remain.'],
  nativeSlotsHint: ['预设正文及引用内容按预设插槽排列；这些内容及世界书深度 0/1 会适配 system/user。深度 0 在原生历史后，1 在历史前；更大深度保留并近似处理。独立内容保留自身角色和投递方式。system 只能在历史前；末尾提醒请明确设为 user、pre-step。请在当前资源布局中移动完整连续块。', 'Preset text and references follow preset slots; these and worldbook depths 0/1 adapt system/user roles. Depth 0 follows native history; 1 precedes it. Larger depths are retained and approximated. Independent content keeps its role and delivery. System stays before history; for a final reminder explicitly choose user and pre-step. Move complete contiguous blocks in the current resource layout.'],
  placementPending: ['正在检查预设引用…', 'Checking preset references…'],
  placementFailed: ['无法检查引用，请重试预览：', 'Could not check references; retry preview: '],
  controlPreset: ['插槽或深度边界控制 · 位置锁定', 'Slot or depth boundary controlled · position locked'],
  controlMixed: ['部分受插槽或深度边界控制 · 仅移动独立部分', 'Partly slot or depth controlled · move independent content only'],
  controlIndependent: ['独立内容 · 按角色边界移动', 'Independent content · move within role boundaries'],
  controlNative: ['原生边界 · 由预设插槽决定', 'Native boundary · follows preset slots'],
  controlEmpty: ['当前无独立内容', 'No independent content currently'],
  nativeWorldRole: ['由世界书各条目决定', 'Per worldbook entry'],
  nativeSlotRole: ['按插槽或深度边界适配', 'Adapted to slot or depth boundary'],
  nativeDepthBoundary: ['深度映射', 'Depth mapping'],
  'before-history': ['原生历史前', 'Before native history'],
  'after-history': ['原生历史后', 'After native history'],
  worldSlotMissing: ['缺少预设锚点，沿用原有前后位置', 'Missing preset anchor; using the existing before/after fallback'],
  nativeDepthApproximated: ['未采用历史深度，已按当前模式排列', 'History depth not applied; placed by the selected mode'],
  nativeRoleChanged: ['角色调整', 'Role adjusted'],
  nativeDeliveryChanged: ['投递调整为 pre-step', 'Delivery changed to pre-step'],
  nativeSlotsAbsent: ['预设未引用历史或本步输入，已按身份优先排列。', 'No preset history/input reference; using roles-first ordering.'],
  nativePresetRole: ['由预设各条目决定', 'Per preset entry'],
  nativeOrderChanged: ['已按原生边界调整顺序，以下预览是调整后的结果。', 'Order adjusted to native boundaries; the preview below shows the resulting order.'],
  nativeHint: ['system 模块按官方接口更新；user 贡献只能追加到已有历史之后，使用持久 context 或 pre-step。原生历史与本步输入必须保留；预设聊天插槽和条目角色不决定标准版模块位置。', 'System modules use official updates; new user contributions follow existing history through durable context or pre-step. Native history/input remain enabled. Preset chat slots and authored roles do not control standard module placement.'],
  coreHint: ['此策略要求可选核心装配扩展与配套 DSH 核心；标准安装不会自动启用。', 'This strategy requires the optional core assembly extension and its prepared DSH core. Standard installation does not enable it.'],
  delivery: ['user 写入方式', 'User delivery'], context: ['内容变化时写入上下文快照', 'Context snapshot when content changes'], 'pre-step': ['每个实际模型步骤写入消息', 'Message at each actual model step'],
  nativeRetentionHint: ['两种 user 写入方式都会进入 DSH 历史；关闭来源停止后续贡献，旧正文保留。', 'Both user delivery modes enter DSH history. Disabling stops future contributions; earlier text remains.'],

  'harness:identity': ['DSH 身份指令', 'DSH identity'], 'deployment:persona-prefix': ['部署前置指令', 'Deployment prefix'], 'deployment:persona-suffix': ['部署后置指令', 'Deployment suffix'], 'rp:policy': ['Tavern 角色扮演规则', 'Tavern roleplay policy'],
  'tavern.mvu/state': ['MVU 状态与更新指令', 'MVU state and update instructions'],
  main: ['主提示词', 'Main prompt'], jailbreak: ['后置指令', 'Post-history instructions'], charDescription: ['角色描述', 'Character description'], charPersonality: ['角色性格', 'Character personality'], dialogueExamples: ['对话示例', 'Dialogue examples'], personaDescription: ['用户设定', 'User persona'],
  contentMode: ['内容方式', 'Content mode'], sourceMode: ['来源内容', 'Source content'], textMode: ['手填内容（来源解析）', 'User text (source parser)'],
  'dsh.text': ['DSH 自定义文本', 'DSH custom text'],
  retry: ['重试', 'Retry'], cancel: ['取消', 'Cancel'], confirm: ['确认', 'Confirm'],
  withdrawnPreset: ['该内置策略已不在当前目录中。此会话已应用的旧配置仍保留；更改时请选择当前可用策略。', 'This built-in strategy is no longer in the current catalog. This session retains its applied configuration; choose an available strategy to change it.'],
  placementTip: ['小贴士：如果模型出现掉格式、不遵循指令等问题，可以尝试将相关的格式要求或行为指令后置，并通过装配结果确认实际位置。', 'Tip: If the model drops formatting or misses instructions, try placing the relevant format requirements or behavior instructions later, then check their actual position in the assembly result.'],
  librarySection: ['策略库', 'Strategy library'], applicationSection: ['会话应用', 'Session application'], rulesSection: ['装配规则与预览', 'Assembly rules and preview'], interfaceSettings: ['界面设置', 'Interface settings'],
  createSession: ['使用此策略新建会话', 'Create a session with this strategy'], session: ['会话', 'Session'], newSession: ['新会话', 'New Session'],
  disable: ['关闭策略，使用 DSH 默认', 'Disable; use DSH default'],
  'additional-phi': ['策略追加的后置指令', 'Additional strategy instructions'],
  description: ['角色描述', 'Character description'], personality: ['角色性格', 'Character personality'], scenario: ['场景', 'Scenario'], examples: ['对话示例', 'Dialogue examples'], system: ['系统指令', 'System instructions'], user: ['用户', 'User'], assistant: ['助手', 'Assistant'], tool: ['工具结果', 'Tool result'], greeting: ['开场白参考', 'Greeting reference'], depth_prompt: ['角色深度提示', 'Character depth prompt'],
  defaultHint: ['内置策略不能改名或删除；修改规则后保存为副本。', 'Built-ins cannot be renamed or deleted; save rule changes as a copy.'],
  dropHere: ['松开以移动：', 'Drop to move: '],

  draftPreviewScope: ['以下是当前开场草稿的逻辑排列，使用所选资源与草稿变量。尚无原生历史，不含待发送输入；实际请求需发送后查看。', 'This shows the opening draft’s logical order using its selected resources and variables. There is no native history yet; pending input is excluded. Actual requests are available after sending.'],
  nativePreviewScope: ['以下是当前策略的逻辑排列，不是完整的实际请求。DSH 会保存 user 贡献；后续请求还可能包含已保存的旧贡献。预览不含待发送输入。', 'This shows the current strategy’s logical order, not a complete actual request. DSH saves user contributions, so later requests may also contain earlier contributions. Pending input is excluded.'], logicalMessages: ['逻辑排列', 'Logical order'],
  'source-unrecorded': ['来源未记录', 'Source not recorded'], 'historical-system-update': ['历史 system 快照', 'Historical system snapshot'], historicalSystemHint: ['此前保留的有效系统指令；来源明细未记录。', 'Effective system instructions retained from an earlier step; source details were not recorded.'], 'native-context-framing': ['原生上下文封装', 'Native context framing'], sourceNameUnrecorded: ['当时的条目名称未记录。', 'Original item name not recorded.'], sourceNameCurrent: ['名称来自当前预设；正文来自当时请求。', 'Name from the current preset; body from the recorded request.'], sourceFieldsUnrecorded: ['来源字段未记录；仅有当时保存的段落名称。', 'Source fields not recorded; only the recorded section name is available.'],
  actual: ['查看最近实际请求', 'View latest actual request'], noActual: ['暂无可读取的实际请求记录', 'No readable actual request record yet'], noActualNative: ['暂无可读取的原生实际请求记录；更新前未记录请求边界的会话，请在下一次发送后查看。', 'No readable native request record yet. If this session predates request capture, view it after the next send.'], actualNotice: ['以下是轨迹保存的实际请求，修改当前预设不会改变它。', 'This is the recorded request. Editing the preset does not change it.'],
  addSource: ['添加模块（当前有独立内容）', 'Add a module (current independent content)'], chooseSource: ['选择来源…', 'Choose source…'], sourceHelp: ['模块只列出当前提供独立内容的来源。分散内容可通过文本解析器引用；填写文本后保存规则并应用到当前会话。', 'Modules list sources with independent content. Reference dispersed content through a text parser, save the rules, then apply them to the current session.'], missingSource: ['来源插件未安装或未注册；本次请求跳过此模块。', 'Source unavailable; this module is omitted from the request.'], title: ['提示词装配策略', 'Prompt assembly strategy'], intro: ['安排内容如何进入每次模型请求。预览当前资产、宏引用和实际顺序。', 'Arrange each model request. Preview assets, macro references and message order.'],
  import: ['导入', 'Import'], export: ['导出', 'Export'], create: ['创建', 'Create'], copy: ['另存为', 'Save as'], save: ['保存规则', 'Save rules'], remove: ['删除', 'Delete'], select: ['选择装配策略', 'Assembly strategy'], name: ['名称', 'Name'], apply: ['应用到当前会话', 'Apply to this session'], applied: ['当前应用', 'Applied'], legacy: ['DSH 默认策略', 'DSH default strategy'], reset: ['应用默认装配策略', 'Apply default strategy'], preview: ['装配结果', 'Assembly result'], rules: ['资源位置', 'Resource positions'], expanded: ['展开预览', 'Expanded preview'], add: ['添加', 'Add'], source: ['来源', 'Source'], stability: ['稳定性', 'Stability'], lifetime: ['保留方式', 'Retention'], request: ['每次重新装配', 'Rebuild each request'], snapshot: ['累积快照供后续请求使用', 'Retain snapshots for later requests'], retained: ['已保存的快照', 'Saved snapshot'], nativeRetention: ['由 DSH 保存与提供', 'Saved and supplied by DSH'], native: ['原生历史', 'Native history'], preserve: ['保留原始角色', 'Preserve original role'], depth: ['历史深度（留空使用列表位置）', 'History depth (blank uses list position)'], asset: ['资产修改时变化', 'Changes with asset'], conversation: ['随对话变化', 'Changes with conversation'], evaluation: ['每次求值可能变化', 'May change on evaluation'], assembly: ['由官方装配决定', 'Determined by core assembly'], saved: ['已保存；应用后影响后续请求', 'Saved; apply to affect future requests'], appliedStatus: ['已应用到当前会话', 'Applied to this session'], unavailable: ['宿主尚未支持请求装配协议。可以编辑和预览；应用前需安装核心扩展。', 'Editing and preview are available. Applying requires the request assembly core extension.'], previewScope: ['预览使用当前资产与可读取历史，不含待发送输入；随机宏使用固定样例。实际请求以轨迹中的冻结结果为准。', 'Preview uses current assets and available history, without pending input. Random macros use a fixed sample. Recorded requests contain the frozen result.'], deferredSelection: ['应用到当前开场配置；首次发送时接入会话。可预览当前开场资源，实际请求需发送后查看。', 'Apply to the current opening configuration; it transfers on first send. Preview opening resources now; actual requests are available after sending.'], noSession: ['请先打开会话', 'Open a session first'], loading: ['加载中…', 'Loading…'], close: ['关闭', 'Close'], up: ['上移', 'Move up'], down: ['下移', 'Move down'], text: ['内容', 'Content'], role: ['消息角色', 'Message role'], placement: ['放置策略', 'Placement'], st: ['遵循预设插槽与深度', 'Preset slots and depth'], stHelp: ['预设插槽（ST marker）是预设列表中的独立条目，例如角色描述、世界书、聊天历史。宏则写在正文内，如 {{description}}。两者都可引用内容，但插槽决定列表位置，宏在正文位置展开。', 'ST markers are standalone preset slots, such as character description, world books and chat history. Macros such as {{description}} expand inside text. Both reference content, but slots occupy list positions while macros expand at their authored text position.'], previewDepth: ['历史深度', 'History depth'], listPosition: ['按列表位置', 'List position'], emptyRequest: ['装配结果为空。请启用或填写至少一条内容。', 'The assembled request is empty. Enable or fill at least one item.'], systemOnly: ['当前只有系统指令。DeepSeek 等接口还要求非空的对话消息；仅使用自定义内容时，请将至少一条的角色设为「用户」。', 'Only system instructions remain. APIs such as DeepSeek also require a nonempty conversation message. When using only custom content, set at least one item to User.'], modules: ['按模块列表顺序', 'Module order'], removed: ['卸载后不再生成；已记录正文仍可读', 'Plugin required to generate; recorded content remains readable'], nativeSource: ['DSH 原生提供，不依赖 Tavern', 'Provided by DSH, independent of Tavern'], recorded: ['发送时保存到请求轨迹', 'Recorded in request trace when sent'], locked: ['位置由引用或深度规则决定', 'Position owned by a reference or depth rule'], empty: ['请生成预览', 'Generate a preview'], dirty: ['有未保存修改', 'Unsaved changes'], discard: ['放弃尚未保存的修改？', 'Discard unsaved changes?'], confirmDelete: ['删除这份装配策略？', 'Delete this preset?'], diagnostics: ['装配诊断', 'Assembly diagnostics'], tools: ['工具定义使用独立请求字段，不参与消息拖拽。', 'Tool definitions are a separate request field, not draggable messages.'], result: ['请求消息', 'Request messages'], audit: ['每次重新装配：轨迹保留实际请求，但下次重新求值，不累积旧副本。累积快照：内容变化时保留新副本，并带入后续请求。原生用户消息、回复和工具结果仍由 DSH 保存，是否发送由原生历史与本步输入控制。', 'Rebuild each request: the trace records the actual request, while later requests evaluate fresh content without accumulating copies. Retain snapshots: changed content adds a copy reused by later requests. DSH still saves native user messages, replies and tool results; history and current-input rules control whether they are sent.'],
  contains: ['包含内容', 'Included content'], contentOrigin: ['内容来源', 'Content origin'], editable: ['手动编辑', 'Manual editing'], editAt: ['修改入口', 'Where to edit'],
  unknownContains: ['来源未声明模块包含哪些字段；请先预览实际正文。', 'The provider has not described its included fields; preview the actual content first.'], unknownOrigin: ['来源未提供资源位置说明；预览节点显示已返回的资源 ID。', 'The provider has not described resource locations; preview identifies returned resource IDs.'], unknownEditable: ['来源未声明正文编辑能力，不能在此直接修改。', 'The provider has not declared content editing support; content cannot be edited here.'], unknownEditAt: ['来源未提供编辑入口；请查阅该来源插件的文档。', 'The provider has not supplied an editing entry point; consult its documentation.'],
  modulePreviewHelp: ['打开「装配结果」，展开模块查看实际正文、资源 ID 和字段；预览不会写入资源。', 'Open Assembly result and expand a node to inspect actual text, resource IDs and fields; preview does not write resources.'],
  'tavern.text': ['Tavern 文本解析器', 'Tavern text parser'],
  tavernParserHelp: ['先对手填文本执行受限 EJS，再展开角色、世界书和历史引用，最后解析 ST 宏。可混用这些语法；引用内容不会再次作为 EJS 执行。ST setvar/getvar 在本次装配内共享临时变量，顺序可能影响结果。', 'Authored text runs restricted EJS, then character/world-book/history references, then ST macros. These syntaxes can be mixed; referenced content is never reevaluated as EJS. ST setvar/getvar share temporary variables within this assembly, so order can affect results.'], dshParserHelp: ['仅展开 DSH 提供的 {{变量名}}；未知变量报错。Tavern 宏和 EJS 请使用 Tavern 文本解析器。', 'Expands only DSH-provided {{variable}} values; unknown variables fail. Use the Tavern text parser for Tavern macros and EJS.'],
  parser: ['文本解析器', 'Text parser'], addText: ['添加自定义文本', 'Add custom text'],
  'native-system': ['官方基础指令', 'Native instructions'], preset: ['预设正文', 'Preset content'], character: ['角色设定', 'Character'], persona: ['用户设定', 'User persona'], worldbook: ['世界书', 'World books'], history: ['原生历史', 'Native history'], input: ['本步输入', 'Current input'], phi: ['PHI · 后置指令', 'Post-history instructions'], custom: ['自定义内容', 'Custom content'],
}
export function sourceColor(plugin) {
  if (!plugin) return '#999999'
  if (plugin === 'DSH') return '#8192ad'
  if (plugin === 'pmp-dsh-tavern' || plugin?.startsWith('pmp-dsh-tavern/')) return '#6495ed'
  let hash = 0; for (const c of plugin ?? 'unknown') hash = (hash * 31 + c.charCodeAt(0)) | 0
  return `hsl(${Math.abs(hash) % 360} 60% 62%)`
}
async function request(fetcher, apiRoot, path = '', method = 'GET', body) {
  const res = await fetcher(`${apiRoot}${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const data = await res.json(); if (!res.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${res.status}`); return data
}
// Keep editor/caret repainting within its own layer above retained conversation cards.
export const assemblyCss = `
.dta-stage{position:absolute;top:var(--dta-content-top,84px);bottom:0;left:var(--dta-content-left,0px);width:var(--dta-center-width,100%);z-index:1;pointer-events:none;background:#0005;padding:8px;box-sizing:border-box;display:flex;justify-content:center}
.dta-stage.dta-standalone{inset:0;width:100%;z-index:100;padding:24px}.dta-launcher{font:inherit;color:inherit;border:1px solid currentColor;border-radius:8px;background:transparent;padding:7px 10px;cursor:pointer}.dta-standalone .dtv-assembly-screen{width:min(960px,100%)}.dta-section-title{font-size:15px;font-weight:600;margin:24px 0 16px;padding-top:20px;border-top:1px solid var(--dta-border)}.dta-content>.dta-section-title:first-child{margin-top:0;padding-top:0;border-top:0}.dta-interface-settings{margin-top:28px}.dta-toolbar.dta-session-controls{gap:16px 24px}.dta-session-controls label{display:flex;align-items:center;gap:12px;max-width:100%}.dtv-assembly-screen .dta-session-controls select{width:120px;flex-shrink:1}.dtv-assembly-screen .dta-session-controls label:first-child select{width:220px}@media(max-width:600px){.dta-session-controls label{flex-wrap:wrap}}
.dtv-assembly-screen{--dta-border:color-mix(in srgb,var(--dsw-alias-label-primary,#24252b) 32%,var(--dsw-alias-bg-base,#fff));position:relative;contain:paint;transform:translateZ(0);width:min(var(--dsh-composer-card-max-width,780px),100%);pointer-events:auto;display:flex;flex-direction:column;box-sizing:border-box;container-type:inline-size;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#24252b);border:1px solid var(--dta-border);border-radius:18px;box-shadow:0 18px 65px #0003;font:14px/1.55 system-ui;overflow:hidden}.dtv-assembly-screen *{box-sizing:border-box}
.dta-confirm-shade{position:absolute;inset:0;z-index:4;background:#0006;display:grid;place-items:center;padding:20px}.dta-confirm{background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dta-border);border-radius:14px;padding:24px;max-width:100%;width:360px;box-shadow:0 10px 40px #0004}.dta-confirm p{margin:0 0 20px}.dta-confirm .dta-toolbar{justify-content:flex-end;margin:0}
.dta-head{display:flex;justify-content:space-between;align-items:start;padding:20px 28px;border-bottom:1px solid var(--dta-border)}.dta-head{width:100%;max-width:calc(var(--dsh-composer-card-max-width,780px) + 56px);margin:auto}.dta-head h2{margin:0;font-size:22px}.dta-head p{margin:5px 0 0;opacity:.7}.dta-body{overflow:auto;padding:22px 28px 50px;flex:1}.dta-content{max-width:var(--dsh-composer-card-max-width,780px);margin:auto}.dta-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center}
.dtv-assembly-screen button,.dtv-assembly-screen select,.dtv-assembly-screen input:not([type=checkbox]),.dtv-assembly-screen textarea{font:inherit;color:inherit;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));border:1px solid var(--dta-border);border-radius:9px;padding:8px 12px;min-width:0}.dtv-assembly-screen select,.dtv-assembly-screen input:not([type=checkbox]){height:40px;line-height:22px;width:100%}.dtv-assembly-screen .dta-toolbar select{width:auto;max-width:100%}.dtv-assembly-screen button{cursor:pointer}.dtv-assembly-screen button:disabled{opacity:.45;cursor:default}.dtv-assembly-screen :focus-visible{outline:2px solid #4386dc;outline-offset:2px}.dtv-assembly-screen .primary{background:#347cd2;color:white;border-color:#347cd2}.dta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.dta-grid label{display:flex;flex-direction:column;gap:5px}.dta-notice{padding:12px 15px;border-radius:10px;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base));margin:12px 0;overflow-wrap:anywhere}.dta-notice[data-error=true],.dtv-assembly-screen .dta-notice[role=alert]{background:#fce8e8;color:#8f2020;border:1px solid #e9a6a6}.dta-notice[data-error=true] pre{white-space:pre-wrap;overflow-wrap:anywhere;color:inherit}.dta-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0 14px}.dtv-assembly-screen .dta-tabs button[aria-pressed=true]{border-color:var(--dsw-alias-state-business-primary,#4d6bfe);box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary,#4d6bfe);color:var(--dsw-alias-state-business-primary,#4d6bfe)}
.dtv-assembly-screen select{appearance:none;-webkit-appearance:none;padding-right:40px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='m4 6 4 4 4-4' fill='none' stroke='%23787880' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;background-size:16px 16px}@media(forced-colors:active){.dtv-assembly-screen select{appearance:auto;-webkit-appearance:auto;background-image:none}}
.dta-row,.dta-position-row{border:1px solid var(--dta-border);border-left:5px solid var(--assembly-color);border-radius:14px;margin:10px 0;background:var(--dsw-alias-bg-base,#fff);overflow:hidden}.dta-row[data-dragover=true]{outline:2px solid #4386dc}.dta-summary{display:flex;align-items:center;gap:14px;padding:15px 17px;min-height:69px}.dta-summary input{width:20px;height:20px;accent-color:#2484ed}.dta-handle{cursor:grab;color:var(--dsw-alias-label-tertiary,#858993);font-size:22px;line-height:1}.dta-name{flex:1;font-size:17px;min-width:0;overflow-wrap:anywhere;cursor:pointer}.dta-summary-meta{display:grid;grid-template-columns:repeat(var(--dta-meta-columns,3),minmax(0,1fr));gap:12px;flex:0 0 318px;margin:0;font-size:12px;line-height:1.5}.dta-summary-meta dt{color:var(--dsw-alias-label-tertiary,#858993);font-size:11px}.dta-summary-meta dd{margin:3px 0 0;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.dta-detail{padding:4px 20px 20px;border-top:1px solid var(--dta-border)}.dta-properties>*,.dta-summary-meta>div{min-width:0}.dta-properties>*+*,.dta-summary-meta>div+div{border-left:1px solid var(--dsw-alias-state-business-primary,#4d6bfe);padding-left:14px}.dta-properties label,.dta-fields label{display:flex;flex-direction:column;gap:8px}.dta-fields{display:flex;flex-direction:column;gap:16px;margin:16px 0}.dta-fields .dta-field-name{max-width:320px}.dta-preview-depth{margin:12px 0}.dta-properties{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:16px 0}.dta-detail textarea{width:100%;min-height:130px;resize:vertical}.dtv-assembly-screen pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 ui-monospace,monospace;max-height:360px;overflow:auto}.dta-child{margin:10px 0;padding:10px 14px;border-left:3px solid #ae73cf;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base));border-radius:6px}.dtv-assembly-screen small{display:block;opacity:.7;overflow-wrap:anywhere}
.dta-row[data-dragging=true],.dta-sort-item[data-dragging=true]{height:4px;min-height:4px;margin:5px 10px;border:0;border-radius:999px;background:var(--dsw-alias-state-business-primary,#4d6bfe);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 25%,transparent)}.dta-row[data-dragging=true]>*,.dta-sort-item[data-dragging=true]>*{opacity:0}.dta-drop-placeholder{min-height:42px;border:2px dashed var(--dsw-alias-state-business-primary,#4d6bfe);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4d6bfe) 7%,transparent);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-state-business-primary,#4d6bfe);pointer-events:none}.dtv-assembly-screen .dta-handle{touch-action:none;user-select:none;background:transparent;border:0;padding:2px}.dta-origin{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px}.dta-legend{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}.dta-legend span{border-left:4px solid var(--assembly-color);padding-left:6px;font-size:12px}
.dta-resource-layout{display:flex;flex-direction:column;gap:16px;min-width:0}.dta-resource-layout h3,.dta-resource-layout p{margin:0}.dta-resource-layout>h3:not(:first-child){padding-top:8px}.dta-resource-layout>button{align-self:flex-start}.dta-resource-policy{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px 16px}.dta-resource-policy label,.dta-resource-body>label,.dta-position-menu label{display:grid;gap:8px;min-width:0}.dta-resource-blocks{display:grid;gap:12px;min-width:0}.dta-resource-blocks>.dta-row{margin:0}.dta-resource-layout .dta-summary{display:grid;grid-template-columns:24px minmax(0,1fr);gap:4px 12px;padding:16px 18px;min-height:0}.dta-resource-layout .dta-summary>.dta-handle{grid-row:1 / span 3}.dta-resource-layout .dta-summary>small{grid-column:2}.dta-resource-body{display:grid;gap:12px;padding:0 18px 18px;min-width:0}.dta-resource-body .dta-notice{margin:0;padding:10px 12px}.dta-resource-body details[open]>summary{margin-bottom:10px}.dta-resource-body .dta-child+.dta-child{margin-top:10px}.dta-resource-layout summary{cursor:pointer;overflow-wrap:anywhere}.dta-resource-body .dta-child{margin:0;padding:12px 14px}.dta-resource-body pre{margin:8px 0 0}.dta-resource-layout>.dta-notice{margin:0}.dta-resource-layout>.dta-notice>button{margin-top:12px}.dta-layout-override{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;margin-top:12px}.dta-layout-override>code{flex:0 1 auto;min-width:0;max-width:100%;overflow-wrap:anywhere}.dta-layout-override>button{flex:0 0 auto}
.dta-sort-item{min-width:0}.dta-sort-item[data-dragging=true]{overflow:hidden;pointer-events:none}.dtv-assembly-screen .dta-sort-handle{display:flex;align-items:center;justify-content:center;width:28px;min-height:32px;padding:2px;border:0;border-radius:0;background:transparent;color:var(--dsw-alias-label-secondary,#424957);cursor:grab}.dta-sort-handle .dta-grip-icon{font-size:22px;line-height:1}.dtv-assembly-screen .dta-sort-handle:not(:disabled):hover{color:var(--dsw-alias-state-business-primary,#4386dc)}.dta-sort-handle:active{cursor:grabbing}.dta-drop-placeholder{padding:10px 14px;text-align:center;overflow-wrap:anywhere;font-weight:600}.dta-sort-item[data-dragging=true]>*{pointer-events:none}
.dta-priorities{display:grid;gap:8px}.dta-priority-row{display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--dta-border);border-radius:10px}.dta-priority-row button{padding:4px 9px}.dta-priority-row[data-drop-side=before]{box-shadow:0 -3px #4386dc}.dta-priority-row[data-drop-side=after]{box-shadow:0 3px #4386dc}.dta-result-tools{display:flex;justify-content:flex-end;margin:-4px 0 14px}.dta-position-list{display:grid;gap:12px}.dta-position-row{margin:0}.dta-position-summary{display:grid;grid-template-columns:28px 20px minmax(150px,1fr) minmax(0,1.65fr);gap:12px;align-items:center;padding:14px 16px}.dta-position-summary input{width:18px;height:18px;margin:0}.dta-position-name{min-width:0;overflow-wrap:anywhere}.dta-position-name strong{font-size:17px}.dta-position-meta{min-width:0}.dta-resource-layout .dta-position-note{margin-top:8px}.dta-position-meta .dta-position-actions{margin-top:10px}.dta-preview-meta{flex:0 1 65%;min-width:0}.dta-position-actions{display:flex;gap:8px;flex-wrap:wrap}.dta-position-actions button{padding:5px 10px}.dta-source-settings{margin-top:24px}.dta-position-decisions{margin:16px 0;padding:14px 16px;border:1px solid var(--dta-border);border-radius:10px}.dta-position-decisions li{margin:7px 0}.dta-position-row[data-drop-side=before]{box-shadow:0 -3px #4386dc}.dta-position-row[data-drop-side=after]{box-shadow:0 3px #4386dc}.dta-position-row[data-resource-dragging=true]{opacity:.55}.dta-resource-origins{grid-column:2;display:flex;flex-wrap:wrap;gap:6px 12px;margin:4px 0;font-size:12px;color:var(--dsw-alias-label-secondary)}.dta-resource-origin{border-left:3px solid var(--assembly-color);padding-left:7px;overflow-wrap:anywhere}.dta-position-menu>p{margin-bottom:12px}.dta-resource-blocks>.dta-row[data-drop-side=before]{box-shadow:0 -3px #4386dc}.dta-resource-blocks>.dta-row[data-drop-side=after]{box-shadow:0 3px #4386dc}.dta-resource-blocks>.dta-row[data-resource-dragging=true]{opacity:.55}.dta-resource-layout .dta-handle:active{cursor:grabbing}
@container(max-width:600px){.dta-resource-layout .dta-summary{padding:12px;gap:4px 8px}.dta-resource-body{padding:0 12px 12px}.dta-resource-policy{grid-template-columns:1fr}}

@container(max-width:600px){.dta-summary{flex-wrap:wrap}.dta-summary-meta{display:grid;flex:1 1 100%;grid-template-columns:repeat(2,minmax(0,1fr));row-gap:14px}.dta-summary-meta>div:nth-child(odd){border-left:0;padding-left:0}.dta-position-summary{grid-template-columns:28px 20px minmax(0,1fr)}.dta-position-meta{grid-column:1/-1}.dta-grid,.dta-properties{grid-template-columns:1fr}.dta-properties>*+*{border-left:0;border-top:1px solid var(--dsw-alias-state-business-primary,#4d6bfe);padding:12px 0 0}.dta-head,.dta-body{padding:15px}.dta-summary{gap:8px;padding:12px 10px}.dta-fields .dta-field-name{max-width:100%}}
@media(max-width:700px){.dtv-assembly-screen{border-radius:12px}.dta-head,.dta-body{padding:15px}.dta-head{padding-right:64px}.dta-grid,.dta-properties{grid-template-columns:1fr}.dta-summary{gap:8px;padding:12px 10px}.dta-name{font-size:15px}.dta-summary{flex-wrap:wrap}.dta-summary-meta{display:grid;flex:1 1 100%;grid-template-columns:repeat(2,minmax(0,1fr));row-gap:14px}.dta-summary-meta>div:nth-child(odd){border-left:0;padding-left:0}.dta-position-summary{grid-template-columns:28px 20px minmax(0,1fr)}.dta-position-meta{grid-column:1/-1}.dta-properties>*+*{border-left:0;border-top:1px solid var(--dsw-alias-state-business-primary,#4d6bfe);padding:12px 0 0}}
`
export function AssemblyPanel(props) {
  // A session change disposes all pending editor state, including async closures.
  return h(AssemblyPanelContent, { ...props, key: props.selectionTarget?.id ?? props.sessionId ?? 'no-session' })
}
function AssemblyPanelContent({ selectionTarget, sessionId, sessionLabel, onCreateSession, createSessionControls, interfaceControls, standalone = false, close, registerBeforeLeave, chromeMode, locale: selectedLocale = 'zh-CN', fetcher = globalThis.fetch, apiRoot = '/dsh-prompt-assembler/api/v1/assembly-presets', traceRoot, historyApiRoot, historyFragmentPresets, refreshEvent = 'dsh-prompt-assembler:refresh' }) {
  const locale = selectedLocale === 'zh-CN' ? 0 : 1, t = key => labels[key]?.[locale] ?? key
  const [confirmation, setConfirmation] = useState(null)
  const confirmationResolve = useRef(null)
  const confirm = message => new Promise(resolve => { confirmationResolve.current?.(false); confirmationResolve.current = resolve; setConfirmation(message) })
  const answerConfirmation = answer => { const resolve = confirmationResolve.current; confirmationResolve.current = null; setConfirmation(null); resolve?.(answer) }
  useEffect(() => () => confirmationResolve.current?.(false), [])
  useEffect(() => { if (confirmation) dialog.current?.querySelector('.dta-confirm button')?.focus() }, [confirmation])
  const [sources, setSources] = useState([]), [addParser, setAddParser] = useState('custom'), [addKind, setAddKind] = useState(''), [defaultId, setDefaultId] = useState(BUILTINS[0].id)
  const [items, setItems] = useState([]), [draft, setDraft] = useState(null), [selection, setSelection] = useState(null), [capable, setCapable] = useState(false), [capabilities, setCapabilities] = useState(null)
  const [status, setStatus] = useState(''), [error, setError] = useState(false), [busy, setBusy] = useState(false), [tab, setTab] = useState('rules'), [preview, setPreview] = useState(null), [dirty, setDirty] = useState(false), [expanded, setExpanded] = useState({})
  const [historyDirty, setHistoryDirty] = useState(false)
  const [validationFailure, setValidationFailure] = useState(null)
  const appliedBackend = selection?.backend ?? 'native'
  const file = useRef(), stage = useRef(), dialog = useRef(), generation = useRef(0), mounted = useRef(true)
  // Dim only the conversation body; shell navigation and side editors stay interactive.
  useLayoutEffect(() => {
    if (standalone) return
    const panel = dialog.current
    let frame = panel?.parentElement
    while (frame && getComputedStyle(frame).display !== 'grid') frame = frame.parentElement
    if (!frame) return
    const measure = () => {
      const columns = getComputedStyle(frame).gridTemplateColumns.split(' ').map(parseFloat)
      if (columns.length !== 3 || columns.some(n => !Number.isFinite(n))) return
      stage.current.style.setProperty('--dta-content-left', `${columns[0]}px`)
      const header = [...frame.querySelectorAll('header')].find(el => !panel.contains(el) && el.querySelector('[role=tablist]'))
      const top = header ? header.getBoundingClientRect().bottom - frame.getBoundingClientRect().top : 76
      stage.current.style.setProperty('--dta-content-top', `${top}px`)
      stage.current.style.setProperty('--dta-center-width', `${columns[1]}px`)
      const composer = frame.querySelector('[data-composer-input]')
      const composerWidth = composer && getComputedStyle(composer).getPropertyValue('--dsh-composer-card-max-width').trim()
      if (composerWidth) stage.current.style.setProperty('--dsh-composer-card-max-width', composerWidth)
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(frame)
    for (const child of frame.children) resize.observe(child)
    for (const header of frame.querySelectorAll('header')) if (!panel.contains(header)) resize.observe(header)
    const changes = new MutationObserver(measure)
    changes.observe(frame, { attributes: true, attributeFilter: ['style', 'data-sidebar-collapsed', 'data-rightbar-collapsed'] })
    return () => { resize.disconnect(); changes.disconnect() }
  }, [])
  const [slotAnalysis, setSlotAnalysis] = useState(null)
  const [reload, setReload] = useState(0)
  const api = async (...args) => { const result = selectionTarget && args[0] === '/preview' ? await selectionTarget.previewAssembly(args[2].preset) : selectionTarget && args[0] === '/selection' ? await selectionTarget.applyAssembly(args[2].id) : await request(fetcher, apiRoot, ...args); if (selectionTarget && String(args[0]).startsWith('?')) result.selection = await selectionTarget.getSelection(); if (!mounted.current) throw new DOMException('Panel closed', 'AbortError'); return result }
  const run = async fn => { setBusy(true); setError(false); try { await fn() } catch (e) { if (mounted.current) { setError(true); setStatus(e.message) } } finally { if (mounted.current) setBusy(false) } }
  useEffect(() => { mounted.current = true; const gen = ++generation.current; run(async () => { const data = await api(`?sessionId=${encodeURIComponent(sessionId ?? '')}`); if (gen !== generation.current || !mounted.current) return; setItems(data.presets); setSelection(data.selection); setCapable(data.capability); setCapabilities(data.capabilities ?? null); setSources(data.sources ?? []); setDefaultId(data.defaultPresetId ?? data.presets[0]?.id); setAddParser(data.sources?.some(s => s.id === 'tavern.text') ? 'tavern.text' : data.sources?.find(s => s.acceptsText && !s.textParserAliasFor)?.id ?? ''); setAddKind(data.sources?.find(s => s.supportsModule !== false && s.moduleAvailable !== false && !data.presets[0]?.rules.some(r => r.kind === s.id))?.id ?? ''); setDraft(data.presets.find(p => p.id === data.selection?.id) ?? data.presets[0]); setPreview(null); setDirty(false); setStatus('') }); return () => { mounted.current = false; generation.current++ } }, [sessionId, selectionTarget, reload])
  useEffect(() => { const refresh = () => run(async () => { const gen = generation.current; const data = await api(`?sessionId=${encodeURIComponent(sessionId ?? '')}`); if (gen !== generation.current || !mounted.current) return; setItems(data.presets); setSelection(data.selection); setCapable(data.capability); setCapabilities(data.capabilities ?? null); setSources(data.sources ?? []) }); window.addEventListener(refreshEvent, refresh); return () => window.removeEventListener(refreshEvent, refresh) }, [sessionId, selectionTarget, chromeMode, refreshEvent])
  useEffect(() => { let active = true; api(`?sessionId=${encodeURIComponent(sessionId ?? '')}`).then(data => { if (active) setSelection(data.selection) }).catch(() => {}); return () => { active = false } }, [chromeMode, sessionId, selectionTarget])
  const discard = () => !busy && (!dirty || confirm(t('discard')))
  const leave = () => !busy && (!(dirty || historyDirty) || confirm(t('discard')))
  const changeHistoryBackend = backend => backend === appliedBackend || !historyDirty || confirm(t('discard'))
  useEffect(() => registerBeforeLeave?.(leave), [dirty, historyDirty, busy, registerBeforeLeave])
  const edit = patch => { if (busy) return; setDraft(d => ({ ...d, ...patch })); setDirty(true); setPreview(null) }
  const editableRule = rule => { const source = sources.find(s => s.id === rule.kind); const parser = sources.find(s => s.id === source?.textParserAliasFor && s.acceptsText); return parser && (rule.inputMode === 'text' || rule.kind === 'custom') ? { ...rule, kind: parser.id, inputMode: 'text', role: parser.roles.includes(rule.role) ? rule.role : parser.roles[0], lifetime: parser.lifetimes.includes(rule.lifetime) ? rule.lifetime : parser.lifetimes[0], depth: parser.depth === false ? null : rule.depth } : rule }
  const editablePreset = preset => ({ ...preset, rules: preset.rules.map(editableRule) })
  const editLayout = next => edit({ rules: next.rules, layout: next.layout, placement: layoutPlacement(next) })
  async function validateCurrent(candidate = draft) {
    try {
      const data = await api('/preview', 'POST', { sessionId, preset: editablePreset(candidate) })
      if (!data.preview) throw new Error(locale === 0 ? '未返回装配校验结果' : 'Assembly validation result is unavailable')
      setValidationFailure(null)
      return data.preview
    } catch (error) {
      setValidationFailure({ id: candidate.id, candidate, message: error.message })
      throw error
    }
  }
  const controlRows = rules => contextControlRows(rules, sources.map(s => s.id))
  const editRule = (id, patch) => edit({ rules: controlRows(draft.rules).map(r => r.id === id ? { ...editableRule(r), ...patch } : r) })
  const toggle = id => setExpanded(old => ({ ...old, [id]: !old[id] }))
  async function save(asCopy = false) {
    const creates = asCopy || draft.builtin || !draft.id
    const data = await api(creates ? '' : `/${encodeURIComponent(draft.id)}`, creates ? 'POST' : 'PUT', editablePreset(draft))
    setDraft(data.preset); setItems(list => [...list.filter(p => p.id !== data.preset.id), data.preset]); setDirty(false); setStatus(t('saved')); window.dispatchEvent(new window.Event(refreshEvent)); return data.preset
  }
  function download() { const blob = new Blob([JSON.stringify({ ...editablePreset(draft), id: undefined, builtin: undefined }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${draft.name.replace(/[\\/:*?"<>|]/g, '_')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 0) }
  const button = (label, onClick, disabled = false, cls, pressed) => h('button', { type: 'button', onClick, disabled: busy || disabled, className: cls, 'aria-pressed': pressed }, t(label))
  const select = (value, values, onChange, disabled = false) => h('select', { value, disabled: busy || disabled, onChange: e => onChange(e.target.value) }, ...values.map(v => h('option', { key: v, value: v }, t(v))))
  const nodeName = node => {
    if (node.positionId && node.source?.module === 'worldbook' && node.name?.startsWith('worldbook:')) {
      const position = sources.find(s => s.id === 'worldbook')?.positions?.find(p => p.id === node.positionId)
      if (position) return `${position.name[locale]} · ${(preview?.nodes?.filter(n => n.source?.module === 'worldbook' && n.positionId === node.positionId).indexOf(node) ?? 0) + 1}`
    }
    if (labels[node.name]) return t(node.name)
    const standard = { 'Main Prompt': 'main', 'Post-History Instructions': 'jailbreak', 'Character Description': 'charDescription', 'Character Personality': 'charPersonality', 'Persona Description': 'personaDescription', 'Chat History': 'history', 'World Info (before)': 'worldbook', 'World Info (after)': 'worldbook' }
    if (standard[node.name]) return t(standard[node.name])
    if (node.sourceStatus === 'name-unrecorded' && node.source?.field && !labels[node.source.field]) return `${t(node.module)} · ${Math.max(0, preview?.nodes?.filter(n => n.module === node.module).indexOf(node) ?? -1) + 1}`
    if (node.name?.startsWith('preset:') || node.name?.startsWith('worldbook:')) return labels[node.source?.field] ? t(node.source.field) : `${t(node.name.startsWith('preset:') ? 'preset' : 'worldbook')} · ${Math.max(0, preview?.nodes?.indexOf(node) ?? -1) + 1}`
    return node.name
  }
  const positionReason = decision => ({ user: locale === 0 ? '自定义位置' : 'Custom position', preset: locale === 0 ? '预设插槽' : 'Preset slot', runtime: locale === 0 ? '运行时约束' : 'Runtime constraint', 'resource-depth': locale === 0 ? '资源深度' : 'Resource depth', resource: locale === 0 ? '资源自带位置' : 'Resource position', default: locale === 0 ? '来源默认顺序' : 'Default source order', source: locale === 0 ? '资源默认位置' : 'Source position' })[decision]
  const originName = plugin => plugin === 'DSH' ? 'DSH' : plugin === 'pmp-dsh-tavern' || plugin?.startsWith('pmp-dsh-tavern/') ? 'DSH Tavern' : plugin ?? (locale === 0 ? '来源未知' : 'Unknown source')
  const sourceDescriptor = kind => sources.find(s => s.id === kind)
  const sourcePlugin = kind => sourceDescriptor(kind)?.pluginId ?? null
  const sourceName = kind => labels[kind] ? t(kind) : sourceDescriptor(kind)?.name ?? kind
  const modules = sources.filter(s => !isContextControl(s.id) && s.supportsModule !== false && s.moduleAvailable !== false && (s.multiple || !draft?.rules.some(r => r.kind === s.id && r.inputMode !== 'text')))
  const parsers = sources.filter(s => s.acceptsText && !sources.some(target => target.id === s.textParserAliasFor && target.acceptsText))
  const addRule = (kind, inputMode) => {
    const source = sourceDescriptor(kind); if (!source) return
    const id = `source-${crypto.randomUUID()}`
    const role = draft.backend === 'native' ? (inputMode === 'text' && source.roles.includes('user') ? 'user' : source.roles.includes('system') ? 'system' : source.roles[0]) : inputMode === 'text' && source.roles.includes('user') ? 'user' : source.roles[0]
    const added = { id, kind, ...(inputMode ? { inputMode } : {}), ...(draft.backend === 'native' && role === 'user' ? { delivery: 'context' } : {}), enabled: true, role, lifetime: draft.backend === 'native' ? 'request' : source.lifetimes[0], depth: null, text: '', name: '' }
    const rules = [...draft.rules]
    const index = draft.backend !== 'native' ? -1 : role !== 'user' ? rules.findIndex(r => r.kind === 'history') : rules.findIndex((r, i) => i > rules.findIndex(x => x.kind === 'input') && r.role === 'user' && r.delivery === 'pre-step')
    rules.splice(index < 0 ? rules.length : index, 0, added)
    edit({ rules })
    setExpanded(old => ({ ...old, [id]: true }))
  }
  const sourceInfo = kind => sourceDescriptor(kind)?.generationRequiresPlugin === false ? t('nativeSource') : t('removed')
  async function actualRequest() {
    const show = record => {
      if (!record?.messages) return false
      setPreview(actualAssemblyResult(record)); setTab('expanded'); setStatus(''); return true
    }
    if (!traceRoot) {
      const data = await api(`/actual?sessionId=${encodeURIComponent(sessionId)}`)
      if (!show(data.request)) setStatus(t(data.backend === 'native' ? 'noActualNative' : 'noActual'))
      return
    }
    const response = await fetcher(`${traceRoot}/sessions/${encodeURIComponent(sessionId)}/assemblies`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const list = await response.json()
    for (const item of [...(list.records ?? [])].reverse().slice(0, 20)) {
      const res = await fetcher(`${traceRoot}/sessions/${encodeURIComponent(sessionId)}/assemblies/${encodeURIComponent(item.id)}`)
      if (!res.ok) continue
      const detail = (await res.json()).record
      const raw = detail?.requestAssembly ?? detail?.nativeRequest
      const record = raw && detail.nativeProvenance ? { ...raw, metadata: { ...raw.metadata, assembly: raw.metadata?.assembly ?? detail.nativeProvenance } } : raw
      if (!mounted.current) return
      if (show(record)) return
    }
    setStatus(t(draft?.backend === 'native' ? 'noActualNative' : 'noActual'))
  }
  const safeClose = async () => { if (registerBeforeLeave || await leave()) close() }
  useEffect(() => {
    const previous = document.activeElement
    dialog.current?.querySelector('button')?.focus()
    return () => { previous?.focus?.() }
  }, [])
  useEffect(() => { const warn = e => { if (dirty || historyDirty) { e.preventDefault(); e.returnValue = '' } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty, historyDirty])
  useEffect(() => { if (registerBeforeLeave) return; const handler = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); safeClose() } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler) }, [dirty, historyDirty, busy, registerBeforeLeave])
  const nativeDraft = draft?.backend === 'native'
  const adaptiveNative = nativeDraft && ['native-roles', 'native-slots'].includes(draft.placement)
  const slotMode = nativeDraft && draft.placement === 'native-slots'
  useEffect(() => {
    if ((!slotMode && !draft?.layout) || !sessionId && !selectionTarget) { setSlotAnalysis(null); return }
    let active = true
    setSlotAnalysis(null)
    api('/preview', 'POST', { sessionId, preset: editablePreset(draft) }).then(data => {
      if (active) setSlotAnalysis({ draft, preview: data.preview })
    }).catch(error => { if (active) setSlotAnalysis({ draft, error: error.message }) })
    return () => { active = false }
  }, [draft, sessionId, selectionTarget, sources, reload])
  const analysis = slotAnalysis?.draft === draft ? slotAnalysis : null
  const controlFor = rule => analysis?.preview?.placementControls?.find(c => c.ruleId === rule.id)?.control
  const controlLabel = control => ({ preset: 'controlPreset', mixed: 'controlMixed', independent: 'controlIndependent', native: 'controlNative', empty: 'controlEmpty' })[control]

  let nativeError = null
  if (nativeDraft) { try { validateNativePreset(draft) } catch (error) { nativeError = error.message } }
  const draftAvailable = capabilities ? (nativeDraft ? capabilities.native && !nativeError : capabilities.core) : capable
  const displayRows = tab === 'rules' ? draft ? controlRows(draft.rules) : [] : preview?.nodes ?? []
  const ruleStability = rule => sourceDescriptor(rule.kind)?.stability ?? 'conversation'
  const summaryMetadata = (stability, lifetime, role, history) => h(SummaryMetadata, { className: history ? 'dta-preview-meta' : '', items: [
    ...[['stability', stability], ['lifetime', lifetime], ['role', role]].map(([label, value]) => ({ label: t(label), content: t(label === 'stability' && value === 'snapshot' ? 'retained' : value) })),
    ...(history ? [{ label: locale === 0 ? '原生历史' : 'Native history', content: history, className: 'dta-history-note' }] : []),
  ] })
  function ruleRow(rule, index) {
    rule = editableRule(rule)
    if (isContextControl(rule.kind)) return h('article', { key: rule.id, className: 'dta-row', 'data-context-control': rule.kind, style: { '--assembly-color': sourceColor('DSH') } },
      h('div', { className: 'dta-summary' }, h('span', { 'aria-hidden': true }, '🔒'), h('input', { type: 'checkbox', checked: rule.enabled, disabled: busy, 'aria-label': sourceName(rule.kind), onChange: e => editRule(rule.id, { enabled: e.target.checked }) }),
        h('span', { className: 'dta-name' }, sourceName(rule.kind), h('small', { className: 'dta-origin' }, t('contextControlled')))),
      h('div', { className: 'dta-detail' }, h('small', null, t(rule.kind === 'dsh.runtime-context' ? 'contextMasterHint' : 'contextControlHint'))))
    const roleLabel = draft.layout?.identity === 'preserve' && rule.inputMode !== 'text' && !['custom', 'dsh.text', 'native-system', 'history', 'input'].includes(rule.kind) ? 'sourceIdentity' : adaptiveNative && rule.kind === 'worldbook' && !slotMode ? 'nativeWorldRole' : slotMode && controlFor(rule) === 'preset' ? 'nativeSlotRole' : adaptiveNative && rule.kind === 'preset' ? 'nativePresetRole' : null
    const textInput = rule.inputMode === 'text' || ['custom', 'dsh.text'].includes(rule.kind)
    return h('article', { key: rule.id, className: 'dta-row', 'data-assembly-index': index, style: { '--assembly-color': sourceColor(sourcePlugin(rule.kind)) } },
        h('div', { className: 'dta-summary' }, h('span', { title: locale === 0 ? '来源配置；在当前资源布局中移动连续块' : 'Source configuration; move contiguous blocks in the current layout' }, '◈'),
        h('input', { type: 'checkbox', checked: rule.enabled, disabled: busy || nativeDraft && ['history', 'input'].includes(rule.kind), 'aria-label': sourceName(rule.kind), onChange: e => editRule(rule.id, { enabled: e.target.checked }) }),
        h('span', { className: 'dta-name', role: 'button', tabIndex: 0, 'aria-expanded': !!expanded[rule.id], onClick: () => toggle(rule.id), onKeyDown: e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); toggle(rule.id) } } }, rule.name || sourceName(rule.kind), h('small', { className: 'dta-origin' }, originName(sourcePlugin(rule.kind))), slotMode && !draft.layout && h('small', { 'data-placement-control': controlFor(rule) ?? 'pending' }, t(controlLabel(controlFor(rule)) ?? 'placementPending'))), summaryMetadata(ruleStability(rule), ['native-system', 'history', 'input'].includes(rule.kind) ? 'nativeRetention' : nativeDraft && rule.role === 'user' ? rule.delivery ?? 'context' : rule.lifetime, roleLabel ?? rule.role)),
      expanded[rule.id] && h('div', { className: 'dta-detail' },
        h('div', { className: 'dta-properties' }, h('div', null, t('source'), h('small', null, originName(sourcePlugin(rule.kind))), h('small', null, sourceInfo(rule.kind))), h('div', null, t('stability'), h('small', null, t(ruleStability(rule)))), h('label', null, t('lifetime'), ['native-system', 'history', 'input'].includes(rule.kind) ? h('small', null, t('nativeRetention')) : nativeDraft && rule.role === 'user' ? h('small', null, t(rule.delivery ?? 'context')) : select(rule.lifetime, nativeDraft ? ['request'] : sourceDescriptor(rule.kind)?.lifetimes ?? ['request', 'snapshot'], v => editRule(rule.id, { lifetime: v }), sourceDescriptor(rule.kind)?.lifetimes.length === 1))),
        nativeDraft && (rule.role === 'user' || adaptiveNative && ['preset', 'worldbook'].includes(rule.kind)) && h('label', null, t('delivery'), select(rule.delivery ?? 'context', ['context', 'pre-step'], delivery => editRule(rule.id, { delivery }))),
        h('div', { className: 'dta-grid' }, h('label', null, t('role'), roleLabel ? h('small', null, t(roleLabel)) : select(rule.role, (sourceDescriptor(rule.kind)?.roles ?? ['preserve', 'system', 'user', 'assistant']).filter(role => !nativeDraft || role !== 'assistant'), v => editRule(rule.id, { role: v }), sourceDescriptor(rule.kind)?.roles.length === 1)), sourceDescriptor(rule.kind)?.depth !== false && h('label', null, t('depth'), h('input', { type: 'number', min: 0, max: 10000, value: rule.depth ?? '', disabled: busy || nativeDraft, onChange: e => editRule(rule.id, { depth: e.target.value === '' ? null : Number(e.target.value) }) }))),
        textInput ? h('div', { className: 'dta-fields' },
          h('label', null, t('parser'), h('select', { value: rule.kind, onChange: e => { const source = sourceDescriptor(e.target.value); editRule(rule.id, { kind: source.id, inputMode: 'text', role: source.roles.includes(rule.role) ? rule.role : source.roles[0], lifetime: source.lifetimes.includes(rule.lifetime) ? rule.lifetime : source.lifetimes[0], depth: source.depth === false ? null : rule.depth }) } }, ...parsers.map(s => h('option', { key: s.id, value: s.id }, `${originName(s.pluginId)} · ${sourceName(s.id)}`)))),
          ['tavern.text', 'dsh.text'].includes(rule.kind) && h('p', null, t(rule.kind === 'tavern.text' ? 'tavernParserHelp' : 'dshParserHelp')),
          h('label', null, t('name'), h('input', { value: rule.name ?? '', onChange: e => editRule(rule.id, { name: e.target.value }) })),
          h('label', null, t('text'), h('textarea', { value: rule.text, onChange: e => editRule(rule.id, { text: e.target.value }) })), button('remove', () => edit({ rules: draft.rules.filter(r => r.id !== rule.id) })))
          : h('div', { className: 'dta-fields' }, moduleGuide(rule.kind), rule.kind === 'phi' ? h('label', null, t('additional-phi'), h('textarea', { value: rule.text, onChange: e => editRule(rule.id, { text: e.target.value }) })) : !['native-system', 'history', 'input', 'preset', 'character', 'persona', 'worldbook'].includes(rule.kind) && button('remove', () => edit({ rules: draft.rules.filter(r => r.id !== rule.id) }))), !sourceDescriptor(rule.kind) && h('small', { role: 'status' }, t('missingSource')), h('small', null, t(nativeDraft ? 'nativeRetentionHint' : 'audit'))))
  }
  function moduleGuide(kind) {
    const guide = sourceDescriptor(kind)?.contentGuide
    return h('div', { className: 'dta-module-guide' }, ...[['contains', 'contains', 'unknownContains'], ['origin', 'contentOrigin', 'unknownOrigin'], ['editable', 'editable', 'unknownEditable'], ['editAt', 'editAt', 'unknownEditAt']].map(([key, label, fallback]) => h('p', { key }, h('strong', null, t(label) + '：'), guide?.[key]?.[locale] ?? t(fallback))), h('small', null, t('modulePreviewHelp')))
  }
  function historyNote(node) {
    const zh = locale === 0, kind = node.source?.module
    if (kind === 'history') return zh ? '已有 · 读取已保存消息' : 'Existing · Saved messages'
    if (kind === 'input') return zh ? '会进入 · DSH 保存本步输入' : 'Yes · DSH saves current input'
    if (preview?.backend === 'native') {
      if (node.role === 'system' || kind === 'native-system') return zh ? '会进入 · 系统指令更新' : 'Yes · System instruction updates'
      if (node.role === 'user') return node.nativeDelivery === 'pre-step'
        ? zh ? '会进入 · 每步保存注入消息' : 'Yes · Injection saved each step'
        : zh ? '会进入 · 上下文变化时保存，未变化时复用' : 'Yes · Save changed context; reuse unchanged context'
    }
    if (node.lifetime === 'native') return zh ? '已有 · DSH 保存与提供' : 'Existing · Saved by DSH'
    if (preview?.backend === 'core') return ['snapshot', 'retained'].includes(node.lifetime)
      ? zh ? '不进入 · 装配快照单独留存' : 'No · Assembly snapshots retained separately'
      : zh ? '不进入 · 仅本次请求，可记录轨迹' : 'No · Request only; trace may record it'
    return zh ? '记录不足，无法判断' : 'Unknown · Insufficient record'
  }
  function nodeRow(node, index) {
    const retention = node.nativeDelivery ?? (node.lifetime === 'native' ? 'nativeRetention' : node.lifetime)
    return h('article', { key: node.id, className: 'dta-row', style: { '--assembly-color': sourceColor(node.source.plugin) } },
      h('div', { className: 'dta-summary' }, h('span', { className: 'dta-name', role: 'button', tabIndex: 0, onClick: () => toggle(node.id), onKeyDown: e => { if (e.key === 'Enter') toggle(node.id) }, 'aria-expanded': !!expanded[node.id], title: nodeName(node) }, nodeName(node), node.sourceStatus === 'name-unrecorded' && h('small', null, t('sourceNameUnrecorded')), node.sourceStatus === 'historical-system' && h('small', null, t('historicalSystemHint')), node.sourceStatus === 'current-name' && h('small', null, t('sourceNameCurrent')), node.sourceStatus === 'section-only' && h('small', null, t('sourceFieldsUnrecorded')), h('small', { className: 'dta-origin' }, `${originName(node.source.plugin)} · ${sourceName(node.source.module)} · ${positionReason(node.positionDecision) ?? (node.depth == null ? t('listPosition') : t('previewDepth') + ': ' + node.depth)}`)), summaryMetadata(node.stability, retention, node.role, historyNote(node))),
      expanded[node.id] && h('div', { className: 'dta-detail' }, h('div', { className: 'dta-properties' }, h('div', null, t('source'), h('small', null, `${node.source.plugin} / ${node.source.resourceId ?? ''} / ${node.source.field}`), h('small', null, sourceInfo(node.module))), h('div', null, t('stability'), h('small', null, t(node.stability))), h('div', null, t('lifetime'), h('small', null, t(retention)), h('small', null, t(preview?.backend === 'native' ? 'nativeRetentionHint' : 'recorded')))), h('div', { className: 'dta-preview-depth' }, `${t('previewDepth')}: ${node.depth == null ? t('listPosition') : node.depth}`), node.locked && h('small', null, `${t('locked')}: ${node.lockReason}`), ...(node.children ?? []).map(child => h('div', { key: child.id, className: 'dta-child', style: { borderLeftColor: sourceColor(child.source?.plugin) } }, `🔒 ${nodeName(child)}`, h('small', null, child.lockReason), h('small', null, [originName(child.source?.plugin), child.source?.resourceId, child.source?.field, child.source?.sourceKind].filter(Boolean).join(' / ')), h('pre', null, child.text))), h('pre', null, node.text)))
  }
  return h('div', { ref: stage, className: `dta-stage${standalone ? ' dta-standalone' : ''}` }, h('section', { ref: dialog, className: 'dtv-assembly-screen', role: 'dialog', 'aria-modal': standalone, 'aria-label': t('title') }, h('style', null, assemblyCss, historyPanelCss),
    confirmation && h('div', { className: 'dta-confirm-shade' }, h('div', { className: 'dta-confirm', role: 'alertdialog', 'aria-modal': true, 'aria-label': confirmation, onKeyDown: e => { if (e.key === 'Escape') { e.stopPropagation(); answerConfirmation(false) } else if (e.key === 'Tab') { e.preventDefault(); const buttons = [...e.currentTarget.querySelectorAll('button')]; const at = buttons.indexOf(document.activeElement); buttons[(at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus() } } }, h('p', null, confirmation), h('div', { className: 'dta-toolbar' }, h('button', { type: 'button', onClick: () => answerConfirmation(false) }, t('cancel')), h('button', { type: 'button', className: 'primary', onClick: () => answerConfirmation(true) }, t('confirm'))))),
    h('header', { className: 'dta-head' }, h('div', null, h('h2', null, t('title')), h('p', null, t('intro')), sessionLabel !== undefined && h('p', { 'data-assembly-session': sessionId ?? '' }, `${t('session')}: ${sessionLabel || t('newSession')}`)), h('button', { onClick: safeClose, 'aria-label': t('close') }, '×')),
    h('div', { className: 'dta-body' }, h('fieldset', { className: 'dta-content', disabled: busy, style: { border: 0, padding: 0, minWidth: 0 } },
      h('h3', { className: 'dta-section-title' }, t('librarySection')),
      h('div', { className: 'dta-toolbar' }, h('input', { type: 'file', accept: '.json,application/json', hidden: true, ref: file, onChange: e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(async () => { if (f.size > 2 * 1024 * 1024) throw new Error('2 MiB limit'); if (!await discard()) return; const data = await api('', 'POST', JSON.parse(await f.text())); setDraft(data.preset); setItems(i => [...i, data.preset]); setDirty(false); setPreview(null) }) } }), button('import', () => file.current.click()), button('export', download, !draft), button('create', async () => { if (await discard()) { setDraft({ ...structuredClone(items.find(p => p.id === defaultId) ?? items[0] ?? BUILTINS[0]), builtin: false, id: undefined, name: t('title') }); setDirty(true); setPreview(null) } })),
      status && (error ? h(AssemblyError, { message: status, locale }) : h('div', { role: 'status', className: 'dta-notice' }, status)),
      validationFailure && validationFailure.id === draft?.id && h(AssemblyError, { locale, 'data-assembly-validation-error': true,
        context: validationFailure.candidate === draft ? (locale === 0 ? '当前资源装配校验失败。' : 'Current-resource validation failed.') : (locale === 0 ? '配置已修改或保存，尚未通过重新校验。' : 'Configuration changed or saved; revalidation is required.'), message: validationFailure.message }),
      !draft ? h('div', null, !error && h('p', null, t('loading')), error && button('retry', () => setReload(n => n + 1))) : h('div', null,
        h('div', { className: 'dta-grid' }, h('label', null, t('select'), h('select', { value: draft.id ?? '', disabled: busy, onChange: async e => { const id = e.target.value; if (await discard()) { setDraft(items.find(p => p.id === id)); setDirty(false); setPreview(null); setStatus(''); setError(false) } } }, !draft.id && h('option', { value: '' }, draft.name), ...items.map(p => h('option', { key: p.id, value: p.id }, p.name)))), h('label', null, t('name'), h('input', { value: draft.name, disabled: draft.builtin, onChange: e => edit({ name: e.target.value }) }))),
        h('div', { className: 'dta-toolbar' }, button('save', () => run(() => save())), button('copy', () => run(() => save(true))), button('remove', () => run(async () => { if (!await confirm(t('confirmDelete'))) return; await api(`/${draft.id}`, 'DELETE'); setItems(i => i.filter(p => p.id !== draft.id)); setDraft(items[0]); setDirty(false); setPreview(null) }), !draft.id || draft.builtin), dirty && h('span', null, t('dirty'))),
        h('h3', { className: 'dta-section-title' }, t('rulesSection')),
        h('p', { className: 'dta-notice', 'data-assembly-placement-tip': true }, t('placementTip')),
        h('label', { className: 'dta-toolbar' }, t('backend'), h('select', { 'aria-label': t('backend'), value: draft.backend ?? 'core', onChange: e => edit({ backend: e.target.value }) }, h('option', { value: 'native' }, t('backendNative')), h('option', { value: 'core' }, t('backendCore')))),
        h('div', { className: 'dta-notice' }, draft.layout ? (locale === 0 ? '拖拽即自定义位置；其余内容按自动优先级定位。当前资源可确定的位置会同步更新，身份与运行时约束始终生效。' : 'Dragging sets a custom position; other content follows automatic priority. Definite positions update from current resources, within identity and runtime constraints.') : t(adaptiveNative ? draft.placement === 'native-slots' ? 'nativeSlotsHint' : 'nativeRolesHint' : nativeDraft ? 'nativeHint' : 'coreHint')), nativeError && h(AssemblyError, { message: nativeError, locale }),
        h('div', { className: 'dta-tabs' }, h('button', { 'aria-pressed': tab === 'rules', onClick: () => setTab('rules') }, t('rules')), button('preview', () => run(async () => { const result = await validateCurrent(); setPreview(result); if (slotMode) setSlotAnalysis({ draft, preview: result }); setTab('expanded') }), Boolean(selectionTarget && (typeof selectionTarget.previewAssembly !== 'function' || selectionTarget.editable === false)), undefined, tab === 'expanded' && !preview?.actual)), h('div', { className: 'dta-result-tools' }, button('actual', () => run(actualRequest), !sessionId)),
        h('div', { className: 'dta-legend' }, ...[...new Set(sources.map(s => s.pluginId))].map(plugin => h('span', { key: plugin, style: { '--assembly-color': sourceColor(plugin) } }, originName(plugin)))),
        tab === 'rules' ? h('div', null, h(ResourcePositionEditor, { preset: draft, sources, preview: analysis?.preview, resolving: !!draft.layout && !!(sessionId || selectionTarget) && !analysis, resolutionError: analysis?.error, locale, busy, sourceColor, originName, sourceName, onChange: editLayout }), h('details', { className: 'dta-source-settings' }, h('summary', null, locale === 0 ? '来源、文本与投递设置' : 'Source, text and delivery settings'), !draft.layout && h('label', { className: 'dta-toolbar' }, t('placement'), select(draft.placement, nativeDraft ? ['modules', 'native-roles', 'native-slots'] : ['modules', 'st'], placement => edit({ placement }))), draft.placement === 'st' && h('small', null, t('stHelp')), ...displayRows.map(ruleRow), modules.length > 0 && h('div', { className: 'dta-toolbar' }, h('label', { htmlFor: 'dta-add-source' }, t('addSource')), h('select', { id: 'dta-add-source', value: modules.some(s => s.id === addKind) ? addKind : modules[0].id, onChange: e => setAddKind(e.target.value) }, ...modules.map(s => h('option', { key: s.id, value: s.id }, `${originName(s.pluginId)} · ${sourceName(s.id)}`))), button('add', () => addRule(modules.some(s => s.id === addKind) ? addKind : modules[0].id))),
            parsers.length > 0 && h('div', { className: 'dta-toolbar' }, h('label', { htmlFor: 'dta-add-parser' }, t('parser')), h('select', { id: 'dta-add-parser', value: addParser, onChange: e => setAddParser(e.target.value) }, ...parsers.map(s => h('option', { key: s.id, value: s.id }, `${originName(s.pluginId)} · ${sourceName(s.id)}`))), button('addText', () => addRule(addParser, 'text'))), h('small', null, t('sourceHelp'))))
          : h('div', null, h('div', { className: 'dta-notice' }, t(preview?.actual ? 'actualNotice' : preview?.scope === 'opening-draft' ? 'draftPreviewScope' : preview?.backend === 'native' ? 'nativePreviewScope' : 'previewScope')), !preview ? h('p', null, t('empty')) : h('div', null, h(PositionDecisions, { preview, sources, locale, sourceName }), ...preview.diagnostics.filter(d => ['ASSEMBLY_EMPTY', 'ASSEMBLY_SYSTEM_ONLY'].includes(d.code) && !(preview.scope === 'opening-draft' && d.code === 'ASSEMBLY_SYSTEM_ONLY')).map(d => h('div', { key: d.code, className: 'dta-notice', role: 'alert' }, t(d.code === 'ASSEMBLY_EMPTY' ? 'emptyRequest' : 'systemOnly'))), preview.diagnostics.some(d => d.code === 'NATIVE_PLACEMENT_ADJUSTED') && h('div', { className: 'dta-notice' }, t('nativeOrderChanged')), ...preview.diagnostics.filter(d => ['NATIVE_ROLE_ADJUSTED', 'NATIVE_DELIVERY_ADJUSTED', 'NATIVE_SLOTS_ABSENT', 'NATIVE_DEPTH_APPROXIMATED', 'NATIVE_DEPTH_BOUNDARY', 'WORLD_BOOK_SLOT_MISSING'].includes(d.code)).map((d, i) => h('div', { key: `native-adjustment:${i}`, className: 'dta-notice' }, d.code === 'NATIVE_SLOTS_ABSENT' ? t('nativeSlotsAbsent') : d.code === 'WORLD_BOOK_SLOT_MISSING' ? `${d.name} · ${t('worldSlotMissing')}: ${d.anchor}` : d.code === 'NATIVE_DEPTH_BOUNDARY' ? `${d.name} · ${t('nativeDepthBoundary')}: ${d.depth} → ${t(d.placement)}` : d.code === 'NATIVE_DEPTH_APPROXIMATED' ? `${d.name} · ${t('nativeDepthApproximated')} (${d.depth})` : `${d.name} · ${t(d.code === 'NATIVE_ROLE_ADJUSTED' ? 'nativeRoleChanged' : 'nativeDeliveryChanged')}: ${d.from} → ${d.to}`)), ...preview.nodes.map(nodeRow), preview.runtimeContextControls?.length > 0 && h('div', { className: 'dta-notice' }, h('strong', null, t('contextPreview')), ...preview.runtimeContextControls.map(c => h('div', { key: c.name }, `${c.name} · ${t(c.enabled ? 'contextIncluded' : 'contextExcluded')}`))), h('details', null, h('summary', null, `${t(preview.backend === 'native' && !preview.actual ? 'logicalMessages' : 'result')} (${preview.messages.length})`), ...preview.messages.map((m, i) => h('div', { key: `${m.id}:${i}`, className: 'dta-child' }, `${i + 1} · ${m.role}`, h('pre', null, (m.content ?? []).map(b => b.type === 'text' ? b.text : `[${b.type}]`).join('\n'))))), preview.diagnostics.length > 0 && h('details', null, h('summary', null, t('diagnostics')), h('pre', null, JSON.stringify(preview.diagnostics, null, 2))))), h('small', { style: { marginTop: 20 } }, t('tools')),
        h('h3', { className: 'dta-section-title' }, t('applicationSection')),
        h('div', { className: 'dta-notice' }, `${t('applied')}: ${selection?.name ?? t('legacy')}`, selection?.id?.startsWith('builtin-') && !items.some(p => p.id === selection.id) && h('small', null, t('withdrawnPreset')), !capable && h('small', null, t('unavailable'))),
        onCreateSession && h('div', null, createSessionControls, h('div', { className: 'dta-toolbar' }, button('createSession', () => run(async () => { const preset = dirty || !draft.id ? await save() : draft; if (!mounted.current) return; await onCreateSession(preset.id) }), !draftAvailable, 'primary'))),
        h('div', { className: 'dta-toolbar' }, button('apply', async () => { if (!await changeHistoryBackend(draft.backend ?? 'core')) return; run(async () => { await validateCurrent(); const preset = dirty || !draft.id ? await save() : draft; const data = await api('/selection', 'PUT', { sessionId, id: preset.id }); setSelection(data.selection); setStatus(t('appliedStatus')); window.dispatchEvent(new window.Event(refreshEvent)) }) }, (!sessionId && !selectionTarget) || !draftAvailable || selectionTarget?.editable === false, 'primary'), button('reset', async () => { const nextBackend = items.find(p => p.id === defaultId)?.backend ?? 'core'; if (!await (nextBackend === appliedBackend ? discard() : leave())) return; run(async () => { await validateCurrent(items.find(p => p.id === defaultId)); const data = await api('/selection', 'PUT', { sessionId, id: defaultId }); setSelection(data.selection); setDraft(items.find(p => p.id === defaultId)); setDirty(false); setPreview(null); setTab('rules'); setStatus(t('appliedStatus')); window.dispatchEvent(new window.Event(refreshEvent)) }) }, (!sessionId && !selectionTarget) || !capable || selectionTarget?.editable === false), button('disable', async () => { if (!await changeHistoryBackend('native')) return; run(async () => { const data = await api('/selection', 'PUT', { sessionId, id: null }); setSelection(data.selection); window.dispatchEvent(new window.Event(refreshEvent)) }) }, (!sessionId && !selectionTarget) || !selection || selectionTarget?.editable === false)),
        draft.builtin && h('small', null, t('defaultHint')),
        !sessionId && h('small', null, selectionTarget ? t('deferredSelection') : t('noSession')),
        sessionId && !selectionTarget && h(HistoryPanel, { sessionId, backend: appliedBackend, fetcher, root: historyApiRoot, fragmentPresets: historyFragmentPresets, onDirtyChange: setHistoryDirty, locale }),
      ), interfaceControls && h('section', { className: 'dta-interface-settings', 'aria-label': t('interfaceSettings') }, h('h3', { className: 'dta-section-title' }, t('interfaceSettings')), interfaceControls)))))
}

function reorderAtBoundary(items, from, boundary) { const next = [...items]; const [item] = next.splice(from, 1); next.splice(boundary > from ? boundary - 1 : boundary, 0, item); return next }

/** Validate a drag against current resolved ownership, without changing mode or roles. */
export function moveSlotRule(preset, preview, from, boundary) {
  const rule = preset.rules[from]
  const control = preview?.placementControls?.find(c => c.ruleId === rule.id)?.control
  if (!['independent', 'mixed'].includes(control)) throw new Error('此模块的位置由预设控制或尚未解析。 / Module position is preset-controlled or unresolved.')
  const rules = reorderAtBoundary(preset.rules, from, boundary)
  const at = rules.indexOf(rule), history = rules.findIndex(r => r.kind === 'history'), input = rules.findIndex(r => r.kind === 'input')
  const nodes = preview.nodes.filter(n => n.ruleId === rule.id && n.source?.module !== 'preset' && n.placementSource !== 'preset' && !n.nativeDepthAnchor)
  const roles = new Set(nodes.map(n => n.source?.module === 'native-system' ? 'system' : n.role))
  if (roles.has('system') && at > history) throw new Error('独立 system 内容只能放在原生历史前；末尾提醒请明确选择 user 和 pre-step。 / Independent system content must precede history; choose user and pre-step for a final reminder.')
  if (roles.has('user') && at < history) throw new Error('独立 user 内容只能放在原生历史后。 / Independent user content must follow history.')
  if (roles.has('user') && rule.delivery !== 'pre-step' && at < input) throw new Error('context 只能位于本步输入后；输入前请选择 pre-step。 / Context follows input; select pre-step to place before input.')
  return rules
}
