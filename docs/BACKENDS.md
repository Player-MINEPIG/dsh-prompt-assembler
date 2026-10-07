# 标准版与进阶扩展

[English](BACKENDS_en.md) · [安装](INSTALLATION.md) · [来源合同](INTEGRATION.md)

`dsh-prompt-assembler` 是标准 Host 插件，也是共享的策略、来源、解析与装配原语库。Tavern 正常依赖它。`dsh-prompt-assembler-core` 是同仓库 `core-extension/` 中单独打包的可选 Host 扩展；它显式注册经过验证的协议 1 executor。标准 bundle 不注册 `agent/assemble-request`，安装不会修改 DSH 核心。Memory Manager 仍是独立可选扩展。

| 能力 | 标准版 `backend:native` | 进阶版 `backend:core` |
| --- | --- | --- |
| Host | stock DSH 0.2.0-rc.2 的公开 section/context/pre-step 接口 | 显式安装 core 扩展及准备后的协议 1 核心 |
| 官方基础指令 | 在当前 system sections 中保留、关闭或调整整块位置 | 按既有完整 system 快照投影合同控制 |
| 预设、用户设定、角色、世界书、PHI | system 模块可在历史前排序；user 模块按下述投递边界排序 | 保留原有 ST marker、role、depth、request/snapshot 行为 |
| 原生历史、本步输入 | 必须保留，顺序为历史→输入；块内消息不能重排 | 可关闭、移动整块；块内顺序与工具事务仍受保护 |
| 消息角色 | 来源支持的 system/user；原生块保留角色 | 来源支持的 preserve/system/user/assistant；还受 provider 限制 |
| 来源正文留存 | DSH 自己记录 system 更新与 user 消息 | request-only 正文不进入原生消息历史；snapshot 使用进阶锚点 |
| 实际证据 | 原生 durable events；Tavern Trace 的 system/context 引用与哈希 | log-only request/assembly 保存冻结请求；Trace 引用该事件 |

标准版的 system 是对官方装配结果的贡献。DSH 根据模型能力决定更新在请求头替换，还是作为 in-history system 更新；标准版不移动这些原生更新。

user `delivery:context` 是输入之后的原生上下文快照，正文变化时新增，未变化复用；`delivery:pre-step` 是实际步骤前接受的 user 消息，可在本步输入前或后。输入后固定为 context→pre-step；相反顺序会被拒绝。相同投递区域内可排序。两者**都会进入 durable history**；关闭/卸载只停止未来贡献，旧正文继续作为历史存在。context 撤销使用 DSH 自己的失效说明，pre-step 不撤回旧消息。标准版不能任意 depth、不能禁用历史/输入、不能把 system 变成历史后的贡献；不支持的配置返回 `ASSEMBLY_NATIVE_UNSUPPORTED`，不会偷偷转换。

Tavern 提供三个标准预设：`builtin-native-st` 将各资产作为历史前的 system，近似 ST 顺序；`builtin-native-cache` 把变化世界书作为输入后 context，PHI 作为末尾 pre-step；`builtin-native-phi` 保留 system 资产，末尾追加 PHI user 提醒。缓存命中与指令影响仍由模型/provider 决定；末尾 user 提醒不等于末尾 system 优先级。原有 `builtin-st/cache/snapshots` 是进阶策略。

旧策略未写 `backend` 时仍解释为 core，原规则与 revision 保持原语义。迁移不转换策略，不删除已应用快照；缺扩展时明确返回 409 `REQUEST_ASSEMBLY_CORE_REQUIRED`。请显式选择一个标准预设或安装进阶扩展。保存草稿不应用；应用会复制会话快照。两个版本共用唯一 store/registry/UI，没有第二套历史或策略库。

`runtime.capabilities()` 区分 native、core、coreExtensionInstalled、nativeRoles、nativeUserDelivery 和 nativeUserEntersHistory。`runtime.requireAvailable(preset)` 核对指定策略。旧 `available()` 是“有任一装配能力”，不能当作 core 授权。核心 protocol marker 本身不会加载进阶 backend；移除 addon 撤销 backend，保留选择与存储。
