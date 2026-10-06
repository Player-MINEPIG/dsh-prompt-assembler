# Changelog / 变更记录

## 0.2.0

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
