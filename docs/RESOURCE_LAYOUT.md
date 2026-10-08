# 装配策略与当前资源布局

[English](RESOURCE_LAYOUT_en.md) · [使用](USAGE.md) · [后端能力](BACKENDS.md)

来源（预设、角色卡、世界书、记忆等）负责提供内容，不是拖拽单位。装配块是一条消息或内部顺序确定的一组连续输出。插槽只表示位置，不发送文本。预设正文、历史、本步输入、世界书各位置的组分别出现在当前资源布局中；分散的输出不会被伪装成一个可整体移动的来源。

在“策略与当前资源布局”选择布局来源、身份处理和失效回退。来源配置页保留启用开关、文本解析、投递和留存设置。预览读取当前资源，列出块的具体条目、正文、原始/有效身份、来源资源与字段、内部顺序、插槽归属、留存和运行时限制。宏合入正文的内容保留为子来源，不能从正文中独立拖出。

自由块的拖柄移动整个连续块，内部顺序保持来源定义；下拉框提供同等的键盘操作。插槽绑定块的普通拖柄禁用，只有“明确覆盖插槽”操作才能解除绑定并保存自定义位置。恢复来源位置删除该定位覆盖。历史、深度绑定块和留存快照由运行时管理，不提供直接移动。

## 可组合策略

策略格式仍为 version 1，新增可选 `layout`，不增加 HTTP 端点。保存/导出/API/会话快照保留同一结构：

```json
{
  "version": 1,
  "source": "preset-slots",
  "identity": "preserve",
  "fallback": "source-order",
  "overrides": []
}
```

| 字段 | 行为 |
| --- | --- |
| `source: manual` | 来源默认顺序加显式块定位；已列来源的正文不被预设引用重新定位。 |
| `source: preset-slots` | 预设引用占据插槽；未引用部分保留为自由块。 |
| `identity: preserve` | 保留来源条目身份（自定义文本采用其明确配置的身份）。不兼容标准插槽位置时拒绝装配。 |
| `identity: position` | 明确允许标准后端按预设插槽/深度边界适配身份，并逐条记录原身份与调整诊断；不是任意跨历史投递许可。 |
| `fallback: source-order` | 定位目标消失时保留来源默认位置，输出诊断。缺失预设锚点沿用带诊断的来源回退。 |
| `fallback: error` | 定位目标、请求引用或已诊断的预设锚点缺失时拒绝装配。空插槽本身不代表错误。 |

`placement` 由显式 `layout` 派生。无 `layout` 的旧策略仍按原 `placement`、角色覆盖与投递执行，预览标为兼容模式；“采用资源布局策略”只修改编辑草稿，必须预览、保存、应用，不静默迁移已应用快照。旧内置策略继续作为兼容模板；新的选择是独立约束，不是五种互斥“优先”黑箱。

## 定位与动态资源

`overrides` 每项为 `{target, anchor, side: "before"|"after", detach: boolean}`。调用 `withBlockMove(preset, preview.resourceLayout, target, anchor, side, detach)` 构造覆盖；预览和真实请求使用同一展开、移动与验证路径。定位 ID 是不透明值，调用者应从最新预览获取，不自行拼接。

世界书定位采用来源规则、资源、位置组、身份、插槽、深度和投递区域，不保存当前触发条目列表。下一轮的新条目进入所属连续组，失效的条目离开。相同身份/位置被其他输出分成多段时，单独定位各段；段消失或合并不能悄悄指向另一段，返回 `LAYOUT_TARGET_MISSING`。更换资源或插槽结构可能使定位失效。重复插槽只消费一次，并返回 `LAYOUT_DUPLICATE_SLOT`；预览也保留空插槽。

`preview.resourceLayout` 包含 `policy`、`legacy`、`slots`、`blocks`。块含 `nodeIds`、`entries`、`originalRoles/effectiveRoles`、`binding`、`region`、`reason`、`retention` 和 `limitations`；条目包含来源资源/字段、实际正文、宏子来源及位置覆盖。插槽带 `emitsText:false` 和引用目标。该布局说明本轮装配，历史实际请求仍读取原有 actual 接口。

## 标准与进阶边界

标准版只能投递 system/user，保持原生历史顺序。system 不能拖到历史后；user pre-step 可在合法区域跨本步输入移动；context 位于新快照区域，可能复用历史中已有快照的位置，预览明确显示 `NATIVE_CONTEXT_REUSES_HISTORY_POSITION`。这不是最终冻结请求的精确位置证明。

标准深度 0/1 仍是历史边界映射，较大深度仍提示近似；保留身份与边界映射冲突会拒绝，不伪称精确 ST depth。assistant 来源只有在明确允许适配且处于支持的插槽位置时才能转换。进阶 core 保留现有身份、深度和完整工具事务验证，system 更新还受模型能力限制。布局不改变历史筛选，不提供自动缓存重排，也不会为缓存命中牺牲已选约束。

验证：`node --test test/resource-layout*.test.mjs`；真实 Host 测试使用 `DSH_ASSEMBLER_STOCK_ROOT` 与 `DSH_ASSEMBLER_CORE_ROOT` 指向相应依赖环境，临时 profile 和离线 provider，不发送付费模型请求。浏览器可在当前资源布局中拖动一个含两条世界书条目的自由块，保存应用后加入第三条，再检查预览与离线实际请求。
