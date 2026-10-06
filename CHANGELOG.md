# Changelog / 变更记录

## 0.2.0

- 装配入口保留在侧栏，移除会话右上角快捷入口；独立与 Tavern 内嵌面板共用刷新事件，同步策略库及当前应用状态，保留未保存草稿。
- Assembly remains available from the sidebar; the session-header shortcut is removed. Standalone and embedded Tavern panels share refresh events for library and applied state while preserving unsaved drafts.
- 提供方卸载时撤销其内置预设注册，保留旧会话的已应用快照并说明提供方缺失；不把旧快照重新加入全局列表。
- 界面以分割线区分策略库、装配规则与预览、会话应用及界面设置；语言独立显示。双语使用文档说明消息角色、模块开关、保存/应用与自定义文本。
- Provider removal withdraws its built-ins while retaining applied session snapshots with an unavailable-provider notice; old snapshots do not re-register catalog entries.
- Dividers separate the strategy library, assembly rules/preview, session application and interface settings. Language has its own section; bilingual usage documents explain roles, module switches, save/apply and custom text.

- 独立 DSH `0.2.0-rc.2` Host 插件：自有策略存储、registry、请求钩子、安全 API 与浏览器入口；`dsh.bundle` / `dsh.client` metadata 和提交的客户端构建支持 GitHub 安装。
- 侧栏提供当前会话（含首条消息之前的会话）及策略库；用策略创建会话时在打开之前完成绑定，无全局默认策略。
- `dshPromptAssembler` 公开 store/runtime/registry、Tavern 只读接入与旧存储迁移；`dshPromptSources` 为共享来源服务。根导出保留可组合库 API，无 Tavern/Manager 包依赖。
- 旧 `assembly-presets.json` 非破坏迁移保留 mode scope 与原文件；历史读取兼容 `pmp-dsh-tavern` owner，当前记录使用 `dsh-prompt-assembler`。卸载保留策略存储和 DSH durable history。
- 显式协议 1 核心准备继续独立于插件安装；stock rc.2 缺少钩子时支持编辑/预览，并以 HTTP 409 拒绝应用。

- Standalone DSH `0.2.0-rc.2` Host plugin owns strategy storage, registry, request hook, secure API and browser entry. `dsh.bundle` / `dsh.client` metadata and a committed client build support GitHub installation.
- Sidebar current-session assembly includes sessions before their first message; the strategy library binds new sessions before opening them, without a global default.
- `dshPromptAssembler` exposes store/runtime/registry, Tavern read-object attachment and legacy migration; `dshPromptSources` shares source registration. Root exports remain composable library APIs, without Tavern/Manager package dependencies.
- Non-destructive legacy `assembly-presets.json` migration retains mode scopes and the original file. Historical reads accept prior `pmp-dsh-tavern` ownership; current records use `dsh-prompt-assembler`. Removal preserves strategy storage and DSH durable history.
- Explicit protocol 1 core preparation remains separate from installation. Stock rc.2 supports editing/preview and rejects application with HTTP 409 when the hook is absent.

## 0.1.0

- 装配库提供来源注册、动态与自定义文本解析、位置/角色/深度、system 快照、工具事务完整性与 DSH/Tavern/Manager adapters。
- Assembly library primitives cover source registration, dynamic/custom parsing, placement/roles/depth, system snapshots, complete tool transactions and DSH/Tavern/Manager adapters.
