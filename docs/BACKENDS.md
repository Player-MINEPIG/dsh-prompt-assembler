# 标准版与进阶扩展

[English](BACKENDS_en.md) · [安装](INSTALLATION.md) · [来源合同](INTEGRATION.md)

当前资源的块、插槽、稳定定位和兼容策略见[资源布局](RESOURCE_LAYOUT.md)。
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

Tavern 提供以下互有区别的参考方案，编辑后可另存为自己的策略：

| 内置策略 | 效果 |
| --- | --- |
| 预设插槽优先（标准） `builtin-native-slots` | RP 默认。按预设插槽安排引用内容，身份适配原生历史/输入边界；无插槽时按身份回退。 |
| 身份优先（标准） `builtin-native-roles` | 保留预设与世界书的条目身份；在合法投递区域内按预设插槽、条目顺序、模块顺序排列。 |
| 世界书与 PHI 后置（标准） `builtin-native-cache` | 前部资产统一为 system；输入后追加世界书 user context，再追加 PHI user pre-step。 |
| PHI 后置（标准） `builtin-native-phi` | 世界书等资产作为历史前 system；只有 PHI 作为末尾 user pre-step 提醒。 |
| 预设插槽优先（进阶） `builtin-st` | 保留支持的预设插槽、原角色与消息级深度；要求 core addon，仍受模型能力约束。 |
| 世界书与 PHI 后置（进阶） `builtin-cache` | 模块顺序参考：前部资产→历史→输入→当前世界书→PHI，保留来源角色，正文仅用于当前请求。 |

插槽方案采用显式资源位置策略：预设插槽→用户指定位置→资源原位置→默认顺序。后置方案保留固定模块规则；它们有意覆盖相应模块位置，并不同时承诺遵循所有预设插槽。缓存命中与末尾提醒效果取决于模型/provider。“缓存友好”已改为描述实际位置的名称；“ST 风格（原生）”已撤出，避免将统一 system 误称为 ST。与后置排序重复的“追加快照”也已撤出，进阶保留方式仍可在来源规则中配置。

新 RP 会话与“应用默认装配策略”使用标准插槽方案，即使安装了进阶 addon 也不自动切换。已应用的旧内置快照、自定义策略和关闭状态保持原样；重新选择并应用才采用新定义。独立 DSH 会话没有隐式 RP 策略。

旧策略未写 `backend` 时仍解释为 core，原规则与 revision 保持原语义。迁移不转换策略，不删除已应用快照；缺扩展时明确返回 409 `REQUEST_ASSEMBLY_CORE_REQUIRED`。请显式选择一个标准预设或安装进阶扩展。保存草稿不应用；应用会复制会话快照。两个版本共用唯一 store/registry/UI，没有第二套历史或策略库。

`runtime.capabilities()` 区分 native、core、coreExtensionInstalled、nativeRoles、nativeUserDelivery 和 nativeUserEntersHistory。`runtime.requireAvailable(preset)` 核对指定策略。旧 `available()` 是“有任一装配能力”，不能当作 core 授权。核心 protocol marker 本身不会加载进阶 backend；移除 addon 撤销 backend，保留选择与存储。

“历史后条目都是 user”只说明尾部可通过 pre-step 投递。历史前若也有 user 条目（例如前文标记），标准版不能将它们插到已有历史之前。因此不能仅凭尾部角色判断能否复刻整个进阶 ST 布局。模块位置是装配规则，实际请求位置以 DSH 冻结消息为准。

## 两种预设优先模式

在标准版的“放置策略”中选择，或使用同名内置策略；已有会话不会自动切换。

| 模式 | 排列规则 | 角色与投递 |
| --- | --- | --- |
| 预设身份优先 `native-roles` | system 汇集到历史前；user 放在已有历史之后。同一区域保留展开顺序。 | 预设正文保留预设条目 system/user；世界书保留自身条目身份，不继承引用插槽或模块的角色覆盖。同一投递区域内按预设插槽、模块内条目顺序、模块顺序依次决定位置；user 默认 context，也可选择 pre-step。context 在输入后，pre-step 可在输入前后。 |
| 预设插槽优先 `native-slots` | 识别启用预设中的 `chatHistory`、`history`、`input` 插槽及 `{{chatHistory}}`、`{{history}}`、`{{input}}` 宏，预设正文及其引用内容围绕这些边界排列。 | 对预设控制的内容：有历史插槽时，之前改为 system、之后改为 user；只有输入插槽时保留前部角色、之后改为 user。这些 user 内容使用 pre-step。独立内容保留自己的角色与投递方式。 |

例如 `前文{{history}}中间{{input}}后文` 会投递为 `system 前文 → 原生历史 → user 中间 → 本步输入 → user 后文`。`chatHistory` 同时引用历史和输入。没有历史/输入引用时退回身份优先；仅有一处引用时另一原生块使用合法回退位置。重复引用只展开一次；显式输入先于历史会被拒绝。空白会话保留预览边界，但不生成虚构历史或输入消息。

界面根据当前资源标明位置归属：预设正文及被其插槽/宏引用的内容锁定位置；未引用的内容独立移动；部分被引用的模块只移动剩余独立部分。例如 `worldInfoBefore` 只控制 before 组世界书，after 组仍可独立移动；同时引用两组时世界书整体由预设控制。角色和用户设定同样按被引用字段区分，PHI 的独立追加文字不因此被锁定。没有当前输出的模块会标记为空。

当前界面在资源位置页拖动稳定的资源类别，并通过排序优先级列表逐轮定位尚未处理的资源；已定位资源不会被后续策略重排。装配结果页只读，并说明是否进入原生历史。原生历史、身份、投递与快照复用限制见[资源布局](RESOURCE_LAYOUT.md)。旧列表策略继续按原有模式解释，不自动迁移。

插槽优先是对预设控制内容的显式角色适配：预览逐条显示角色或投递调整，源预设不被修改。身份优先拒绝无法原生投递的 assistant 贡献；插槽优先可将插槽控制的 assistant 条目适配为 system/user。两种模式都拒绝手动策略深度，保留原生历史内部顺序和工具事务。新模式通过公开 `startsRequestSeries` 保持有效 system 位于历史前，原始事件保留；不会重写冻结请求。预览中的顺序是本步装配计划；context 未变化时 DSH 会复用旧快照，最终位置以实际请求为准。旧的“按模块列表顺序”继续沿用原有严格边界。

世界书的角色定义前后进入 `worldInfoBefore`/`worldInfoAfter`；示例前后围绕 `dialogueExamples`；作者注释前后围绕启用的 `authorNote` 或 `authorsNote` 条目（标记或正文均可）。身份/插槽优先都采用这些锚点；身份优先再按条目身份分组，插槽优先按位置适配身份。示例或作者注释锚点缺失/禁用时，保留原有 before/after 回退并显示 `WORLD_BOOK_SLOT_MISSING`，不假装已精确放置。

`at_depth` 独立于这些插槽。标准版插槽优先目前将 **0 映射为原生历史后、1 映射为原生历史前**，分别适配为 user pre-step 和 system，预览逐条显示映射；拖动世界书模块不会移动这些边界绑定条目。条目原始深度不变；大于 1 沿用角色/投递区域近似并提示，不合并成 1。身份优先保留条目角色，深度只提示近似。按模块列表模式仍由模块位置和角色覆盖决定。

ST 允许 0、1、2……聊天深度，并从聊天末端计数。这里的标准版 0/1 是边界近似，不是 ST 的逐消息插入。进阶版 ST 模式的正深度从原生非 system 消息末端倒数（包含本步输入、工具消息及历史中已有的注入）；深度 0 放在装配结果末尾。插入点不得拆开工具调用与结果。它与 ST 在 Chat History 内按聊天消息计数并非完全等价，尤其在历史含工具/注入或聊天插槽后还有其他模块时。

标准版 pre-step 消息使用专属 `source.kind: dsh-prompt-assembler`，模型角色仍为 user，正文和插入顺序保持不变。stock rc.2 原生 Chat 将它归类为注入上下文，从主聊天列表隐藏；实际请求与 durable history 仍保留它。这是来源标记，不会把 pre-step 改成原生 runtime-context 快照。更新仅影响后续生成的消息；旧版已经记录为人工 user 来源的消息不会被重写。


## 原生运行环境提示控制

规则列表提供 `dsh.runtime-context`（总开关）、`dsh.sandbox-policy`、`dsh.approval-policy` 三个来源控制项，标准版和进阶版均可使用。已有策略未保存这些规则时默认保留原行为；界面显示启用，只有编辑并保存/应用后才产生显式设置。

总开关仅过滤当前支持的 DSH 原生段落名：`sandbox:policy`、`approval:policy`、`subagent:delegation`。子开关分别过滤前两项；总开关关闭时保留子开关配置。未知段落、第三方插件上下文，以及 assembler 的世界书、预设、记忆等 context 贡献均保留。控制不依据 user 身份判断来源，也不删除原生历史或本步输入。

这些模块只控制是否发送提示文字，位置、身份及快照复用仍由 DSH 管理；不改变沙箱执行限制或审批服务策略。它们不是可拖动的正文模块。剩余 context 非空时，DSH 仍自动添加原生上下文封装文字；没有独立的“只去掉封装”开关。关闭应用于后续装配，已记录的旧快照不会被改写；DSH 用新的快照或撤销说明表达状态变化。预览列出当前存在的原生段落及保留/关闭状态，实际请求按已保存的历史展示。
