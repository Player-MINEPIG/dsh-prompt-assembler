# Prompt Assembler 架构

[English](ARCHITECTURE_en.md) · [交互架构图](assets/architecture/assembler.zh-CN.html) · [开发者指南](DEVELOPER_GUIDE.md)

src/plugin.js 入口拥有唯一 registry/store/runtime，提供 dshPromptSources 与 dshPromptAssembler。浏览器入口挂载侧栏与策略库；HTTP factory 由 bundle 安全 wrapper 包裹。assembly-presets.json 保存用户预设和独立应用的会话快照，不保存来源正文或原生历史。

标准路径：native 策略→只读来源→官方 sections/context→接受的 pre-step 消息→原生冻结、provider 与 durable history。可选进阶路径：共享来源→已验证完整 system 投影→协议 1 钩子→log-only request/assembly。只有 addon 注册进阶请求钩子，不静默回退；见[后端边界](BACKENDS.md)。

adapters/dsh 提供原生输入，adapters/tavern 与 adapters/memory-manager 调用可选公开来源服务；包的生产依赖不包含它们。提供方拥有身份、正文、权限、parser 与编辑。卸载撤销后续贡献和提供方内置预设，保留应用快照与历史正文，缺来源有明确诊断。Tavern 兼容别名共享运行时，不添加请求钩子。

block/context、迁移、request/snapshot 保留与 preview 合同见 [INTEGRATION](INTEGRATION.md)、[HTTP API](API.md) 与[安装](INSTALLATION.md)。图的可编辑 Archify JSON 在同目录。
