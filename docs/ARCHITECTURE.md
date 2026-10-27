# Prompt Assembler 架构

[English](ARCHITECTURE_en.md) · [交互架构图](assets/architecture/assembler.zh-CN.html) · [开发者指南](DEVELOPER_GUIDE.md)

进阶路径仅保留冻结的 Assembler 1.1.0 / DSH 0.2.0-rc.2 合同；新版不提供核心改动，也不承诺后续进阶适配。

独立启用的 src/plugin.js 入口拥有唯一 registry/store/runtime，提供 dshPromptSources 与 dshPromptAssembler。Tavern 3.0.6 和其他消费者通过 peer 与服务注入复用这个实例，不携带或启动另一份 Host 运行时。`dshPromptAssembler.version` 从自身 manifest 标识运行包版本，来源与排序协议仍使用各自的 version 字段。浏览器入口在 plugins.bundle.config 注册以包名为键的配置入口，并由 shell.overlay 挂载独立策略编辑器；HTTP factory 由 bundle 安全 wrapper 包裹。assembly-presets.json 保存用户预设和独立应用的会话快照，不保存来源正文或原生历史。

浏览器 `apply(ctx, { configurationPackage })` 可将配置入口归属组合加载方的包详情页，省略时归属 `dsh-prompt-assembler`；入口和 overlay 共用同一个会话控制器。

标准路径：native 策略→只读来源→官方 sections/context→接受的 pre-step 消息→原生冻结、provider 与 durable history。可选进阶路径：共享来源→已验证完整 system 投影→协议 1 钩子→log-only request/assembly。只有 addon 注册进阶请求钩子，不静默回退；见[后端边界](BACKENDS.md)。

adapters/dsh 提供原生输入，adapters/tavern 与 adapters/memory-manager 调用可选公开来源服务；包的生产依赖不包含它们。提供方拥有身份、正文、权限、parser 与编辑。卸载撤销后续贡献和提供方内置预设，保留应用快照与历史正文，缺来源有明确诊断。Tavern 兼容别名共享运行时，不添加请求钩子。

block/context、迁移、request/snapshot 保留与 preview 合同见 [INTEGRATION](INTEGRATION.md)、[HTTP API](API.md) 与[安装](INSTALLATION.md)。图的可编辑 Archify JSON 在同目录。

排序通过 `PositionStrategyRegistry` 的请求快照执行 `layout.priority`，内置与第三方算法共用注册合同。手动位置和原生锚点不参与自动认领。`AssemblyPresetStore.registerPresets` 管理提供方目录生命周期，已应用快照独立留存；来源 descriptor 的 `ownsSlots` 取代固定来源 ID 的插槽判断。详见[第三方扩展](DEVELOPER_GUIDE.md#注册排序策略与预设目录)。
