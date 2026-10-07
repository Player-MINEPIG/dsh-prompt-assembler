# 安装与运行

[English](INSTALLATION_en.md) · [README](../README.md) · [版本与行为](BACKENDS.md)

目标为 DSH `0.2.0-rc.2`，Host 使用 Node `^22.19.0 || >=24`；纯装配库使用 Node >=20。其他 DSH 版本需要另行核对。

## 标准安装

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-prompt-assembler#main
```

仓库是 public。标准包拥有 `main:src/plugin.js`、`dsh.bundle:cordis.patch.yml` 和预构建 `dist/client.js`，无需改动 stock rc.2 核心。停止并重启目标 Host 后打开侧栏；保存与应用分开，新会话先绑定再打开。独立运行没有全局默认，Tavern 不必安装。GitHub 源码、npm 包与插件目录是不同分发途径，不由仓库可见性推断发布状态。

## 可选进阶扩展

高级用户在同一 checkout 单独打包 core-extension，并显式启用该 tgz：

```sh
npm ci
npm run build
npm pack ./core-extension --ignore-scripts --pack-destination .local/packages
node core-extension/scripts/prepare-request-assembly.mjs <DSH-0.2.0-rc.2-source> <separate-output>
dsh plugin --profile web add /path/to/dsh-prompt-assembler-core-0.2.0.tgz
```

参数路径需替换。core-extension peer 要求 `dsh-prompt-assembler@0.2.0`，不拥有第二套策略/UI。准备工具核对 Session/AgentLoop 的版本及固定源码摘要，只写独立输出与 receipt，拒绝重叠路径，不修改来源或已安装核心。审阅输出，备份并停止已授权目标 Host，再按其环境的核心安装流程替换对应构建。插件安装、准备工具和运行环境替换是三个独立动作。

扩展仅在 `agentLoop.requestAssemblyVersion===1` 时可挂载。只有准备后的核心、没有 addon，也不能应用 core 策略。两者缺任一，旧进阶策略仍可编辑/预览，但应用返回 409。标准包不包含准备工具或 addon bundle；root `scripts/prepare-request-assembly.mjs` 仅是源码开发兼容入口。

## 存储与卸载

策略与 session 快照存于 `dshHomePath('dsh-prompt-assembler')/assembly-presets.json`。显式 `migrateLegacy(root)` 只合并缺少的 ID，保留旧文件和 play/native scope；统一 session 选择（含 null）优先于旧 mode 回退。旧策略缺 backend 仍为 core，不自动变成 native。独立运行无默认；Tavern 挂载时，无绑定 play 会话和新开场默认标准 ST 风格；显式安装 addon 后可保留进阶默认。已有明确快照不会因此改变。

卸载提供方撤销其来源与内置目录项，保留会话快照和策略文件。标准 user 贡献留在原生历史；进阶 request-only 贡献停止，已有 request/assembly 仍可读。移除 addon 前先关闭或切换旧 core 策略；未切换会明确报错。恢复 stock 核心使用准备前保留的构建。迁移与真实 profile 写入只在授权环境执行。

## 验证

```sh
npm ci
npm run check
DSH_ASSEMBLER_STOCK_ROOT=<stock-runtime> node --test test/native-backend.test.mjs
DSH_ASSEMBLER_CORE_ROOT=<prepared-runtime> DSH_ASSEMBLER_MANAGER_ROOT=<manager-checkout> node --test test/host.test.mjs test/plugin-host.test.mjs
```

Host fixture 使用临时会话与离线合成 provider，覆盖原生/进阶装配、持久记录、卸载和可选 Manager；没有环境的跳过项不代表验收通过。浏览器与 desktop 另检查侧栏、空白会话、保存/应用/预览、安全 fetch、切换与卸载；真实 provider 与用户 profile 是另外的授权验收。申请公开目录、tag/release/npm 发布需明确授权。
