# Changelog / 变更记录

## 1.0.0

- 首个稳定版本：独立提示词装配插件与可组合库，支持来源注册、模块与自定义文本、资源位置、角色与排序、策略库、预览及会话应用；Tavern 与 Memory Manager 为可选来源。
- 标准版使用 DSH `0.2.0-rc.2` 公开接口，支持可恢复的历史来源清理；可选进阶 addon 使用显式准备的协议 1 核心，筛选请求副本并保存装配证据，保留 DSH 原始历史。
- 标准包与 core addon 同步为 `1.0.0`，安装器要求精确匹配；双语 Quick start 与安装示例固定到 `v1.0.0`。
- 已知限制：标准历史清理在官方轨迹中显示空上下文审计条目；可整轮折叠，按来源处理等待官方展示接口。进阶版仍需单独准备核心，不由标准安装自动启用。
- First stable version: a standalone prompt assembly plugin and composable library with source registration, modules and custom text, resource positions, roles and ordering, a strategy library, preview and session application. Tavern and Memory Manager remain optional sources.
- Standard mode uses public DSH `0.2.0-rc.2` interfaces with restorable history source cleanup. The optional advanced addon uses an explicitly prepared protocol-1 core, filters request copies and records assembly evidence while preserving native DSH history.
- Standard and core addon versions are both `1.0.0`, with an exact installer version check. Bilingual Quick start and installation examples pin `v1.0.0`.
- Known limitation: standard history cleanup appears as empty context audit rows in the official trajectory. Whole-turn folding is available; handling by source awaits an official display interface. Advanced mode still requires separate core preparation and is not enabled by standard installation.

## 0.2.0

- 资源位置页支持来源声明的位置、开关、排序优先级及自定义位置；装配结果只读展示正文、角色适配与处理原因。保存规则与保存并应用分开，应用前重新校验并说明不可用原因。
- Resource positions supports provider-declared positions, switches, sorting priorities and custom positions; read-only results explain content, role adaptation and decisions. Save rules and Save and apply are distinct, with revalidation and explicit unavailable reasons before applying.
- 历史筛选随策略草稿、库与会话快照保存，默认关闭。标准路径使用原生来源清理与可恢复的 developer 占位；进阶路径只筛选请求副本，保护人工输入、工具事务与未核验 replay/推理。保留原始 durable audit。
- History filtering is stored with strategy drafts, the library and applied snapshots, disabled by default. Standard execution uses native source cleanup and restorable developer placeholders; advanced execution filters only request copies, protecting human inputs, tool transactions and unverified replay/reasoning. Original durable audit remains.
- 公开 actualAssemblyResult 按最终记录消息投影来源展示；最近请求与逐条历史详情分离，完整 system 快照保留 contributor 关联，来源缺证据时明确标示。
- Public actualAssemblyResult projects source display from final recorded messages. Latest requests remain separate from record-specific history; complete system snapshots retain contributor links and missing source evidence stays explicit.

- 标准默认 native 后端使用官方 sections/context/pre-step；进阶 Host 钩子和核心准备工具拆为显式可选 core-extension 包，共享 store/registry/装配原语，旧策略不自动转换。
- Standard native execution uses public sections/context/pre-step. The advanced Host hook and preparation tooling are a separately packed optional core-extension, sharing store/registry/primitives without converting legacy strategies.

- 装配入口位于“设置 → 提示词装配”，移除会话右上角快捷入口；独立与 Tavern 内嵌面板共用刷新事件，同步策略库及当前应用状态，保留未保存草稿。
- Assembly opens from Settings → Prompt assembly; the session-header shortcut is removed. Standalone and embedded Tavern panels share refresh events for library and applied state while preserving unsaved drafts.
- 提供方卸载时撤销其内置预设注册，保留旧会话的已应用快照并说明提供方缺失；不把旧快照重新加入全局列表。
- 界面以分割线区分策略库、装配规则与预览、会话应用及界面设置；语言独立显示。双语使用文档说明消息角色、模块开关、保存/应用与自定义文本。
- Provider removal withdraws its built-ins while retaining applied session snapshots with an unavailable-provider notice; old snapshots do not re-register catalog entries.
- Dividers separate the strategy library, assembly rules/preview, session application and interface settings. Language has its own section; bilingual usage documents explain roles, module switches, save/apply and custom text.

- 独立 DSH `0.2.0-rc.2` Host 插件：自有策略存储、registry、请求钩子、安全 API 与浏览器入口；`dsh.bundle` / `dsh.client` metadata 和提交的客户端构建支持 GitHub 安装。
- 设置入口提供当前会话（含首条消息之前的会话）及策略库；用策略创建会话时在打开之前完成绑定，无全局默认策略。
- `dshPromptAssembler` 公开 store/runtime/registry、Tavern 只读接入与旧存储迁移；`dshPromptSources` 为共享来源服务。根导出保留可组合库 API，无 Tavern/Manager 包依赖。
- 旧 `assembly-presets.json` 非破坏迁移保留 mode scope 与原文件；历史读取兼容 `pmp-dsh-tavern` owner，当前记录使用 `dsh-prompt-assembler`。卸载保留策略存储和 DSH durable history。
- 显式协议 1 核心准备继续独立于插件安装；标准策略使用 stock rc.2 公开接口；进阶缺 addon/钩子时以 HTTP 409 拒绝应用。

- Standalone DSH `0.2.0-rc.2` Host plugin owns strategy storage, registry, request hook, secure API and browser entry. `dsh.bundle` / `dsh.client` metadata and a committed client build support GitHub installation.
- Settings-entry current-session assembly includes sessions before their first message; the strategy library binds new sessions before opening them, without a global default.
- `dshPromptAssembler` exposes store/runtime/registry, Tavern read-object attachment and legacy migration; `dshPromptSources` shares source registration. Root exports remain composable library APIs, without Tavern/Manager package dependencies.
- Non-destructive legacy `assembly-presets.json` migration retains mode scopes and the original file. Historical reads accept prior `pmp-dsh-tavern` ownership; current records use `dsh-prompt-assembler`. Removal preserves strategy storage and DSH durable history.
- Explicit protocol 1 core preparation remains separate from installation. Standard strategies use stock rc.2 public interfaces; advanced application requires the addon and protocol 1.

## 0.1.0

- 装配库提供来源注册、动态与自定义文本解析、位置/角色/深度、system 快照、工具事务完整性与 DSH/Tavern/Manager adapters。
- Assembly library primitives cover source registration, dynamic/custom parsing, placement/roles/depth, system snapshots, complete tool transactions and DSH/Tavern/Manager adapters.
