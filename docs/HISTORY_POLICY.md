# 模型历史策略与原生能力边界

[English](HISTORY_POLICY_en.md)

目标合同为 DSH `0.2.0-rc.2`。**当前没有可启用的完整历史筛选能力或设置面板。**
公开 API 可以覆盖部分历史，但不能同时满足助手正文局部编辑、保留逐消息角色和顺序、
原始审计不变、卸载后原生会话继续使用这四项要求。不能把会话合并成 user checkpoint
或改写 provider stream 来绕过这个限制。

## 可复现的能力边界

`test/history-native-capabilities.test.mjs` 在真实 Cordis 服务、Session、Agent Loop 和
合成离线模型适配器上执行；它不使用伪造的 Session 对象，也不访问模型服务。

```sh
DSH_ASSEMBLER_STOCK_ROOT=/path/to/stock-runtime node --test test/history-native-capabilities.test.mjs
```

该目录须包含 `package.json` 及可解析的原版 rc.2 依赖。未设置变量时测试明确跳过。

| 路径 | 原生行为 | 对实现的影响 |
| --- | --- | --- |
| 单个旧注入 → 空 `system/message` replacement | 消息不再发送；原始事件保留，其余消息角色顺序保持 | 可证明旧注入隐藏的可行性；不是完整策略实现 |
| 以 `user/message` 替换上述空节点 | 可以引用原始注入和空节点并恢复原注入 | 仅证明该类 user 节点可恢复；不能外推到所有角色 |
| `assistant/message` replacement，不带来源引用 | 拒绝：`sourceEventSeqs must include every shadowed surface node` | 不能替换助手正文或思考 |
| 同一 replacement，带来源引用 | 拒绝：`assistant/message embeds its source stream and cannot carry sourceEventSeqs` | 增加引用也不能解决 |
| `registerMessageProjection` 编辑助手正文 | 加载期间可保持消息 ID 并改变正文 | 已使用的解释器一旦移除，缓存读取及后续 append 都报错 |
| 投影为 `content: []` | 仍然存在空 user 消息 | 空内容不等于删除；公开类型是 `Map<SessionSeq, Message>` |
| 原生 `image/offload` | 拒绝 assistant 目标，只接受 user/tool 的指定图片 | 不能复用为文本筛选解释器 |

最小矛盾是对同一个已提交助手事件执行以下两种调用，两种均拒绝，日志和有效历史保持不变：

```js
const surfaceOp = { op: 'replace', startSeq: assistant.seq, endSeq: assistant.seq }
session.append('assistant/message', editedData, { surfaceOp })
session.append('assistant/message', editedData, { surfaceOp, sourceEventSeqs: [assistant.seq] })
```

完整可运行测试使用真实离线模型产生原助手事件和原始 stream。`editedData` 只在被拒绝的
负例中构造，不写入生产日志。不能把原 stream 复制到修改后的文本后宣称它仍是原始模型输出。

## 需要的最小公开原语

需要由原生 Session 理解、卸载插件后仍可重放的持久编辑决定，至少支持：

- 按原始消息坐标隐藏消息，以及修改助手内容块或正文片段，保持剩余角色、顺序和消息身份。
- 将决定与原事件、规则版本和具体匹配范围关联；原始模型 stream 不变。
- 原生重放、fork、压缩、卸载均有明确语义，且不会依赖被卸载的解释器。
- 修改、撤销决定有可追踪语义；一个策略变更可原子生效，或有不向模型暴露半成品的事务边界。

仅开放 `messages[]` 内存修改不足以提供审计重建；仅增加自定义投影类型也不能解决卸载问题。
必须先获得这样的原生能力或另一个经验证满足同等合同的公开接口，再注册运行时策略。
此仓库没有修改 DSH 核心，也没有实现占位 `apply` API。

## 策略接入约束

以下是后续实现必须满足的条件，不是当前已提供的功能：

- 按 `source.kind` 及生产者的结构化元数据分类。`role: user` 不等于真人；未知来源保留并提示，不能按文本猜来源。
- 当前请求的 preset/worldbook/PHI 仍由生产者重新装配。排除只针对已完成请求的旧副本；新步、重试不能提前清除仍在使用的注入。
- 选择规则必须提供来源、内容类型和显式片段边界；匹配预览显示原文、将移除的区间和保留结果。默认不能删除普通 RP 叙述。
- 保存规则和应用规则是不同动作。旧历史是否立即重算、关闭是恢复还是只停止未来处理，必须在 UI 和持久决定中一致表达。原生未提供撤销前不能许诺恢复所有历史。
- 工具事务整体受保护。不得删除工具调用、配对结果或目标适配器要求的 reasoning/replay 数据。
- 压缩后的摘要不是未压缩逐消息历史。不能从摘要猜来源，也不能向已被压缩覆盖的旧节点执行 replacement。

DeepSeek 的 [Thinking Mode 官方合同](https://api-docs.deepseek.com/guides/thinking_mode/)
区分是否携带 `tools`：携带时需回传历史 `reasoning_content`，包括未实际调用工具的轮次；
不携带时官方说明它不进入后续上下文。不能简单以“轮次已经完成”作为可删思考的依据。
这不证明任意 DSH provider/协议的 token 行为，仍须验证实际目标 adapter 的请求。

## 验证范围

测试覆盖同文真人与插件来源隔离、旧注入隐藏而当前注入保留、原角色顺序、审计原文、
恢复 user 注入、原生 fork、JSON 序列化后 Session 重放、助手替换拒绝、投影卸载失败、
空内容非删除和 image-offload 类型限制。

JSON Session 重放不是磁盘 Host 重启验收；合成适配器不是 DeepSeek wire/API 验收。
没有产品 UI、持久设置 API 或运行时策略，因此没有浏览器保存、工具事务、自动重试、
原生压缩后策略重新应用或真实 Host 磁盘重启的成功声明。集成方应保留这些缺口，
不要把能力测试的通过计入产品功能验收。
