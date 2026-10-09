# 可选核心装配扩展

[English](README_en.md) · [标准包](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.0.0/README.md) · [安装与核心准备](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/v1.0.0/docs/INSTALLATION.md)

`dsh-prompt-assembler-core` 显式将经过验证的进阶 executor 注册到标准 assembler。它拥有唯一协议 1 请求钩子的挂载/撤销，以及独立核心准备工具；共享策略、来源、库与 UI 仍由 `dsh-prompt-assembler` 拥有。Tavern 与标准包不依赖本扩展。

要求精确标准包 1.0.0，以及显式准备的 DSH 0.2.0-rc.2（`requestAssemblyVersion:1`）。stock 核心拒绝挂载；核心 marker 不会隐式启用扩展。选择 core 策略才执行进阶投影，native 策略继续官方路径。两种后端不会同时改写一个请求。

一键安装或卸载使用 `node core-extension/scripts/switch-runtime.mjs install|uninstall --runtime <runtime> --home <DSH_HOME> --profile web`。首次安装还需 `--prepared <准备产物> --stock-runtime <标准runtime>`；安装会自动打包并启用 addon，卸载恢复标准构建并将进阶选择切回标准插槽优先。先停止目标 Host，执行后重启；完整步骤见上方安装说明。保留策略和日志，进阶版与标准版可以反复切换。
