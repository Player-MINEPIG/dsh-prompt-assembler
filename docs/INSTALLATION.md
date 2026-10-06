# 安装与运行

[English](INSTALLATION_en.md) · [README](../README.md) · [接入合同](INTEGRATION.md)

## 兼容目标

支持的 Host 目标是精确的 DSH `0.2.0-rc.2`，Node `^22.19.0 || >=24`。装配库可独立在 Node >=20 运行。其他 DSH 版本需要单独核对服务、客户端槽位和请求协议，不能由此版本的测试推出兼容性。

## 安装插件

```sh
dsh plugin --profile web add github:Player-MINEPIG/dsh-prompt-assembler#main
```

私有仓库 `Player-MINEPIG/dsh-prompt-assembler` 需要已授权的 GitHub 访问。插件尚不能作为公开插件目录条目；本次不发布 npm 包。安装采用 GitHub 源码仓库中的包 metadata：`main: src/plugin.js`，`dsh.bundle: cordis.patch.yml`，以及指向预构建 `dist/client.js` 的 `dsh.client`。该客户端产物随仓库提交，安装不需要源码构建。

重启所选 profile 的 Host，并打开其浏览器界面。侧栏提供当前会话装配入口和策略库；空白会话也可打开。策略的保存与会话的应用分别进行。用策略创建新会话时先完成绑定，再打开会话；没有全局默认。Tavern 不必安装，原生 DSH 来源和第三方 registry 来源可独立使用。

## 显式准备请求钩子

原版 rc.2 核心没有协议 1 的 `agent/assemble-request` seam。插件检测 `agentLoop.requestAssemblyVersion === 1`，不会在安装时修改核心。未准备核心时可编辑、导入、导出与只读预览；非空策略应用返回 HTTP 409 和 `REQUEST_ASSEMBLY_CORE_REQUIRED`，不伪装成已启用真实请求。

在插件开发 checkout 中安装开发依赖，再对精确 rc.2 源码生成独立输出：

```sh
npm ci
node scripts/prepare-request-assembly.mjs <DSH-0.2.0-rc.2-source> <separate-output>
```

尖括号参数是要替换的占位符。工具核对 `dsh-session` 与 `dsh-agent-loop` 的版本和固定源码摘要，拒绝不同源码及与输入重叠的输出目录。它只写独立输出和 `receipt.json`，不修改来源 checkout 或已安装的 DSH。审阅输出，停止目标 Host、备份 profile 与原核心，再通过该环境已有的核心安装流程替换对应构建并重启；此工具不是安装器。实际替换仅限已授权的运行环境。

准备后的核心在冻结请求前调用装配钩子，并记录 log-only `request/assembly` 快照。该记录保存真实请求表面，不改写原生消息历史，也不证明模型供应商收到请求。

## 存储、迁移与卸载

插件的策略与会话选择写入 assembler 自己的 Host `dshHomePath('dsh-prompt-assembler')` 存储中的 `assembly-presets.json`。旧 Tavern `assembly-presets.json` 可通过 `dshPromptAssembler.migrateLegacy(root)` 显式迁移；`root` 指向旧存储目录。原文件保留，旧 `play:` / `native:` mode scope 保留；当前 assembler 条目优先，迁移只合并缺少的 ID。独立运行时先查原始 session ID，再回退到显式 `native:<id>`、`play:<id>`，包括显式 null；没有旧选择的新会话没有隐式默认。迁移不会把来源资源复制进策略，也不会转换 DSH 历史。迁移只对已授权的目标运行环境执行。

请求记录的当前 owner 是 `dsh-prompt-assembler`，历史读取继续接受旧 `pmp-dsh-tavern` 快照。卸载保留策略存储与 DSH durable history；旧会话仍可由原生 DSH 使用。显式准备的核心是单独变更，如需恢复 stock rc.2，应使用准备前保留的核心构建，并验证保留的 durable history。

## 验证

```sh
npm ci
npm run check
```

标准 CI 执行以上命令；未提供外部核心的 Host 测试会跳过。真实 Host 检查独立、显式选择运行：

```sh
DSH_ASSEMBLER_CORE_ROOT=<prepared-runtime> node --test test/host.test.mjs test/plugin-host.test.mjs
DSH_ASSEMBLER_CORE_ROOT=<prepared-runtime> DSH_ASSEMBLER_MANAGER_ROOT=<manager-checkout> node --test test/host.test.mjs test/plugin-host.test.mjs
```

`test/plugin-host.test.mjs` 在准备后的真实 Host 上检查可安装插件；`test/host.test.mjs` 检查库组合与可选 Manager 接入。这些 fixture 使用临时会话与离线合成 provider。它们可检查请求装配、持久记录、来源卸载和可选 Manager 集成，不代表真实供应商、用户数据或浏览器验收。浏览器与 desktop 验证应覆盖侧栏入口、第一条消息之前的会话、策略创建会话的绑定顺序、保存/应用/预览、安全 fetch、切换会话与卸载；缺少运行环境时须明确记录该缺口。

## 公开目录条件

后续申请 `awesome-dsh-plugin` 前，应具备完整 `dsh.bundle`、可调用的插件行为、准确安装说明，仓库至少存在一天，并在公开时允许读取源码。当前私有仓库不能作为公开可访问条目。目录条目仅在另行授权后提交，不属于本次插件准备。
