# DSH Prompt Assembler

[English](README_en.md) · [安装](docs/INSTALLATION.md) · [使用](docs/USAGE.md) · [来源接入合同](docs/INTEGRATION.md) · [安全边界](SECURITY.md)

`dsh-prompt-assembler` 1.0.0 是面向 **DSH `0.2.0-rc.2`** 的独立提示词装配插件，也提供可组合的装配库。插件自己管理策略存储、来源注册、请求钩子、安全 API 和界面；无需安装 Tavern 或 Memory Manager。来源继续拥有正文、资源、解析语法与读取权限，DSH durable history 继续作为会话历史的权威记录。

## 快速开始 / Quick start

准备已可运行的 DSH **`0.2.0-rc.2`** Host，使用 Node **`^22.19.0 || >=24`**。以下流程使用标准版，无需 Tavern、Memory Manager 或 core addon。

1. 停止目标 Host，安装插件；将 `web` 替换为实际使用的 profile：

   ```sh
   dsh plugin --profile web add github:Player-MINEPIG/dsh-prompt-assembler#v1.0.0
   ```

2. 重新启动 Host，打开一个会话，再进入 **设置 → 提示词装配**。尚未发送第一条消息的空白会话也可使用。
3. 在策略库点击 **创建**，填写名称，接入方式选择 **标准版 · 官方接口**。保留“官方基础指令、原生历史、本步输入”；展开 **来源、文本与投递设置**，选择“DSH 自定义文本”解析器并点击 **添加自定义文本**，例如填写“请用简洁中文回答。”，角色保持 `user`。
4. 点击 **装配结果** 检查正文、角色和排列。预览不会发送请求，也不包含输入框中的待发送内容。
5. 点击 **保存并应用到当前会话**，确认“当前应用”显示该策略，再回到聊天发送消息。若要从新会话开始，改用 **使用此策略新建会话** 并选择工作区；策略会先绑定再打开会话。

**保存规则** 只更新策略库；修改后须重新应用才影响后续请求。安装本身不应用策略，没有全局默认策略。完整操作见[使用说明](docs/USAGE.md)；标准历史清理的轨迹显示限制见[已知缺陷](docs/HISTORY_POLICY.md#官方轨迹显示限制)。

`#v1.0.0` 固定此版本；跟随开发主线可改用 `#main`。其他安装方式及进阶版步骤见[安装说明](docs/INSTALLATION.md)。仓库为 public；GitHub 源码、npm 与公开目录是独立分发途径。标准 bundle 使用已构建客户端，安装时不编译源码。进阶策略要求可选 addon 与准备后的协议 1 核心，缺任一返回 409，见[两种后端](docs/BACKENDS.md)。纯装配库需要 Node **`>=20`**。

## 来源与第三方扩展

```mermaid
flowchart LR
  Host[DSH Host] --> Plugin[Assembler 插件]
  Plugin --> Store[策略存储与界面]
  Plugin --> Registry[来源注册与装配]
  Registry -.公开只读对象.-> Sources[DSH / Tavern / Manager / 第三方来源]
```

插件公开 Host 服务 `dshPromptAssembler`，提供 `store`、`runtime`、`registry`、`attachTavern(options)` 和 `migrateLegacy(root)`；共享来源服务为 `dshPromptSources`。Tavern adapter 接收来源拥有的公开只读对象，assembler 不依赖 Tavern/Manager 包或其内部文件。第三方用现有 registry API 注册动态模块或自定义文本解析器，无需修改装配核心；未选择的来源不会自动注入。

[来源接入合同](docs/INTEGRATION.md) 和[运行示例](docs/examples/notes.js)说明注册、取消、读取租约、预览和来源卸载的行为。进阶装配快照保留完整请求内容与 provenance；标准版使用原生事件与正文引用。来源卸载后不会改写 DSH 原生历史。迁移旧 `assembly-presets.json` 保留原文件与旧 mode scope，由 assembler 自己的存储接管后续修改。卸载插件保留 DSH durable history 和策略存储。

## 作为库组合

```js
import { createDshRegistry, assembleRequestAsync, BUILTINS } from 'dsh-prompt-assembler'
const registry = createDshRegistry()
const result = await assembleRequestAsync({ registry, preset: BUILTINS[0], nativeMessages, inputIds })
```

根导出保持可组合库 API，同时导出 Host 插件的 `name`、`inject` 和 `apply`，供 DSH loader 按 package exports 加载；package `main` 为 `src/plugin.js`，`dsh-prompt-assembler/plugin` 是显式 Host 插件入口，`dsh-prompt-assembler/client` 是浏览器入口。`dsh-prompt-assembler/panel` 仍提供可嵌入视图；自行组合 HTTP factory 的调用方须负责认证和安全 fetch。

## 开发与验证

```sh
npm ci
npm run check
```

`check` 覆盖本地测试、客户端构建与包内容检查。CI 在库支持的 Node 版本执行上述命令。Host 测试显式区分 stock 与准备后的 rc.2 核心；默认测试的跳过项不代表 Host 或浏览器验收通过，详见[验证说明](docs/INSTALLATION.md#验证)。当前版本见[变更记录](CHANGELOG.md)。

[第三方接入指南](docs/DEVELOPER_GUIDE.md) · [HTTP API](docs/API.md) · [架构与交互图](docs/ARCHITECTURE.md)。
