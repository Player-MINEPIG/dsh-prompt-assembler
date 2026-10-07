# 可选核心装配扩展

[English](README_en.md) · [标准包](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/main/README.md) · [安装与核心准备](https://github.com/Player-MINEPIG/dsh-prompt-assembler/blob/main/docs/INSTALLATION.md)

`dsh-prompt-assembler-core` 显式将经过验证的进阶 executor 注册到标准 assembler。它拥有唯一协议 1 请求钩子的挂载/撤销，以及独立核心准备工具；共享策略、来源、库与 UI 仍由 `dsh-prompt-assembler` 拥有。Tavern 与标准包不依赖本扩展。

要求精确标准包 0.2.0，以及显式准备的 DSH 0.2.0-rc.2（`requestAssemblyVersion:1`）。stock 核心拒绝挂载；核心 marker 不会隐式启用扩展。选择 core 策略才执行进阶投影，native 策略继续官方路径。两种后端不会同时改写一个请求。

从仓库根执行 `npm pack ./core-extension`，单独安装并启用产物。准备工具为 `core-extension/scripts/prepare-request-assembly.mjs`，只生成独立输出，不能代替环境安装/备份。详见安装合同。卸载扩展撤销 backend，保留策略及日志；旧 core 选择明确报错，需要关闭或切换标准策略。
