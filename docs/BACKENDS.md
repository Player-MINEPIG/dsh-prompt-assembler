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

标准版的 system 是对官方装配结果的贡献。DSH 根据模型能力决定更新在请求头替换，还是作为 in-history system 更新；保留官方基础指令时，标准版不移动这些原生更新。关闭/省略官方基础指令后，若旧有效 system 与当前装配不同，标准版通过公开的 `startsRequestSeries` 决策要求 DSH 统一更新有效 system，避免 in-history 旧官方指令继续进入未来请求；原始历史事件保留。

user `delivery:context` 是输入之后的原生上下文快照，正文变化时新增，未变化复用；`delivery:pre-step` 是实际步骤前接受的 user 消息，可在本步输入前或后。输入后固定为 context→pre-step；相反顺序会被拒绝。相同投递区域内可排序。两者**都会进入 durable history**；关闭/卸载只停止未来贡献，旧正文继续作为历史存在。context 撤销使用 DSH 自己的失效说明，pre-step 不撤回旧消息。标准版不能任意 depth、不能禁用历史/输入、不能把 system 变成历史后的贡献；旧模块模式中不支持的配置返回 `ASSEMBLY_NATIVE_UNSUPPORTED`；下述插槽模式会明确显示角色适配。

Tavern 保留三个原有标准预设：`builtin-native-st` 将各资产作为历史前的 system，近似 ST 顺序，不采用条目原角色或预设聊天插槽；`builtin-native-cache` 把变化世界书作为输入后 context，PHI 作为末尾 pre-step；`builtin-native-phi` 保留 system 资产，末尾追加 PHI user 提醒。缓存命中与指令影响仍由模型/provider 决定；末尾 user 提醒不等于末尾 system 优先级。原有 `builtin-st/cache/snapshots` 是进阶策略。

旧策略未写 `backend` 时仍解释为 core，原规则与 revision 保持原语义。迁移不转换策略，不删除已应用快照；缺扩展时明确返回 409 `REQUEST_ASSEMBLY_CORE_REQUIRED`。请显式选择一个标准预设或安装进阶扩展。保存草稿不应用；应用会复制会话快照。两个版本共用唯一 store/registry/UI，没有第二套历史或策略库。

`runtime.capabilities()` 区分 native、core、coreExtensionInstalled、nativeRoles、nativeUserDelivery 和 nativeUserEntersHistory。`runtime.requireAvailable(preset)` 核对指定策略。旧 `available()` 是“有任一装配能力”，不能当作 core 授权。核心 protocol marker 本身不会加载进阶 backend；移除 addon 撤销 backend，保留选择与存储。

“历史后条目都是 user”只说明尾部可通过 pre-step 投递。历史前若也有 user 条目（例如前文标记），标准版不能将它们插到已有历史之前。因此不能仅凭尾部角色判断能否复刻整个进阶 ST 布局。模块位置是装配规则，实际请求位置以 DSH 冻结消息为准。

## 两种预设优先模式

在标准版的“放置策略”中选择，或使用同名内置策略；已有会话不会自动切换。

| 模式 | 排列规则 | 角色与投递 |
| --- | --- | --- |
| 预设身份优先 `native-roles` | system 汇集到历史前；user 放在已有历史之后。同一区域保留展开顺序。 | 预设正文与引用插槽保留各条目 system/user，不受预设整块角色覆盖；user 默认 context，也可选择 pre-step。context 在输入后，pre-step 可在输入前后。 |
| 预设插槽优先 `native-slots` | 识别启用预设中的 `chatHistory`、`history`、`input` 插槽及 `{{chatHistory}}`、`{{history}}`、`{{input}}` 宏，预设正文及其引用内容围绕这些边界排列。 | 对预设控制的内容：有历史插槽时，之前改为 system、之后改为 user；只有输入插槽时保留前部角色、之后改为 user。这些 user 内容使用 pre-step。独立内容保留自己的角色与投递方式。 |

例如 `前文{{history}}中间{{input}}后文` 会投递为 `system 前文 → 原生历史 → user 中间 → 本步输入 → user 后文`。`chatHistory` 同时引用历史和输入。没有历史/输入引用时退回身份优先；仅有一处引用时另一原生块使用合法回退位置。重复引用只展开一次；显式输入先于历史会被拒绝。空白会话保留预览边界，但不生成虚构历史或输入消息。

界面根据当前资源标明位置归属：预设正文及被其插槽/宏引用的内容锁定位置；未引用的内容独立移动；部分被引用的模块只移动剩余独立部分。例如 `worldInfoBefore` 只控制 before 组世界书，after 组仍可独立移动；同时引用两组时世界书整体由预设控制。角色和用户设定同样按被引用字段区分，PHI 的独立追加文字不因此被锁定。没有当前输出的模块会标记为空。

独立模块的拖动不会改写放置策略、预设内部顺序或历史/输入插槽。独立 system 始终在历史前，界面阻止把它拖过历史；要把格式提醒放到末尾，请明确设为 user、pre-step，再拖到输入及其他后置模块之后。混合模块中被预设引用的部分仍留在原插槽。context 仍按 DSH 规则在输入后、后置 pre-step 前；拖动不能把它变成末尾消息。列表中的原生历史/输入是独立内容的定位边界，预览展示展开后的精确顺序。加载旧的不合法列表位置时，预览会按原生角色边界调整，并提示。

插槽优先是对预设控制内容的显式角色适配：预览逐条显示角色或投递调整，源预设不被修改。两种模式都拒绝 assistant 贡献及手动策略深度；来源自带的深度会明确提示并降级为当前优先规则的位置，保留原生历史内部顺序和工具事务。新模式通过公开 `startsRequestSeries` 保持有效 system 位于历史前，原始事件保留；不会重写冻结请求。预览中的顺序是本步装配计划；context 未变化时 DSH 会复用旧快照，最终位置以实际请求为准。旧的“按模块列表顺序”继续沿用原有严格边界。

标准版 pre-step 消息使用专属 `source.kind: dsh-prompt-assembler`，模型角色仍为 user，正文和插入顺序保持不变。stock rc.2 原生 Chat 将它归类为注入上下文，从主聊天列表隐藏；实际请求与 durable history 仍保留它。这是来源标记，不会把 pre-step 改成原生 runtime-context 快照。更新仅影响后续生成的消息；旧版已经记录为人工 user 来源的消息不会被重写。
