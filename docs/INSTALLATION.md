# 安装与运行

[English](INSTALLATION_en.md) · [README](../README.md) · [版本与行为](BACKENDS.md)

目标为 DSH `0.2.1-rc.2` / `0.2.1-rc.3`，Host 使用 Node `^22.19.0 || >=24`；纯装配库使用 Node >=20。Host 与 LLM peer 范围为 `>=0.2.1-rc.2 <0.2.2-0`；后续 0.2.1 RC 按策略准入，0.2.2 及其预发布需重新评估。

兼容回归分别将 `DSH_ASSEMBLER_STOCK_ROOT` 指向官方 rc.2 和 rc.3 的依赖根，运行 `npm run check`。准入测试还覆盖后续 RC、正式版和下一系列的拒绝边界；这些版本值只验证策略，不表示实际运行过未来 Host。标准 Host 测试使用临时数据和合成提供方；另在隔离 Web Host 核对插件详情入口、策略预览/应用和卸载后的原生会话。官方桌面与真实提供方分别验收，运行记录放在 `.local/`。

## 标准安装

```sh
dsh plugin --profile web add dsh-prompt-assembler@1.1.3
```

源码安装可使用 `github:Player-MINEPIG/dsh-prompt-assembler#v1.1.3`；`#main` 跟随开发主线。复验其他候选时可改用其已审查的完整 commit，并在调用方 lockfile 固定同一修订。新版仅分发标准包 `1.1.3`，不提供配套核心改动。

仓库是 public。标准包拥有 `main:src/plugin.js`、`dsh.bundle:cordis.patch.yml` 和预构建 `dist/client.js`，无需改动 stock rc.2 核心。停止并重启目标 Host 后打开“插件 → 已安装插件 → dsh-prompt-assembler → 配置当前会话”；“保存规则”仅保存资源，“保存并应用到当前会话”先保存修改再应用，新会话先绑定再打开。独立运行没有全局默认，Tavern 不必安装。GitHub 源码、npm 包与插件目录是不同分发途径，不由仓库可见性推断发布状态。

## 历史进阶扩展

进阶扩展冻结在 Assembler `1.1.0` 与 DSH `0.2.0-rc.2`，不承诺适配后续 DSH。源码中的 `core-extension/` 仅保留该冻结版本；不随新版标准包发布，也不能与标准 `1.1.3` 配套使用。旧环境的安装、切换与回退请使用 [v1.1.0 安装指南](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.1.0/docs/INSTALLATION.md)及其配套源码。

升级到新版 DSH 前，使用旧版本的切换工具恢复旧环境的 stock 核心，再按目标 DSH 的正常升级流程安装新版标准插件。不要将旧准备产物复制到新版 DSH。策略与历史保留；旧 core 策略不会自动转换，请显式选择并应用标准策略。缺少进阶能力时返回 409 `REQUEST_ASSEMBLY_CORE_REQUIRED`。

## 存储与卸载

策略与 session 快照存于 `dshHomePath('dsh-prompt-assembler')/assembly-presets.json`。显式 `migrateLegacy(root)` 只合并缺少的 ID，保留旧文件和 play/native scope；统一 session 选择（含 null）优先于旧 mode 回退。旧策略缺 backend 仍为 core，不自动变成 native。独立运行无默认；Tavern 挂载时，无绑定 play 会话和新开场默认标准预设插槽优先；安装 addon 不改变默认方案。已有明确快照不会因此改变。

卸载提供方撤销其来源与内置目录项，保留会话快照和策略文件。标准 user 贡献留在原生历史；进阶 request-only 贡献停止，已有 request/assembly 仍可读。一键卸载将旧 core 选择切回标准预设插槽优先；单独移除 addon 而不切换会明确报错。恢复 stock 核心使用切换工具保留的标准构建。迁移与真实 profile 写入只在授权环境执行。

## 验证

```sh
npm ci
npm run check
DSH_ASSEMBLER_STOCK_ROOT=<stock-runtime> node --test test/native-backend.test.mjs
```

历史进阶夹具仅用于冻结的 0.2.0-rc.2 合同，不作为新版 DSH 的验收。新版 Host 验证使用 stock 目标运行时。

Host fixture 使用临时会话与离线合成 provider，覆盖标准装配、持久记录、卸载和可选 Manager；没有环境的跳过项不代表验收通过。浏览器与 desktop 另检查已安装插件中的配置入口、空白会话、保存/应用/预览、安全 fetch、切换与卸载；真实 provider 与用户 profile 是另外的授权验收。申请公开目录、tag/release/npm 发布需明确授权。
