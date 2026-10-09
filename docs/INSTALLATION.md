# 安装与运行

[English](INSTALLATION_en.md) · [README](../README.md) · [版本与行为](BACKENDS.md)

目标为 DSH `0.2.0-rc.2`，Host 使用 Node `^22.19.0 || >=24`；纯装配库使用 Node >=20。其他 DSH 版本需要另行核对。

## 标准安装

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-prompt-assembler#main
```

仓库是 public。标准包拥有 `main:src/plugin.js`、`dsh.bundle:cordis.patch.yml` 和预构建 `dist/client.js`，无需改动 stock rc.2 核心。停止并重启目标 Host 后打开“设置 → 提示词装配”；“保存规则”仅保存资源，“保存并应用到当前会话”先保存修改再应用，新会话先绑定再打开。独立运行没有全局默认，Tavern 不必安装。GitHub 源码、npm 包与插件目录是不同分发途径，不由仓库可见性推断发布状态。

## 可选进阶扩展

停止目标 Host 后，从同一 checkout 执行一键安装；它安装并启用 addon、切换核心，并保存标准构建以供回退：

```sh
node core-extension/scripts/switch-runtime.mjs install --runtime /path/to/runtime --home /path/to/dsh-home --profile web --prepared /path/to/prepared-core --stock-runtime /path/to/stock-runtime
```

首次使用前，`prepared-core` 由 `node core-extension/scripts/prepare-request-assembly.mjs /path/to/dsh-rc2-source /path/to/prepared-core` 生成；`stock-runtime` 是未修改的官方 rc.2 runtime，含 `node_modules/@deepseek-ai/dsh-session` 和 `dsh-agent-loop`。目标 runtime、标准参照和准备产物均须为 0.2.0-rc.2，标准插件须为 0.2.0。工具通过公开 `dsh-plugin-manager/operations` 安装和启用插件，默认调用 npm，可用 `--npm /path/to/npm` 指定命令。准备工具核验固定源码摘要；切换工具拒绝未知构建、损坏备份和版本不匹配。

随后安装、卸载均无需再提供准备产物或标准参照。停止 Host 后执行对应单条指令，然后重新启动 Host：

```sh
node core-extension/scripts/switch-runtime.mjs install --runtime /path/to/runtime --home /path/to/dsh-home --profile web
node core-extension/scripts/switch-runtime.mjs uninstall --runtime /path/to/runtime --home /path/to/dsh-home --profile web
```

卸载只移除进阶 addon 并恢复标准核心。仍绑定进阶策略的会话切回标准预设插槽优先，原选择备份保留在 profile 的 `.assembler-core-switch/selections-before-uninstall.json`；自定义策略、标准选择、关闭状态及 DSH 会话日志保留。重新安装不自动恢复旧进阶选择。首次安装也保留已有显式选择；请在界面选择进阶插槽策略以测试进阶行为。核心备份与切换 receipt 位于 profile 的 `.assembler-core-switch/`，回退前不要删除。两条指令只针对显式路径，要求目标 Host 已停止。

扩展仅在 `agentLoop.requestAssemblyVersion===1` 时可挂载。只有准备后的核心、没有 addon，也不能应用 core 策略。两者缺任一，旧进阶策略仍可编辑/预览，但应用返回 409。标准包不包含准备工具或 addon bundle；root `scripts/prepare-request-assembly.mjs` 仅是源码开发兼容入口。

## 存储与卸载

策略与 session 快照存于 `dshHomePath('dsh-prompt-assembler')/assembly-presets.json`。显式 `migrateLegacy(root)` 只合并缺少的 ID，保留旧文件和 play/native scope；统一 session 选择（含 null）优先于旧 mode 回退。旧策略缺 backend 仍为 core，不自动变成 native。独立运行无默认；Tavern 挂载时，无绑定 play 会话和新开场默认标准预设插槽优先；安装 addon 不改变默认方案。已有明确快照不会因此改变。

卸载提供方撤销其来源与内置目录项，保留会话快照和策略文件。标准 user 贡献留在原生历史；进阶 request-only 贡献停止，已有 request/assembly 仍可读。一键卸载将旧 core 选择切回标准预设插槽优先；单独移除 addon 而不切换会明确报错。恢复 stock 核心使用切换工具保留的标准构建。迁移与真实 profile 写入只在授权环境执行。

## 验证

```sh
npm ci
npm run check
DSH_ASSEMBLER_STOCK_ROOT=<stock-runtime> node --test test/native-backend.test.mjs
DSH_ASSEMBLER_CORE_ROOT=<prepared-runtime> DSH_ASSEMBLER_MANAGER_ROOT=<manager-checkout> node --test test/host.test.mjs test/plugin-host.test.mjs
```

Host fixture 使用临时会话与离线合成 provider，覆盖原生/进阶装配、持久记录、卸载和可选 Manager；没有环境的跳过项不代表验收通过。浏览器与 desktop 另检查侧栏、空白会话、保存/应用/预览、安全 fetch、切换与卸载；真实 provider 与用户 profile 是另外的授权验收。申请公开目录、tag/release/npm 发布需明确授权。
