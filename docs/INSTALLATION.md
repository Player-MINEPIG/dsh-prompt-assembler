# 安装与运行

[English](INSTALLATION_en.md) · [README](../README.md) · [版本与行为](BACKENDS.md)

目标为 DSH `0.2.1-rc.2` / `0.2.1-rc.3`，Host 使用 Node `^22.19.0 || >=24`；纯装配库使用 Node >=20。Host 与 LLM peer 范围为 `>=0.2.1-rc.2 <0.2.2-0`；后续 0.2.1 RC 按策略准入，0.2.2 及其预发布需重新评估。

兼容回归分别将 `DSH_ASSEMBLER_STOCK_ROOT` 指向官方 rc.2 和 rc.3 的依赖根，运行 `npm run check`。准入测试还覆盖后续 RC、正式版和下一系列的拒绝边界；这些版本值只验证策略，不表示实际运行过未来 Host。标准 Host 测试使用临时数据和合成提供方；另在隔离 Web Host 核对插件详情入口、策略预览/应用和卸载后的原生会话。官方桌面与真实提供方分别验收，运行记录放在 `.local/`。

## 标准安装

在 DSH 的 **插件 → 添加插件** 中输入以下 Release 附件直链，安装并启用独立 Assembler。

```text
https://github.com/Player-MINEPIG/dsh-prompt-assembler/releases/download/v1.1.3/dsh-prompt-assembler-1.1.3.tgz
```

按界面提示重启 Host，再进入 **插件 → 已安装插件 → dsh-prompt-assembler → 配置当前会话**。只打开插件详情不会自动打开编辑器。尚未发送第一条消息的空白会话也可配置。

命令行使用同一安装来源。停止目标 Host 后，将 `web` 替换为实际 profile 名称。

```sh
dsh plugin --profile web add https://github.com/Player-MINEPIG/dsh-prompt-assembler/releases/download/v1.1.3/dsh-prompt-assembler-1.1.3.tgz
```

[Release v1.1.3](https://github.com/Player-MINEPIG/dsh-prompt-assembler/releases/tag/v1.1.3) 的 `.tgz` 含已构建客户端，不修改 stock DSH 核心，也不要求 npm 发布。GUI 接受仓库地址和以 `.tgz` 或 `.tar.gz` 结尾的附件直链，不接受 Release HTML 页面或源码 `.zip`。仓库来源安装对应提交的包，不会自动下载 Release 附件。源码安装可用 `github:Player-MINEPIG/dsh-prompt-assembler#v1.1.3`；开发验收使用已审查的完整 commit。新版仅提供标准包 `1.1.3`。

独立运行无需 Tavern 或 Memory Manager。安装本身不应用策略，也没有全局默认。保存规则仅更新策略库；保存并应用到当前会话先保存再应用；使用此策略新建会话先绑定再打开。

### 与 Tavern 4.0.0 及其他插件共享

先在目标 profile 安装并启用 Assembler，再安装 Tavern 4.0.0 或其他消费者。Tavern 的 Assembler peer 范围为 `~1.1.3`。DSH 的 `autoInstallPeers:false` 不会代为安装缺失 peer，声明 peer 也不等于启用 bundle。消费者通过 `dshPromptAssembler`、`dshPromptSources` 或 `dshPromptStrategies` 复用服务，不启动另一个实例。升级共享运行时前，核对所有消费者声明的兼容范围。

移除 Tavern 只撤销它的来源和界面，独立 Assembler 与其他消费者继续使用共享存储。停用或移除 Assembler 会停止其服务，依赖服务的消费者也会停止。重新启用后由 DSH 恢复依赖，不承诺在途任务不中断。

### 从 Tavern 内嵌版本升级

以下步骤通过 CLI 更新，让旧 Host 在包替换期间保持停止。

1. 停止旧 Host，保留当前数据目录和 profile 配置的备份。
2. 使用上面的 CLI 命令，在同一 profile 安装并启用独立 Assembler 1.1.3。
3. 如果旧 Tavern 配置使用自定义 `assemblerStorageDir`，将该路径设为独立 Assembler 的 `storageDir`，再从 Tavern 配置删除 `assemblerStorageDir`；Tavern 4.0.0 拒绝保留该字段。默认路径仍为 `dshHomePath('dsh-prompt-assembler')`，无需搬迁或删除原策略文件。
4. 如果旧 Tavern 的 `security` 配置曾同时供其内嵌 Assembler 使用，在独立 Assembler 中配置所需的 `security.allowedHosts` 和 `security.allowRemoteClients`。Tavern 4.0.0 不再向 Assembler 转发这些选项。
5. 保留数据并卸载旧 Tavern 软件包，再使用 4.0.0 安装包重新安装。pnpm 覆盖更新可能留下旧内嵌副本；卸载软件包不等于删除数据。完成后重启 Host，核对策略库、会话应用状态和两个插件入口。

不要让旧 Host 在包替换期间继续处理请求。旧策略、资源和 DSH durable history 保留，不通过重写会话完成升级。保留旧自定义路径之前不要让新的空默认目录替代它。

## 历史进阶扩展

进阶扩展冻结在 Assembler `1.1.0` 与 DSH `0.2.0-rc.2`，不承诺适配后续 DSH。源码中的 `core-extension/` 仅保留该冻结版本；不随新版标准包发布，也不能与标准 `1.1.3` 配套使用。旧环境的安装、切换与回退请使用 [v1.1.0 安装指南](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/docs/INSTALLATION.md)及其配套源码。

升级到新版 DSH 前，使用旧版本的切换工具恢复旧环境的 stock 核心，再按目标 DSH 的正常升级流程安装新版标准插件。不要将旧准备产物复制到新版 DSH。策略与历史保留；旧 core 策略不会自动转换，请显式选择并应用标准策略。缺少进阶能力时返回 409 `REQUEST_ASSEMBLY_CORE_REQUIRED`。

## 存储与卸载

策略与 session 快照存于 `dshHomePath('dsh-prompt-assembler')/assembly-presets.json`。显式 `migrateLegacy(root)` 只合并缺少的 ID，保留旧文件和 play/native scope；统一 session 选择（含 null）优先于旧 mode 回退。旧策略缺 backend 仍为 core，不自动变成 native。独立运行无默认；Tavern 挂载时，无绑定 play 会话和新开场默认标准预设插槽优先；安装 addon 不改变默认方案。已有明确快照不会因此改变。

卸载提供方撤销其来源与内置目录项，保留会话快照和策略文件。标准 user 贡献留在原生历史；进阶 request-only 贡献停止，已有 request/assembly 仍可读。冻结进阶环境的核心恢复和旧 core 选择切换使用 [v1.1.0 指南](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/docs/INSTALLATION.md)，不使用标准 1.1.3 包执行。迁移与真实 profile 写入只在授权环境执行。

## 验证

```sh
npm ci
npm run check
DSH_ASSEMBLER_STOCK_ROOT=<stock-runtime> node --test test/native-backend.test.mjs
```

历史进阶夹具仅用于冻结的 0.2.0-rc.2 合同，不作为新版 DSH 的验收。新版 Host 验证使用 stock 目标运行时。

Host fixture 使用临时会话与离线合成 provider，覆盖标准装配、持久记录、卸载和可选 Manager；没有环境的跳过项不代表验收通过。浏览器与 desktop 另检查已安装插件中的配置入口、空白会话、保存/应用/预览、安全 fetch、切换与卸载；真实 provider 与用户 profile 是另外的授权验收。申请公开目录、tag/release/npm 发布需明确授权。
