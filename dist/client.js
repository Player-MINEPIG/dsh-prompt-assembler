window.__ModuleLoader__.load({
  id: "dsh-prompt-assembler",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/plugin-client.js
var plugin_client_exports = {};
__export(plugin_client_exports, {
  AssemblyLauncher: () => AssemblyLauncher,
  AssemblyOverlay: () => AssemblyOverlay,
  REFRESH_EVENT: () => REFRESH_EVENT,
  apply: () => apply,
  createAssemblyController: () => createAssemblyController,
  createSessionWithPreset: () => createSessionWithPreset,
  inject: () => inject,
  mainSession: () => mainSession,
  name: () => name,
  sessionLabel: () => sessionLabel
});
module.exports = __toCommonJS(plugin_client_exports);
var import_react5 = require("react");

// src/history-panel.js
var import_react = require("react");

// src/history-client.js
function mountHistoryPolicyPanel(container, { sessionId, root = "/dsh-prompt-assembler/api/v1/history-policy", request: request2 = fetch, fragmentPresets = [], onDirtyChange = () => {
}, onSaved = () => {
} }) {
  const doc = container.ownerDocument, abort = new AbortController();
  let revision = 0, policy, disposed = false, standard = false, dirty = false, editGeneration = 0;
  const setDirty = (value) => {
    if (value) editGeneration++;
    dirty = value;
    onDirtyChange(value);
  };
  const el = (tag, text, parent = container) => {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    parent.append(node);
    return node;
  };
  const panel = el("section");
  panel.className = "history-policy-panel";
  panel.addEventListener("input", () => setDirty(true));
  panel.addEventListener("change", () => setDirty(true));
  const title = el("h2", "\u6A21\u578B\u5386\u53F2\u7B5B\u9009", panel);
  const explanation = el("p", "\u4FDD\u7559\u539F\u59CB\u65E5\u5FD7\u548C\u5C55\u793A\u539F\u6587\u3002\u4FDD\u5B58\u540E\u4ECE\u4E0B\u4E00\u6B65\u8BF7\u6C42\u91CD\u65B0\u7B5B\u9009\u73B0\u5B58\u6709\u6548\u5386\u53F2\uFF0C\u540C\u4E00\u6B65\u91CD\u8BD5\u6CBF\u7528\u539F\u89C4\u5219\uFF1B\u5173\u95ED\u540E\u6062\u590D\u539F\u751F\u6709\u6548\u5386\u53F2\u3002\u5DF2\u88AB\u539F\u751F\u538B\u7F29\u7684\u5185\u5BB9\u4E0D\u4F1A\u590D\u539F\u3002", panel);
  const label = el("label", "", panel), enabled = el("input", "", label);
  enabled.type = "checkbox";
  enabled.setAttribute("aria-label", "\u542F\u7528\u5386\u53F2\u7B5B\u9009");
  el("span", " \u542F\u7528\u5386\u53F2\u7B5B\u9009", label);
  const sources = el("fieldset", "", panel);
  el("legend", "\u4FDD\u7559\u54EA\u4E9B\u5386\u53F2\u6765\u6E90", sources);
  const sourceRows = el("div", "", sources);
  el("p", "\u6765\u6E90\u5F00\u5173\u53EA\u7B5B\u9009\u65E7\u6D88\u606F\u3002\u5F53\u524D\u6B65\u6CE8\u5165\u3001\u4ECD\u5728\u4F7F\u7528\u7684\u6700\u65B0\u8FD0\u884C\u4E0A\u4E0B\u6587\uFF0C\u4EE5\u53CA\u5DE5\u5177\u8C03\u7528\u548C\u7ED3\u679C\u59CB\u7EC8\u4FDD\u7559\u3002", sources);
  const addRow = el("div", "", sources), sourceName = el("input", "", addRow);
  sourceName.placeholder = "\u7CBE\u786E source.kind";
  sourceName.setAttribute("aria-label", "\u6DFB\u52A0\u6765\u6E90");
  const addSource = el("button", "\u6DFB\u52A0\u6765\u6E90", addRow);
  const content = el("fieldset", "", panel);
  el("legend", "\u4FDD\u7559\u54EA\u4E9B\u5185\u5BB9\u7C7B\u578B", content);
  const types = {};
  for (const [kind, name2] of [["text", "\u6B63\u6587"], ["image", "\u56FE\u7247"], ["reasoning", "\u601D\u8003\uFF08\u534F\u8BAE\u9700\u8981\u6216\u672A\u9A8C\u8BC1\u65F6\u59CB\u7EC8\u4FDD\u7559\uFF09"]]) {
    const line = el("label", "", content), input = el("input", "", line);
    input.type = "checkbox";
    input.setAttribute("aria-label", `\u4FDD\u7559${kind}`);
    types[kind] = input;
    el("span", ` ${name2} `, line);
  }
  const advanced = el("div", "", panel);
  advanced.append(content);
  el("h3", "\u52A9\u624B\u6B63\u6587\u7247\u6BB5\u6392\u9664\uFF08\u8FDB\u9636\u7248\uFF09", advanced);
  el("p", "\u4F7F\u7528\u7CBE\u786E\u8D77\u6B62\u6807\u8BB0\u3002lines \u4EC5\u5339\u914D\u72EC\u7ACB\u884C\u5E76\u8DF3\u8FC7\u4EE3\u7801\u56F4\u680F\uFF1Bliteral \u660E\u786E\u5141\u8BB8\u884C\u5185\u5339\u914D\u3002\u5D4C\u5957\u6216\u672A\u95ED\u5408\u6807\u8BB0\u4FDD\u7559\u5E76\u63D0\u793A\u3002\u89C4\u5219\u9ED8\u8BA4\u4E0D\u542F\u7528\u3002", advanced);
  const fragments = el("textarea", "", advanced);
  fragments.rows = 9;
  fragments.setAttribute("aria-label", "\u7247\u6BB5\u89C4\u5219 JSON");
  for (const preset of fragmentPresets) {
    const button = el("button", `\u6DFB\u52A0 ${preset.name}`, advanced);
    button.onclick = () => {
      try {
        const rules = JSON.parse(fragments.value);
        if (!rules.some((r) => r.id === preset.rule.id)) rules.push(structuredClone(preset.rule));
        fragments.value = JSON.stringify(rules, null, 2);
        setDirty(true);
      } catch (error) {
        status.textContent = error.message;
      }
    };
  }
  const actions = el("div", "", panel), previewButton = el("button", "\u5339\u914D\u9884\u89C8", actions), saveButton = el("button", "\u4FDD\u5B58\u5386\u53F2\u89C4\u5219", actions);
  previewButton.disabled = true;
  saveButton.disabled = true;
  addSource.disabled = true;
  const status = el("p", "\u6B63\u5728\u8BFB\u53D6\u2026", panel);
  status.setAttribute("role", "status");
  const results = el("div", "", panel);
  results.setAttribute("aria-label", "\u5386\u53F2\u5339\u914D\u9884\u89C8");
  const reasonLabels = { SOURCE_EXCLUDED: "\u6309\u6765\u6E90\u6392\u9664\u65E7\u6D88\u606F", UNKNOWN_SOURCE_RETAINED: "\u672A\u77E5\u6765\u6E90\uFF1A\u4FDD\u7559\u539F\u6587", REASONING_REQUIRED_OR_UNVERIFIED: "\u6A21\u578B\u534F\u8BAE\u8981\u6C42\u4FDD\u7559\u601D\u8003\uFF0C\u6216\u5C1A\u672A\u9A8C\u8BC1\u80FD\u5B89\u5168\u7701\u7565", SOURCE_REQUIRED_REASONING_RETAINED: "\u6B64\u6D88\u606F\u542B\u5FC5\u9700\u601D\u8003\uFF0C\u4E0D\u80FD\u6574\u6761\u6392\u9664", CURRENT_OR_ASSEMBLED_CONTENT: "\u5F53\u524D\u6B65\u6216\u672C\u6B21\u88C5\u914D\u5185\u5BB9\uFF1A\u4FDD\u7559", PROTECTED_PROTOCOL_MESSAGE: "\u5DE5\u5177\u4E8B\u52A1\u3001\u7CFB\u7EDF\u6307\u4EE4\u6216 adapter replay \u6570\u636E\uFF1A\u4FDD\u7559", CURRENT_RUNTIME_CONTEXT: "\u5F53\u524D\u4ECD\u5728\u4F7F\u7528\u7684\u8FD0\u884C\u4E0A\u4E0B\u6587\uFF1A\u4FDD\u7559", AMBIGUOUS_FRAGMENT: "\u7247\u6BB5\u6807\u8BB0\u6709\u6B67\u4E49\uFF1A\u4FDD\u7559", UNCLOSED_FRAGMENT: "\u7247\u6BB5\u672A\u95ED\u5408\uFF1A\u4FDD\u7559", EMPTY_AFTER_FILTER: "\u7B5B\u9009\u540E\u65E0\u5269\u4F59\u5185\u5BB9" };
  const display = (message) => message.content.map((block) => block.type === "text" ? block.text : block.type === "reasoning" ? `\u3014\u601D\u8003\u3015
${block.text}` : `\u3014${block.type}\u3015`).join("\n\n");
  reasonLabels.POLICY_DISABLED = "\u5DF2\u5173\u95ED\uFF1A\u6062\u590D\u4ECD\u7531\u672C\u529F\u80FD\u9690\u85CF\u7684\u6D88\u606F";
  reasonLabels.NATIVE_REPLACEMENT_RETAINED = "\u539F\u751F\u538B\u7F29\u6216\u5176\u4ED6\u66FF\u6362\u7ED3\u679C\uFF1A\u4FDD\u7559";
  reasonLabels.SOURCE_REPLAY_RETAINED = "\u6B64\u6D88\u606F\u643A\u5E26\u534F\u8BAE\u91CD\u653E\u6570\u636E\uFF0C\u4FDD\u7559\u6D88\u606F\u8EAB\u4EFD\u4E0E\u5185\u5BB9\u5757";
  reasonLabels.REPLAY_BLOCKS_RETAINED = "\u4FDD\u7559\u534F\u8BAE\u91CD\u653E\u6240\u9700\u7684\u5185\u5BB9\u5757\u4E0E\u601D\u8003\uFF0C\u4EC5\u5141\u8BB8\u5DF2\u9A8C\u8BC1\u7684\u6B63\u6587\u7247\u6BB5\u7F16\u8F91";
  function renderSources() {
    sourceRows.replaceChildren();
    const listed = new Map([["user", true], ["model", true], ...policy.sources.map((r) => [r.kind, r.include])]);
    for (const [kind, include] of listed) {
      const row = el("label", "", sourceRows), input = el("input", "", row);
      input.type = "checkbox";
      input.checked = standard && ["user", "model"].includes(kind) ? true : include;
      input.disabled = standard && ["user", "model"].includes(kind);
      input.dataset.kind = kind;
      input.setAttribute("aria-label", `\u4FDD\u7559\u6765\u6E90 ${kind}`);
      el("span", ` ${kind} `, row);
    }
  }
  const draft = () => ({
    version: 1,
    enabled: enabled.checked,
    sources: [...sourceRows.querySelectorAll("input")].map((input) => ({ kind: input.dataset.kind, include: input.checked })),
    contentTypes: standard ? policy.contentTypes : Object.fromEntries(Object.entries(types).map(([kind, input]) => [kind, input.checked])),
    fragments: standard ? policy.fragments : JSON.parse(fragments.value)
  });
  async function call(suffix = "", method = "GET", body) {
    const response = await request2(`${root}${suffix}?sessionId=${encodeURIComponent(sessionId)}`, { method, signal: abort.signal, headers: { "Content-Type": "application/json" }, ...body ? { body: JSON.stringify(body) } : {} });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error ?? "History API failed");
    return result;
  }
  addSource.onclick = () => {
    try {
      policy = draft();
      if (!policy.sources.some((r) => r.kind === sourceName.value)) policy.sources.push({ kind: sourceName.value, include: true });
      renderSources();
      sourceName.value = "";
      setDirty(true);
    } catch (error) {
      status.textContent = error.message;
    }
  };
  async function action(button, run) {
    button.disabled = true;
    try {
      await run();
    } catch (error) {
      if (!disposed) status.textContent = error.message;
    } finally {
      if (!disposed) button.disabled = false;
    }
  }
  previewButton.onclick = () => action(previewButton, async () => {
    const result = await call("/preview", "POST", { policy: draft() });
    if (disposed) return;
    results.replaceChildren();
    status.textContent = `\u9884\u89C8\uFF1A${standard ? result.operations.length : result.audit.decisions.filter((d) => d.action !== "keep").length} \u6761\u6D88\u606F\u6539\u53D8\uFF0C${result.audit.warnings.length} \u6761\u63D0\u793A\u3002${standard ? "\u9884\u89C8\u4E0B\u4E00\u6B65\u7684\u6E05\u7406\u4E0E\u6062\u590D\uFF1B\u672A\u5305\u542B\u4E0B\u4E00\u6B65\u65B0\u6CE8\u5165\uFF0C\u4ECD\u4FDD\u7559\u6700\u65B0\u8FD0\u884C\u4E0A\u4E0B\u6587\u3002" : "\u4EC5\u5305\u542B\u5DF2\u4FDD\u5B58\u7684\u539F\u751F\u6709\u6548\u5386\u53F2\uFF0C\u4E0D\u542B\u8F93\u5165\u6846\u8349\u7A3F\u3002"}`;
    for (const row of result.preview) {
      const item = el("details", "", results);
      item.open = row.action !== "keep";
      el("summary", `${row.role} \xB7 ${row.sourceKind} \xB7 ${row.action} \xB7 seq ${row.seq ?? "\u672C\u6B65\u88C5\u914D"}`, item);
      if (row.reasons.length) el("p", row.reasons.map((reason) => reasonLabels[reason] ?? reason).join(" \xB7 "), item);
      el("h4", "\u539F\u6587", item);
      el("pre", display(row.original), item);
      el("h4", "\u6709\u6548\u5185\u5BB9", item);
      el("pre", row.effective ? display(row.effective) : "\u672C\u6B21\u8BF7\u6C42\u4E0D\u5305\u542B\u6B64\u6D88\u606F", item);
      for (const block of row.blocks) {
        if (block.action === "exclude") el("p", `\u6392\u9664\u5185\u5BB9\u7C7B\u578B\uFF1A${block.type}`, item);
        for (const range of block.ranges ?? []) {
          el("p", `\u5339\u914D\u89C4\u5219\uFF1A${range.ruleIds.join("\u3001")} \xB7 \u539F\u6587\u5B57\u7B26\u533A\u95F4 ${range.start}\u2013${range.end}`, item);
          el("pre", row.original.content[block.index].text.slice(range.start, range.end), item);
        }
      }
    }
  });
  saveButton.onclick = () => action(saveButton, async () => {
    const savingGeneration = editGeneration;
    const result = await call("", "PUT", { policy: draft(), expectedRevision: revision });
    if (disposed) return;
    policy = result.policy;
    revision = result.revision;
    results.replaceChildren();
    if (editGeneration === savingGeneration) setDirty(false);
    onSaved();
    status.textContent = `\u5DF2\u4FDD\u5B58\u7248\u672C ${revision}\u3002\u4ECE\u4E0B\u4E00\u6B65${standard ? "\u539F\u751F" : "\u8FDB\u9636"}\u8BF7\u6C42\u751F\u6548\uFF1B\u540C\u4E00\u6B65\u91CD\u8BD5\u548C\u8FC7\u53BB\u7684\u5BA1\u8BA1\u8BB0\u5F55\u4E0D\u53D8\u3002${dirty ? " \u4ECD\u6709\u4FDD\u5B58\u671F\u95F4\u7684\u65B0\u4FEE\u6539\u5F85\u4FDD\u5B58\u3002" : ""}`;
  });
  const ready = call().then((result) => {
    if (disposed) return;
    standard = result.capabilities?.mode === "standard";
    title.textContent = `\u6A21\u578B\u5386\u53F2\u7B5B\u9009 \xB7 ${standard ? "\u6807\u51C6\u7248" : "\u8FDB\u9636\u7248"}`;
    if (standard) {
      explanation.textContent = "\u6309\u53EF\u9760\u6765\u6E90\u81EA\u52A8\u6E05\u7406\u5DF2\u6D88\u8D39\u7684\u63D2\u4EF6 user \u6CE8\u5165\u3002\u539F\u751F\u65E5\u5FD7\u4FDD\u7559\uFF1B\u4FDD\u5B58\u540E\u4ECE\u4E0B\u4E00\u6B65\u751F\u6548\uFF0C\u6539\u89C4\u5219\u6216\u5173\u95ED\u4F1A\u6062\u590D\u4ECD\u7531\u672C\u529F\u80FD\u9690\u85CF\u7684\u6D88\u606F\u3002\u538B\u7F29\u8986\u76D6\u7684\u5185\u5BB9\u4E0D\u4F1A\u590D\u539F\u3002\u5378\u8F7D\u4FDD\u7559\u5DF2\u5199\u5165\u7684\u6E05\u7406\u7ED3\u679C\uFF0C\u539F\u751F\u4F1A\u8BDD\u53EF\u7EE7\u7EED\uFF1B\u9700\u6062\u590D\u65F6\u8BF7\u5148\u5173\u95ED\u5E76\u8FD0\u884C\u4E00\u6B65\u3002";
      for (const input of advanced.querySelectorAll("input, textarea, button")) input.disabled = true;
      el("p", "\u6B63\u6587\u3001\u56FE\u7247\u3001\u601D\u8003\u548C MVU \u7247\u6BB5\u7B5B\u9009\u4EC5\u5728\u8FDB\u9636\u7248\u751F\u6548\uFF1B\u6807\u51C6\u7248\u5B8C\u6574\u4FDD\u7559\u52A9\u624B\u56DE\u590D\u3002", advanced);
    }
    revision = result.revision;
    policy = result.policy;
    enabled.checked = policy.enabled;
    for (const [kind, input] of Object.entries(types)) input.checked = standard || policy.contentTypes[kind];
    fragments.value = JSON.stringify(policy.fragments, null, 2);
    renderSources();
    previewButton.disabled = false;
    saveButton.disabled = false;
    addSource.disabled = false;
    status.textContent = `\u5DF2\u8BFB\u53D6\u7248\u672C ${revision}\u3002\u672A\u77E5\u6765\u6E90\u3001\u5DE5\u5177\u4E8B\u52A1\u548C adapter replay \u6570\u636E\u4FDD\u7559\u3002`;
  }).catch((error) => {
    if (!disposed) status.textContent = error.message;
  });
  return { ready, isDirty: () => dirty, dispose() {
    disposed = true;
    abort.abort();
    panel.remove();
  } };
}

// src/history-panel.js
var EMPTY_PRESETS = [];
function HistoryPanel({ sessionId, backend, fetcher, root, fragmentPresets = EMPTY_PRESETS, onDirtyChange, locale = 0 }) {
  const container = (0, import_react.useRef)(null);
  const callbacks = (0, import_react.useRef)({ onDirtyChange });
  callbacks.current = { onDirtyChange };
  const presets = JSON.stringify(fragmentPresets);
  (0, import_react.useEffect)(() => {
    let active = true;
    callbacks.current.onDirtyChange?.(false);
    const editor = mountHistoryPolicyPanel(container.current, {
      sessionId,
      root,
      request: fetcher,
      fragmentPresets: JSON.parse(presets),
      onDirtyChange: (dirty) => {
        if (active) callbacks.current.onDirtyChange?.(dirty);
      }
    });
    return () => {
      active = false;
      editor.dispose();
    };
  }, [sessionId, backend, fetcher, root, presets]);
  return (0, import_react.createElement)(
    "details",
    { className: "dta-history-section" },
    (0, import_react.createElement)("summary", null, locale === 0 ? "\u6A21\u578B\u5386\u53F2\u7B5B\u9009" : "Model history filtering"),
    (0, import_react.createElement)("div", { ref: container, className: "dta-history-editor" })
  );
}
var historyPanelCss = `
.dta-history-section{margin-top:24px;border-top:1px solid var(--dta-border);padding-top:20px}
.dta-history-section>summary{cursor:pointer;font-size:15px;font-weight:600;padding:4px 0;overflow-wrap:anywhere}
.dta-history-editor{min-width:0}.history-policy-panel{display:grid;gap:16px;padding-top:16px;min-width:0}
.history-policy-panel h2,.history-policy-panel h3,.history-policy-panel h4,.history-policy-panel p{margin:0}
.history-policy-panel h2{font-size:17px}.history-policy-panel h3{font-size:15px}.history-policy-panel h4{font-size:14px}
.history-policy-panel fieldset{display:grid;gap:14px;min-width:0;margin:0;padding:16px;border:1px solid var(--dta-border);border-radius:10px}
.history-policy-panel legend{padding:0 6px;font-weight:600}.history-policy-panel label{display:inline-flex;align-items:center;gap:8px;margin:0 16px 8px 0}
.history-policy-panel input[type=checkbox]{width:18px;height:18px;margin:0;accent-color:#2484ed;flex-shrink:0}
.history-policy-panel fieldset>div:has(>button),.history-policy-panel>div:has(>button):not(:has(textarea)){display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.dtv-assembly-screen .history-policy-panel input:not([type=checkbox]){width:240px;max-width:100%}
.history-policy-panel>div:has(textarea){display:flex;flex-direction:column;align-items:stretch;gap:16px;min-width:0}
.history-policy-panel>div:has(textarea)>button{align-self:flex-start}.history-policy-panel textarea{width:100%;resize:vertical;min-height:160px;font-family:ui-monospace,monospace}
.history-policy-panel [role=status]{padding:12px 15px;border-radius:10px;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base));overflow-wrap:anywhere}
.history-policy-panel details{margin:12px 0;padding:12px 14px;border:1px solid var(--dta-border);border-radius:10px}.history-policy-panel details>summary{cursor:pointer;overflow-wrap:anywhere}
.history-policy-panel details[open]>summary,.history-policy-panel details p,.history-policy-panel details h4{margin-bottom:12px}.history-policy-panel pre{margin:12px 0}
`;

// src/actual-result.js
var textOf = (message) => (message.content ?? []).map((block) => block.type === "text" ? block.text : `[${block.type}]`).join("\n");
function actualAssemblyResult(record) {
  const result = record.metadata?.assembly ?? { diagnostics: [], nodes: record.messages.map((m, index) => ({
    id: m.id ?? `actual-${index}`,
    module: m.role === "system" ? "native-system" : "history",
    name: m.role === "system" || m.source?.form === "snapshot" ? "source-unrecorded" : m.role,
    role: m.role,
    source: { plugin: m.source?.plugin ?? "DSH", field: m.source?.kind },
    stability: "snapshot",
    lifetime: "native",
    locked: true,
    text: textOf(m),
    messages: [m]
  })) };
  const changed = new Set((record.metadata?.historyPolicy?.decisions ?? []).filter((d) => d.action !== "keep").map((d) => d.messageId));
  const finalById = new Map(record.messages.map((m) => [m.id, m]));
  const nodes = (result.nodes ?? []).flatMap((node) => {
    if (!node.messages?.some((m) => changed.has(m.id))) return [node];
    const messages = node.messages.flatMap((m) => changed.has(m.id) ? finalById.has(m.id) ? [finalById.get(m.id)] : [] : [m]);
    return messages.length ? [{ ...node, messages, text: messages.map(textOf).join("\n\n"), historyFiltered: true }] : [];
  });
  return { ...result, diagnostics: result.diagnostics ?? [], nodes, messages: record.messages, historyPolicy: record.metadata?.historyPolicy, actual: true };
}

// src/native-context.js
var DSH_CONTEXT_NAMES = Object.freeze(["sandbox:policy", "approval:policy", "subagent:delegation"]);
var CONTEXT_CONTROLS = Object.freeze([
  { kind: "dsh.runtime-context", name: "DSH \u539F\u751F\u8FD0\u884C\u73AF\u5883\u63D0\u793A", sections: DSH_CONTEXT_NAMES },
  { kind: "dsh.sandbox-policy", name: "\u6C99\u7BB1\u7B56\u7565\u63D0\u793A", sections: ["sandbox:policy"] },
  { kind: "dsh.approval-policy", name: "\u5BA1\u6279\u7B56\u7565\u63D0\u793A", sections: ["approval:policy"] }
]);
var isContextControl = (kind) => CONTEXT_CONTROLS.some((c) => c.kind === kind);
function contextControlRows(rules, available = CONTEXT_CONTROLS.map((c) => c.kind)) {
  const ids = new Set(rules.map((r) => r.id));
  return [...rules, ...CONTEXT_CONTROLS.filter((c) => available.includes(c.kind) && !rules.some((r) => r.kind === c.kind)).map((c) => {
    let id = c.kind.replaceAll(".", "-");
    while (ids.has(id)) id += "-control";
    ids.add(id);
    return { id, kind: c.kind, enabled: true, role: "preserve", lifetime: "request", depth: null, text: "", name: "" };
  })];
}

// src/resource-positions.js
var idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/;
function normalizePositions(value) {
  if (value === void 0) return void 0;
  if (!Array.isArray(value) || value.length > 512) throw new TypeError("Expected at most 512 resource positions");
  const seen = /* @__PURE__ */ new Set();
  return value.map((p) => {
    const key = positionKey(p?.sourceId, p?.positionId);
    if (!p || typeof p.sourceId !== "string" || typeof p.positionId !== "string" || !idPattern.test(p.sourceId) || !idPattern.test(p.positionId) || seen.has(key) || typeof p.enabled !== "boolean" || !["source", "list"].includes(p.placement)) throw new TypeError("Invalid resource position");
    seen.add(key);
    const anchor = p.anchor;
    if (anchor !== void 0 && anchor !== "end" && (!anchor || typeof anchor.sourceId !== "string" || typeof anchor.positionId !== "string" || !idPattern.test(anchor.sourceId) || !idPattern.test(anchor.positionId) || !["before", "after"].includes(anchor.side) || positionKey(anchor.sourceId, anchor.positionId) === key)) throw new TypeError("Invalid position anchor");
    return { sourceId: p.sourceId, positionId: p.positionId, enabled: p.enabled, placement: p.placement, ...anchor !== void 0 ? { anchor: anchor === "end" ? anchor : { sourceId: anchor.sourceId, positionId: anchor.positionId, side: anchor.side } } : {} };
  });
}
var positionKey = (sourceId, positionId) => `${sourceId}#${positionId}`;
var POSITION_PRIORITIES = Object.freeze(["preset", "resource", "default"]);
function priorityOrder(preset) {
  return normalizePriority(preset.layout?.priority) ?? [...POSITION_PRIORITIES];
}
function normalizePriority(priority) {
  if (priority === void 0) return void 0;
  if (priority === "user" || priority === "preset") return [...POSITION_PRIORITIES];
  if (!Array.isArray(priority) || ![3, 4].includes(priority.length) || new Set(priority).size !== priority.length || priority.some((p) => !["user", ...POSITION_PRIORITIES].includes(p)) || POSITION_PRIORITIES.some((p) => !priority.includes(p))) throw new TypeError("Invalid position priority order");
  return priority.filter((p) => p !== "user");
}
var positionPriority = (preset) => priorityOrder(preset);
function declaredPositions(source) {
  return source.positions ?? [{ id: "content", name: [source.name, source.name] }];
}
function positionRows(preset, sources) {
  const sourceOrder = (source) => {
    const i = preset.rules.findIndex((r) => r.kind === source.id && r.inputMode !== "text");
    return i < 0 ? preset.rules.length : i;
  };
  const rows = [...sources].sort((a, b) => sourceOrder(a) - sourceOrder(b)).filter((s) => s.supportsModule !== false && !isContextControl(s.id)).flatMap((source) => {
    const rule = preset.rules.find((r) => r.kind === source.id && r.inputMode !== "text");
    return declaredPositions(source).map((position) => ({ sourceId: source.id, positionId: position.id, key: positionKey(source.id, position.id), source, position, enabled: position.configurable !== false && rule?.enabled === true, placement: "source" }));
  });
  const known = new Map(rows.map((r) => [r.key, r]));
  const configured = (preset.layout?.positions ?? []).map((p) => {
    const row = known.get(positionKey(p.sourceId, p.positionId));
    return row ? { ...row, ...p, enabled: row.enabled && p.enabled } : { ...p, key: positionKey(p.sourceId, p.positionId), missing: true, source: { id: p.sourceId, name: p.sourceId }, position: { id: p.positionId, name: [p.positionId, p.positionId] } };
  });
  const keys = new Set(configured.map((r) => r.key));
  return [...configured, ...rows.filter((r) => !keys.has(r.key))];
}
function configurePosition(preset, sources, key, patch, beforeKey, displayOrder) {
  const rows = positionRows(preset, sources);
  if (displayOrder) rows.sort((a, b) => displayOrder.indexOf(a.key) - displayOrder.indexOf(b.key));
  const row = rows.find((r) => r.key === key);
  if (!row || row.position.configurable === false) return preset;
  let next = rows.map((r) => r.key === key ? { ...r, ...patch } : r);
  if (beforeKey !== void 0 && beforeKey !== key) {
    const target = next.find((r) => r.key === key);
    next = next.filter((r) => r !== target);
    const at = beforeKey === null ? next.length : next.findIndex((r) => r.key === beforeKey);
    if (at < 0) return preset;
    const before = rows.find((r) => r.key === beforeKey);
    let cursor = before, seen = /* @__PURE__ */ new Set();
    while (cursor?.anchor && cursor.anchor !== "end" && !seen.has(cursor.key)) {
      seen.add(cursor.key);
      const anchorKey = positionKey(cursor.anchor.sourceId, cursor.anchor.positionId);
      if (anchorKey === key) {
        next = next.map((r) => r.key === cursor.key ? { ...r, anchor: void 0 } : r);
        break;
      }
      cursor = rows.find((r) => r.key === anchorKey);
    }
    next.splice(at, 0, { ...target, placement: "list", anchor: before ? { sourceId: before.sourceId, positionId: before.positionId, side: "before" } : "end" });
  }
  const rules = preset.rules.map((r) => r.kind === row.sourceId && r.inputMode !== "text" && patch.enabled === true ? { ...r, enabled: true } : r);
  if (patch.enabled === true && !rules.some((r) => r.kind === row.sourceId && r.inputMode !== "text")) {
    let id = `position-source-${rules.length}`;
    while (rules.some((r) => r.id === id)) id += "-x";
    rules.push({ id, kind: row.sourceId, enabled: true, role: row.source.roles?.includes("preserve") ? "preserve" : row.source.roles?.[0] ?? "system", lifetime: row.source.lifetimes?.[0] ?? "request", depth: null, text: "", name: "" });
  }
  const layout = preset.layout ?? { version: 1, source: "preset-slots", priority: ["preset", "resource", "default"], identity: "preserve", fallback: "source-order", overrides: [] };
  return { ...preset, rules, layout: { ...layout, source: "preset-slots", priority: positionPriority({ layout }), positions: next.map(({ sourceId, positionId, enabled, placement, anchor }) => ({ sourceId, positionId, enabled, placement, ...placement === "list" && anchor !== void 0 ? { anchor } : {} })) } };
}
function resolvedPositionRows(preset, sources, preview) {
  const rows = positionRows(preset, sources);
  if (!preview || preview.actual) return rows;
  const occurrences = /* @__PURE__ */ new Map(), runs = [];
  for (const node of preview.nodes ?? []) {
    const key = positionKey(node.source?.module, node.positionId);
    if (runs.at(-1) === key) continue;
    runs.push(key);
    const list = occurrences.get(key) ?? [];
    list.push(runs.length - 1);
    occurrences.set(key, list);
  }
  for (const row of rows) {
    const positions = occurrences.get(row.key);
    row.resolved = positions?.length === 1;
    row.split = positions?.length > 1;
  }
  const known = rows.filter((r) => r.resolved).sort((a, b) => occurrences.get(a.key)[0] - occurrences.get(b.key)[0]);
  return rows.map((row) => row.resolved ? known.shift() : row);
}

// src/resource-layout.js
function normalizeLayout(value) {
  if (value === void 0) return void 0;
  if (!value || value.version !== 1 || !["manual", "preset-slots"].includes(value.source) || !["preserve", "position"].includes(value.identity) || !["source-order", "error"].includes(value.fallback) || !Array.isArray(value.overrides) || value.overrides.length > 128) throw new TypeError("Invalid resource layout policy");
  const seen = /* @__PURE__ */ new Set();
  const overrides = value.overrides.map((o) => {
    if (!o || ![o.target, o.anchor].every((s) => typeof s === "string" && s.length > 0 && s.length <= 4096) || o.target === o.anchor || seen.has(o.target) || !["before", "after"].includes(o.side) || typeof o.detach !== "boolean") throw new TypeError("Invalid layout override");
    seen.add(o.target);
    return { target: o.target, anchor: o.anchor, side: o.side, detach: o.detach };
  });
  const priority = normalizePriority(value.priority) ?? ["preset", "resource", "default"];
  const positions = normalizePositions(value.positions);
  return { version: 1, source: value.source, identity: value.identity, fallback: value.fallback, overrides, ...priority ? { priority } : {}, ...positions ? { positions } : {} };
}
function layoutPlacement(preset) {
  if (!preset.layout) return preset.placement;
  return preset.backend === "native" ? preset.layout.source === "preset-slots" && preset.layout.identity === "position" ? "native-slots" : "native-roles" : preset.layout.source === "preset-slots" ? "st" : "modules";
}

// src/resource-layout-client.js
var import_react3 = require("react");

// src/sortable-list.js
var import_react2 = require("react");
function SortableList({ items, itemKey, itemName, canMove = () => true, onMove, renderItem, className, label, handleLabel, busy, locale = 0 }) {
  const [dragFrom, setDragFrom] = (0, import_react2.useState)(null), [dropIndex, setDropIndex] = (0, import_react2.useState)(null);
  const drop = (0, import_react2.useRef)(null);
  const reset = () => {
    setDragFrom(null);
    setDropIndex(null);
    drop.current = null;
  };
  const selectBoundary = (at) => {
    drop.current = at;
    setDropIndex(at);
  };
  const boundary = (event) => {
    const list = event.currentTarget.closest("[data-sort-list]");
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    if (!hit || !list?.contains(hit)) return null;
    const target = hit.closest("[data-sort-index]");
    if (!target) return drop.current;
    const rect = target.getBoundingClientRect(), at = Number(target.dataset.sortIndex);
    return event.clientY < rect.top + rect.height / 2 ? at : at + 1;
  };
  const placeholder = (index) => dragFrom !== null && dropIndex === index ? (0, import_react2.createElement)("div", { key: `drop-${index}`, className: "dta-drop-placeholder", role: "status" }, `${locale === 0 ? "\u677E\u5F00\u653E\u5230\u8FD9\u91CC\uFF1A" : "Drop here: "}${itemName(items[dragFrom])}`) : null;
  return (0, import_react2.createElement)("div", { className, "data-sort-list": true, "aria-label": label }, ...items.flatMap((item, index) => {
    const movable = canMove(item);
    const handle = (0, import_react2.createElement)("button", {
      type: "button",
      className: "dta-handle dta-sort-handle",
      disabled: busy || !movable,
      title: locale === 0 ? movable ? "\u6309\u4F4F\u62D6\u52A8\uFF0C\u677E\u5F00\u653E\u5165\u5360\u4F4D\u6846" : "\u4F4D\u7F6E\u7531\u8FD0\u884C\u65F6\u7BA1\u7406" : movable ? "Hold to drag; release in the placeholder" : "Position managed by runtime",
      "aria-label": `${handleLabel}: ${itemName(item)}`,
      "aria-pressed": dragFrom === index,
      onPointerDown: (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragFrom(index);
        selectBoundary(index + 1);
      },
      onPointerMove: (event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) selectBoundary(boundary(event));
      },
      onPointerUp: (event) => {
        event.preventDefault();
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const at = boundary(event);
        event.currentTarget.releasePointerCapture(event.pointerId);
        reset();
        if (at !== null && at !== index && at !== index + 1) onMove(item, items[at] ?? null);
      },
      onPointerCancel: reset,
      onLostPointerCapture: reset
    }, (0, import_react2.createElement)("span", { "aria-hidden": true, className: "dta-grip-icon" }, "\u283F"));
    return [placeholder(index), (0, import_react2.createElement)("div", { key: itemKey(item), className: "dta-sort-item", "data-sort-index": index, "data-dragging": dragFrom === index }, renderItem(item, index, handle))];
  }), placeholder(items.length));
}

// src/resource-layout-client.js
function SummaryMetadata({ items, className = "" }) {
  return (0, import_react3.createElement)("dl", { className: `dta-summary-meta ${className}`, style: { "--dta-meta-columns": items.length } }, ...items.map((item) => (0, import_react3.createElement)("div", { key: item.label }, (0, import_react3.createElement)("dt", null, item.label), (0, import_react3.createElement)("dd", { className: item.className }, item.content))));
}
function ResourcePositionEditor({ preset, sources, preview, resolving, resolutionError, locale = 0, busy, onChange, sourceColor: sourceColor2, originName, sourceName = (id) => sources.find((s) => s.id === id)?.name ?? id }) {
  const t = (zh, en) => locale === 0 ? zh : en;
  const rows = resolvedPositionRows(preset, sources, preview);
  const policy = preset.layout ?? { version: 1, source: "preset-slots", priority: ["preset", "resource", "default"], identity: "preserve", fallback: "source-order", overrides: [] };
  const changePolicy = (patch) => onChange({ ...preset, layout: { ...policy, ...patch, ...patch.priority ? { source: "preset-slots" } : {} } });
  const priorities = priorityOrder({ layout: policy });
  const priorityNames = { preset: t("\u9884\u8BBE\u63D2\u69FD\u4E0E\u5B8F\u5F15\u7528", "Preset slots and macro references"), resource: t("\u8D44\u6E90\u81EA\u5E26\u4F4D\u7F6E\u4E0E\u6DF1\u5EA6", "Resource position and depth"), default: t("\u6765\u6E90\u9ED8\u8BA4\u987A\u5E8F", "Default source order") };
  const movePriority = (id, before) => {
    if (id === before) return;
    const next = priorities.filter((p) => p !== id), at = before == null ? next.length : next.indexOf(before);
    if (at < 0) return;
    next.splice(at, 0, id);
    changePolicy({ priority: next });
  };
  const fixed = (row) => ["native-system", "history", "input"].includes(row.sourceId);
  const update = (row, patch, before) => onChange(configurePosition(preset, sources, row.key, patch, before, rows.map((r) => r.key)));
  const title = (row) => row.source.positions ? row.position.name[locale] ?? row.position.name[0] : sourceName(row.sourceId);
  return (0, import_react3.createElement)(
    "section",
    { className: "dta-resource-layout", "aria-label": t("\u8D44\u6E90\u4F4D\u7F6E\u914D\u7F6E", "Resource positions") },
    (0, import_react3.createElement)("p", null, t("\u914D\u7F6E\u6240\u6709\u53EF\u80FD\u63D0\u4F9B\u5185\u5BB9\u7684\u4F4D\u7F6E\uFF0C\u4E0D\u9700\u8981\u5148\u52A0\u8F7D\u5177\u4F53\u8D44\u6E90\u3002\u5B8F\u5F15\u7528\u548C\u63D2\u69FD\u5F52\u5C5E\u5728\u88C5\u914D\u65F6\u89E3\u6790\uFF1B\u7A7A\u4F4D\u7F6E\u4E5F\u4FDD\u7559\u5728\u6B64\u6E05\u5355\u3002", "Configure every potential content position without loading assets. Macros and slots resolve during assembly; empty positions remain in this list.")),
    !preset.layout && (0, import_react3.createElement)("p", { className: "dta-notice" }, t("\u5F53\u524D\u7B56\u7565\u4FDD\u7559\u539F\u6709\u884C\u4E3A\uFF1B\u7B2C\u4E00\u6B21\u4FEE\u6539\u4F4D\u7F6E\u6216\u6392\u5E8F\u7B56\u7565\u65F6\u91C7\u7528\u8D44\u6E90\u4F4D\u7F6E\u914D\u7F6E\u3002", "The strategy keeps its existing behavior until you edit a position or sorting policy.")),
    (0, import_react3.createElement)("h3", null, t("\u81EA\u52A8\u5B9A\u4F4D\u4F18\u5148\u7EA7", "Automatic placement priority")),
    (0, import_react3.createElement)("p", null, t("\u62D6\u62FD\u5373\u81EA\u5B9A\u4E49\u4F4D\u7F6E\uFF0C\u4E0D\u53C2\u4E0E\u4E0B\u9762\u7684\u4F18\u5148\u7EA7\u7ADE\u4E89\u3002\u5176\u4F59\u5185\u5BB9\u6309\u4ECE\u4E0A\u5230\u4E0B\u7684\u4F18\u5148\u7EA7\u81EA\u52A8\u5B9A\u4F4D\uFF1B\u8EAB\u4EFD\u8BBE\u7F6E\u548C\u8FD0\u884C\u65F6\u8FB9\u754C\u4ECD\u7136\u6709\u6548\u3002", "Dragging sets a custom position outside this priority list. Remaining content follows automatic rules from highest to lowest priority; identity settings and runtime boundaries still apply.")),
    (0, import_react3.createElement)(SortableList, {
      className: "dta-priorities",
      label: t("\u6392\u5E8F\u4F18\u5148\u7EA7\u5217\u8868", "Sorting priority list"),
      items: priorities,
      itemKey: (id) => id,
      itemName: (id) => priorityNames[id],
      handleLabel: t("\u62D6\u52A8\u4F18\u5148\u7EA7", "Drag priority"),
      busy,
      locale,
      onMove: movePriority,
      renderItem: (id, index, handle) => (0, import_react3.createElement)("div", { className: "dta-priority-row", "data-priority": id }, handle, (0, import_react3.createElement)("span", null, `${index + 1}. ${priorityNames[id]}`))
    }),
    (0, import_react3.createElement)(
      "div",
      { className: "dta-resource-policy" },
      (0, import_react3.createElement)("label", null, t("\u8EAB\u4EFD\u5904\u7406", "Identity"), (0, import_react3.createElement)("select", { disabled: busy, value: policy.identity, onChange: (e) => changePolicy({ identity: e.target.value }) }, (0, import_react3.createElement)("option", { value: "preserve" }, t("\u4FDD\u7559\u6765\u6E90\u8EAB\u4EFD", "Preserve source roles")), (0, import_react3.createElement)("option", { value: "position" }, t("\u5141\u8BB8\u6309\u4F4D\u7F6E\u9002\u914D", "Allow position adaptation")))),
      (0, import_react3.createElement)("label", null, t("\u7F3A\u5931\u5B9A\u4F4D", "Missing targets"), (0, import_react3.createElement)("select", { disabled: busy, value: policy.fallback, onChange: (e) => changePolicy({ fallback: e.target.value }) }, (0, import_react3.createElement)("option", { value: "source-order" }, t("\u56DE\u9000\u5E76\u8BF4\u660E\u539F\u56E0", "Fall back with explanation")), (0, import_react3.createElement)("option", { value: "error" }, t("\u62D2\u7EDD\u88C5\u914D", "Reject assembly"))))
    ),
    (0, import_react3.createElement)("small", null, t("\u539F\u751F\u5386\u53F2\u3001\u5DE5\u5177\u4E8B\u52A1\u548C\u7559\u5B58\u8FB9\u754C\u59CB\u7EC8\u7531 DSH \u7BA1\u7406\u3002\u5173\u95ED\u4F4D\u7F6E\u4F1A\u6392\u9664\u8BE5\u4F4D\u7F6E\u7684\u5185\u5BB9\uFF1B\u62D6\u52A8\u8BBE\u7F6E\u624B\u52A8\u6392\u5217\u3002", "DSH always owns native history, tool transactions and retention boundaries. Turning a position off excludes its content; dragging sets user order.")),
    preset.layout?.overrides.length > 0 && (0, import_react3.createElement)("div", { className: "dta-notice" }, t("\u6B64\u7B56\u7565\u8FD8\u542B\u6709\u65E7\u7684\u5177\u4F53\u8D44\u6E90\u5B9A\u4F4D\u3002\u53EF\u5148\u5728\u7ED3\u679C\u9875\u68C0\u67E5\uFF1B\u6E05\u9664\u540E\u4EC5\u4F7F\u7528\u8FD9\u91CC\u7684\u901A\u7528\u4F4D\u7F6E\u914D\u7F6E\u3002", "This strategy also contains older asset-specific overrides. Inspect the result before clearing them to use only reusable positions."), (0, import_react3.createElement)("button", { disabled: busy, onClick: () => changePolicy({ overrides: [] }) }, t("\u6E05\u9664\u65E7\u8D44\u6E90\u5B9A\u4F4D", "Clear asset-specific overrides"))),
    (0, import_react3.createElement)("p", { role: resolutionError ? "alert" : "status" }, resolutionError ? `${t("\u4F4D\u7F6E\u89E3\u6790\u5931\u8D25\uFF0C\u5217\u8868\u4FDD\u7559\u914D\u7F6E\u987A\u5E8F\uFF1A", "Position resolution failed; showing configured order: ")}${resolutionError}` : resolving ? t("\u6B63\u5728\u6839\u636E\u5F53\u524D\u8D44\u6E90\u66F4\u65B0\u4F4D\u7F6E\u2026", "Resolving positions from current resources\u2026") : preview ? t("\u5DF2\u6309\u5F53\u524D\u8D44\u6E90\u66F4\u65B0\u53EF\u786E\u5B9A\u7684\u4F4D\u7F6E\uFF1B\u5206\u6563\u6216\u6682\u65E0\u5185\u5BB9\u7684\u4F4D\u7F6E\u4FDD\u7559\u914D\u7F6E\u987A\u5E8F\u3002", "Definite positions follow current resources; split or empty positions retain configured order.") : t("\u5C1A\u672A\u8BFB\u53D6\u5F53\u524D\u8D44\u6E90\uFF1B\u5217\u8868\u663E\u793A\u914D\u7F6E\u987A\u5E8F\u3002", "Current resources have not been resolved; showing configured order.")),
    (0, import_react3.createElement)(SortableList, {
      className: "dta-position-list",
      items: rows,
      itemKey: (row) => row.key,
      itemName: title,
      handleLabel: t("\u79FB\u52A8\u4F4D\u7F6E", "Move position"),
      busy,
      locale,
      canMove: (row) => !fixed(row) && !row.missing && row.position.configurable !== false,
      onMove: (row, before) => update(row, {}, before?.key ?? null),
      renderItem: (row, index, handle) => (0, import_react3.createElement)(
        "article",
        { className: "dta-position-row", "data-position-key": row.key, style: { "--assembly-color": sourceColor2(row.source.pluginId) } },
        (0, import_react3.createElement)(
          "div",
          { className: "dta-position-summary" },
          handle,
          (0, import_react3.createElement)("input", { type: "checkbox", checked: row.enabled, disabled: busy || row.missing || row.position.configurable === false || preset.backend === "native" && ["history", "input"].includes(row.sourceId), "aria-label": `${t("\u542F\u7528\u4F4D\u7F6E", "Enable position")}: ${title(row)}`, onChange: (e) => update(row, { enabled: e.target.checked }) }),
          (0, import_react3.createElement)("div", { className: "dta-position-name" }, (0, import_react3.createElement)("strong", null, title(row)), (0, import_react3.createElement)("small", { className: "dta-origin" }, `${originName(row.source.pluginId)} \xB7 ${sourceName(row.sourceId)}`)),
          (0, import_react3.createElement)(SummaryMetadata, { className: "dta-position-meta", items: [
            { label: t("\u7A33\u5B9A\u6027", "Stability"), className: "dta-position-stability", content: row.sourceId === "worldbook" ? t("\u5E38\u9A7B\u6761\u76EE\u968F\u8D44\u6E90\u53D8\u5316\uFF1B\u5176\u4ED6\u6761\u76EE\u968F\u5BF9\u8BDD\u89E6\u53D1\u3002", "Constant entries follow asset changes; other entries follow conversation activation.") : { asset: t("\u6E90\u6B63\u6587\u968F\u8D44\u6E90\u53D8\u5316\uFF1B\u5B8F\u4E0E\u5F15\u7528\u53EF\u80FD\u968F\u8BF7\u6C42\u53D8\u5316\u3002", "Source text follows assets; macros and references may vary per request."), conversation: t("\u53EF\u80FD\u968F\u5BF9\u8BDD\u53D8\u5316", "May change with conversation"), evaluation: t("\u6BCF\u6B21\u6C42\u503C\u53EF\u80FD\u53D8\u5316", "May change on each evaluation"), assembly: t("\u7531\u5B98\u65B9\u88C5\u914D\u51B3\u5B9A", "Determined by native assembly"), snapshot: t("\u5DF2\u4FDD\u5B58\u7684\u5FEB\u7167", "Saved snapshot") }[row.source.stability] ?? t("\u6765\u6E90\u672A\u58F0\u660E", "Not declared by provider") },
            { label: t("\u4F4D\u7F6E\u8BF4\u660E", "Placement"), content: (0, import_react3.createElement)("div", null, row.missing ? t("\u6765\u6E90\u672A\u6CE8\u518C\uFF1B\u4FDD\u7559\u914D\u7F6E\u3002", "Provider unavailable; configuration retained.") : row.source.moduleAvailable === false ? t("\u5F53\u524D\u65E0\u5185\u5BB9\uFF1B\u8D44\u6E90\u53EF\u7528\u540E\u751F\u6548\u3002", "No content is currently available; applies when resources are available.") : fixed(row) ? t("\u7531\u8FD0\u884C\u65F6\u7BA1\u7406", "Managed by runtime") : row.placement === "list" ? t("\u81EA\u5B9A\u4E49\u4F4D\u7F6E\uFF1B\u8986\u76D6\u81EA\u52A8\u5B9A\u4F4D\u89C4\u5219\u3002", "Custom position; overrides automatic placement.") : t("\u8DDF\u968F\u9884\u8BBE\u63D2\u69FD\u6216\u8D44\u6E90\u4F4D\u7F6E", "Follow preset slots or resource position"), row.split && (0, import_react3.createElement)("p", null, t("\u5185\u5BB9\u5206\u6563\u5728\u591A\u4E2A\u4F4D\u7F6E\uFF0C\u8BF7\u5728\u88C5\u914D\u7ED3\u679C\u4E2D\u67E5\u770B\u3002", "Content spans multiple positions; inspect the assembly result.")), row.position.note && (0, import_react3.createElement)("p", { className: "dta-position-note" }, row.position.note[locale]), !fixed(row) && row.position.configurable !== false && row.placement === "list" && (0, import_react3.createElement)("div", { className: "dta-position-actions" }, (0, import_react3.createElement)("button", { disabled: busy, onClick: () => update(row, { placement: "source" }) }, t("\u8DDF\u968F\u8D44\u6E90\u4F4D\u7F6E", "Follow source position")))) },
            ...row.position.macros?.length ? [{ label: t("\u9884\u8BBE\u5B8F / \u63D2\u69FD", "Preset macros / slots"), content: row.position.macros.map((m) => `{{${m}}}`).join(" \xB7 ") }] : []
          ] })
        )
      )
    })
  );
}
function PositionDecisions({ preview, sources, locale = 0, sourceName = (id) => sources.find((s) => s.id === id)?.name ?? id }) {
  const t = (zh, en) => locale === 0 ? zh : en;
  const names = { user: t("\u91C7\u7528\u624B\u52A8\u6392\u5217", "Manual order applied"), preset: t("\u91C7\u7528\u9884\u8BBE\u63D2\u69FD", "Preset slot applied"), runtime: t("\u670D\u4ECE DSH \u8FD0\u884C\u65F6\u7EA6\u675F", "DSH runtime constraint wins"), "resource-depth": t("\u91C7\u7528\u8D44\u6E90\u6DF1\u5EA6", "Resource depth applied"), source: t("\u91C7\u7528\u8D44\u6E90\u9ED8\u8BA4\u4F4D\u7F6E", "Source position applied"), default: t("\u7531\u6765\u6E90\u9ED8\u8BA4\u987A\u5E8F\u6392\u5217", "Default source order applied"), resource: t("\u7531\u8D44\u6E90\u81EA\u5E26\u4F4D\u7F6E\u6392\u5217", "Resource position applied"), unavailable: t("\u6765\u6E90\u6216\u4F4D\u7F6E\u672A\u6CE8\u518C\uFF0C\u5DF2\u56DE\u9000", "Provider/position unavailable; fallback applied"), disabled: t("\u5DF2\u5173\u95ED\uFF0C\u4E0D\u8FDB\u5165\u7ED3\u679C", "Disabled; excluded") };
  const decisions = preview?.resourceLayout?.positionDecisions ?? [];
  const unique = [...new Map(decisions.map((d) => [`${d.sourceId}/${d.positionId}/${d.decision}`, d])).values()];
  return unique.length > 0 && (0, import_react3.createElement)("details", { className: "dta-position-decisions", open: true }, (0, import_react3.createElement)("summary", null, t("\u6392\u5E8F\u5904\u7406\u7ED3\u679C", "Sorting decisions")), preview.resourceLayout.priorityOrder && (0, import_react3.createElement)("p", null, `${t("\u672C\u6B21\u81EA\u52A8\u5B9A\u4F4D\u4F18\u5148\u7EA7", "Priority used")}: ${preview.resourceLayout.priorityOrder.map((p) => ({ user: t("\u624B\u52A8\u6392\u5217", "User"), preset: t("\u9884\u8BBE\u63D2\u69FD", "Preset"), resource: t("\u8D44\u6E90\u4F4D\u7F6E", "Resource"), default: t("\u6765\u6E90\u9ED8\u8BA4", "Default") })[p]).join(" \u2192 ")}`), preview.resourceLayout.sortingStages?.length > 0 && (0, import_react3.createElement)("ol", { className: "dta-sorting-stages" }, ...preview.resourceLayout.sortingStages.map((stage) => (0, import_react3.createElement)("li", { key: stage.strategy }, `${{ preset: t("\u9884\u8BBE\u63D2\u69FD", "Preset slots"), resource: t("\u8D44\u6E90\u4F4D\u7F6E", "Resource positions"), default: t("\u6765\u6E90\u9ED8\u8BA4", "Default order") }[stage.strategy]}: ${t("\u5B9A\u4F4D", "Placed")} ${stage.nodeIds.length} ${t("\u9879\uFF0C\u4F4E\u4F18\u5148\u7EA7\u89C4\u5219\u4E0D\u8986\u76D6", "items; lower priorities do not override")}`))), (0, import_react3.createElement)("ul", null, ...unique.map((d, i) => {
    const source = sources.find((s) => s.id === d.sourceId), position = source?.positions?.find((p) => p.id === d.positionId);
    return (0, import_react3.createElement)("li", { key: i }, `${position?.name?.[locale] ?? sourceName(d.sourceId)}: ${names[d.decision] ?? d.decision}${d.code === "POSITION_ANCHOR_MISSING" ? t("\uFF08\u8D44\u6E90\u951A\u70B9\u4E0D\u53EF\u7528\uFF09", " (resource anchor unavailable)") : d.requested ? t("\uFF08\u8BE5\u8D44\u6E90\u5DF2\u7531\u6B64\u524D\u7B56\u7565\u6216\u8FD0\u884C\u65F6\u5B9A\u4F4D\uFF09", " (already placed by an earlier strategy or runtime)") : ""}`);
  })));
}

// src/client.js
var import_react4 = require("react");

// src/model.js
var FORMAT = "dsh-tavern-request-assembly";
var MODULES = Object.freeze(["native-system", "history", "input", "dsh.text"]);
var DEFAULT_RULES = Object.freeze(["native-system", "history", "input"].map((kind) => ({ id: kind, kind, enabled: true })));
function normalizePreset(value) {
  if (!value || value.format !== FORMAT || value.version !== 1) throw new TypeError("Unsupported assembly preset format/version");
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 200) throw new TypeError("Preset name is required (max 200 characters)");
  if (!Array.isArray(value.rules) || value.rules.length > 128) throw new TypeError("Expected at most 128 assembly rules");
  if (value.backend !== void 0 && !["native", "core"].includes(value.backend)) throw new TypeError("Invalid assembly backend");
  const layout = normalizeLayout(value.layout);
  const ids = /* @__PURE__ */ new Set(), kinds = /* @__PURE__ */ new Set();
  const rules = value.rules.map((rule) => {
    if (!rule || !/^[a-zA-Z0-9_-]{1,80}$/.test(rule.id) || ids.has(rule.id)) throw new TypeError("Rule ids must be unique");
    if (typeof rule.kind !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/.test(rule.kind)) throw new TypeError("Invalid or duplicate module");
    ids.add(rule.id);
    kinds.add(rule.kind);
    if (rule.delivery !== void 0 && !["context", "pre-step"].includes(rule.delivery)) throw new TypeError("Invalid native user delivery");
    const role = ["custom", "dsh.text"].includes(rule.kind) ? rule.role === "preserve" ? "system" : rule.role ?? "user" : rule.role ?? "preserve", lifetime = rule.lifetime ?? "request";
    if (!["preserve", "system", "user", "assistant"].includes(role)) throw new TypeError("Invalid role");
    if (!["request", "snapshot"].includes(lifetime)) throw new TypeError("Invalid lifetime");
    if (rule.depth !== void 0 && rule.depth !== null && (!Number.isInteger(rule.depth) || rule.depth < 0 || rule.depth > 1e4)) throw new TypeError("Invalid insertion depth");
    if (typeof (rule.text ?? "") !== "string" || (rule.text ?? "").length > 524288) throw new TypeError("Custom text exceeds limit");
    if (rule.inputMode !== void 0 && !["source", "text"].includes(rule.inputMode)) throw new TypeError("Invalid rule inputMode");
    return { ...rule.delivery ? { delivery: rule.delivery } : {}, ...rule.inputMode === "text" ? { inputMode: "text" } : {}, id: rule.id, kind: rule.kind, enabled: rule.enabled !== false, role, lifetime, depth: rule.depth ?? null, text: rule.text ?? "", name: typeof rule.name === "string" ? rule.name.slice(0, 200) : "" };
  });
  return { ...value.backend ? { backend: value.backend } : {}, format: FORMAT, version: 1, name: value.name.trim(), placement: layoutPlacement({ ...value, layout, placement: ["st", "native-roles", "native-slots"].includes(value.placement) ? value.placement : "modules" }), ...layout ? { layout } : {}, rules };
}
var BUILTINS = Object.freeze([{ id: "builtin-native", ...normalizePreset({ format: FORMAT, version: 1, name: "DSH \u539F\u751F / DSH native", backend: "native", rules: DEFAULT_RULES }) }]);

// src/native-policy.js
var fail = (message, detail) => {
  throw Object.assign(new Error(message), { status: 409, code: "ASSEMBLY_NATIVE_UNSUPPORTED", detail });
};
var adaptiveNativePlacement = (preset) => preset?.backend === "native" && ["native-roles", "native-slots"].includes(preset.placement);
function presetBackend(preset) {
  return preset?.backend ?? "core";
}
function validateNativePreset(value) {
  const preset = normalizePreset(value);
  if (presetBackend(preset) !== "native") fail("This strategy requires the optional core assembly extension.", { backend: "core" });
  for (const kind of ["history", "input"]) {
    const rule = preset.rules.find((r) => r.kind === kind);
    if (!rule?.enabled) fail(`Native assembly must preserve ${kind}.`, { ruleId: rule?.id, kind });
  }
  for (const rule of preset.rules.filter((r) => isContextControl(r.kind))) {
    if (rule.role !== "preserve" || rule.lifetime !== "request" || rule.depth !== null || rule.inputMode === "text") fail("Native context controls only support enable/disable.", { ruleId: rule.id });
  }
  if (adaptiveNativePlacement(preset)) {
    for (const rule of preset.rules.filter((r) => r.enabled)) {
      if (rule.lifetime === "snapshot" || rule.depth !== null || rule.role === "assistant") fail("Native ordering does not support snapshots, depth or assistant contributions.", { ruleId: rule.id });
    }
    return preset;
  }
  let phase = "system", afterInputMessages = false;
  for (const rule of preset.rules.filter((r) => r.enabled)) {
    if (isContextControl(rule.kind)) continue;
    if (rule.kind === "history") {
      if (phase !== "system") fail("Native history cannot be moved after current input.");
      phase = "before-input";
      continue;
    }
    if (rule.kind === "input") {
      if (phase !== "before-input") fail("Current input must follow native history.");
      phase = "after-input";
      continue;
    }
    if (rule.lifetime === "snapshot" || rule.depth !== null) fail("Retained request snapshots and insertion depth require core assembly.", { ruleId: rule.id });
    if (rule.role === "assistant") fail("Assistant-role contributions require core assembly.", { ruleId: rule.id });
    if (rule.role === "user") {
      if (phase === "system") fail("Native user contributions must follow native history.", { ruleId: rule.id });
      if (phase === "before-input" && rule.delivery !== "pre-step") fail("User context snapshots follow current input; use pre-step before input.", { ruleId: rule.id });
      if (phase === "after-input") {
        if (rule.delivery === "pre-step") afterInputMessages = true;
        else if (afterInputMessages) fail("Native context snapshots precede post-input pre-step messages; reorder these contributions.", { ruleId: rule.id });
      }
    } else if (phase !== "system") fail("Native system contributions must precede native history.", { ruleId: rule.id });
  }
  if (preset.placement !== "modules") fail("ST slot/depth placement requires core assembly; choose a native strategy.");
  return preset;
}

// src/client.js
var labels = {
  "dsh.runtime-context": ["DSH \u539F\u751F\u8FD0\u884C\u73AF\u5883\u63D0\u793A\uFF08\u603B\u5F00\u5173\uFF09", "DSH runtime environment prompts (master)"],
  "dsh.sandbox-policy": ["\u6C99\u7BB1\u7B56\u7565\u63D0\u793A \xB7 sandbox:policy", "Sandbox prompt \xB7 sandbox:policy"],
  "dsh.approval-policy": ["\u5BA1\u6279\u7B56\u7565\u63D0\u793A \xB7 approval:policy", "Approval prompt \xB7 approval:policy"],
  contextControlHint: ["\u53EA\u63A7\u5236 DSH \u539F\u751F\u63D0\u793A\u6587\u5B57\uFF0C\u4E0D\u6539\u53D8\u5DE5\u5177\u6743\u9650\u3001\u5BA1\u6279\u673A\u5236\u3001\u539F\u751F\u5BF9\u8BDD\u6216\u5176\u4ED6\u6A21\u5757\u7684 context \u5185\u5BB9\u3002\u4F4D\u7F6E\u548C\u5C01\u88C5\u7531 DSH \u7BA1\u7406\u3002\u5173\u95ED\u4E0D\u5220\u9664\u5386\u53F2\u4E2D\u5DF2\u6709\u5FEB\u7167\uFF1B\u540E\u7EED\u8BF7\u6C42\u6309\u539F\u751F\u5FEB\u7167\u89C4\u5219\u66F4\u65B0\u3002", "Controls DSH prompt text only, retaining tool permissions, approval enforcement, conversation history and other modules\u2019 context. DSH owns placement and framing. Existing historical snapshots remain; later requests use native snapshot updates."],
  contextMasterHint: ["\u603B\u5F00\u5173\u53EA\u7BA1\u7406 sandbox:policy\u3001approval:policy\u3001subagent:delegation\u3002\u603B\u5F00\u5173\u5173\u95ED\u65F6\uFF0C\u5B50\u9879\u8BBE\u7F6E\u4FDD\u7559\u4F46\u6682\u4E0D\u53D1\u9001\u3002\u5176\u4ED6\u6765\u6E90\u4FDD\u7559\uFF0C\u6709\u5269\u4F59 context \u65F6\u5C01\u88C5\u6587\u5B57\u4ECD\u4F1A\u51FA\u73B0\u3002", "The master covers only sandbox:policy, approval:policy and subagent:delegation. When off, child settings are retained but not sent. Other sources remain; framing remains whenever any context survives."],
  contextControlled: ["\u539F\u751F\u4E0A\u4E0B\u6587 \xB7 \u4EC5\u63A7\u5236\u53D1\u9001\u5F00\u5173", "Native context \xB7 transmission toggle only"],
  contextPreview: ["DSH \u539F\u751F\u8FD0\u884C\u73AF\u5883\u63D0\u793A", "DSH runtime environment prompts"],
  contextIncluded: ["\u672C\u6B21\u4FDD\u7559", "Included"],
  contextExcluded: ["\u672C\u6B21\u5173\u95ED", "Disabled"],
  sourceIdentity: ["\u6309\u6765\u6E90\u6761\u76EE\u8EAB\u4EFD", "Per source entry"],
  backend: ["\u63A5\u5165\u65B9\u5F0F", "Backend"],
  backendNative: ["\u6807\u51C6\u7248 \xB7 \u5B98\u65B9\u63A5\u53E3", "Standard \xB7 public interfaces"],
  backendCore: ["\u8FDB\u9636\u7248 \xB7 \u6838\u5FC3\u6269\u5C55", "Advanced \xB7 core extension"],
  "native-roles": ["\u9884\u8BBE\u8EAB\u4EFD\u4F18\u5148", "Preset roles first"],
  "native-slots": ["\u9884\u8BBE\u63D2\u69FD\u4F18\u5148", "Preset slots first"],
  nativeRolesHint: ["\u6309\u9884\u8BBE\u6761\u76EE\u7684 system/user \u8EAB\u4EFD\u5206\u7EC4\uFF1Bsystem \u653E\u5728\u5386\u53F2\u524D\uFF0Cuser \u6309\u6295\u9012\u65B9\u5F0F\u653E\u5728\u5386\u53F2\u4E4B\u540E\u3002\u9884\u8BBE\u4E0E\u4E16\u754C\u4E66\u7684\u6761\u76EE\u89D2\u8272\u4E0D\u53D7\u6574\u5757\u89D2\u8272\u8986\u76D6\uFF1B\u540C\u4E00\u6295\u9012\u533A\u57DF\u5185\u4F18\u5148\u9075\u5FAA\u9884\u8BBE\u63D2\u69FD\uFF0C\u5176\u6B21\u6761\u76EE\u987A\u5E8F\uFF0C\u518D\u6B21\u6A21\u5757\u987A\u5E8F\u3002\u539F\u751F\u5386\u53F2\u4E0E\u8F93\u5165\u4FDD\u7559\u3002", "Group preset entries by authored system/user role. System content precedes history; user content follows history through the selected delivery. Module overrides do not replace preset or worldbook entry roles. Within a delivery region, preset slots precede entry order, then module order. Native history/input remain."],
  nativeSlotsHint: ["\u9884\u8BBE\u6B63\u6587\u53CA\u5F15\u7528\u5185\u5BB9\u6309\u9884\u8BBE\u63D2\u69FD\u6392\u5217\uFF1B\u8FD9\u4E9B\u5185\u5BB9\u53CA\u4E16\u754C\u4E66\u6DF1\u5EA6 0/1 \u4F1A\u9002\u914D system/user\u3002\u6DF1\u5EA6 0 \u5728\u539F\u751F\u5386\u53F2\u540E\uFF0C1 \u5728\u5386\u53F2\u524D\uFF1B\u66F4\u5927\u6DF1\u5EA6\u4FDD\u7559\u5E76\u8FD1\u4F3C\u5904\u7406\u3002\u72EC\u7ACB\u5185\u5BB9\u4FDD\u7559\u81EA\u8EAB\u89D2\u8272\u548C\u6295\u9012\u65B9\u5F0F\u3002system \u53EA\u80FD\u5728\u5386\u53F2\u524D\uFF1B\u672B\u5C3E\u63D0\u9192\u8BF7\u660E\u786E\u8BBE\u4E3A user\u3001pre-step\u3002\u8BF7\u5728\u5F53\u524D\u8D44\u6E90\u5E03\u5C40\u4E2D\u79FB\u52A8\u5B8C\u6574\u8FDE\u7EED\u5757\u3002", "Preset text and references follow preset slots; these and worldbook depths 0/1 adapt system/user roles. Depth 0 follows native history; 1 precedes it. Larger depths are retained and approximated. Independent content keeps its role and delivery. System stays before history; for a final reminder explicitly choose user and pre-step. Move complete contiguous blocks in the current resource layout."],
  placementPending: ["\u6B63\u5728\u68C0\u67E5\u9884\u8BBE\u5F15\u7528\u2026", "Checking preset references\u2026"],
  placementFailed: ["\u65E0\u6CD5\u68C0\u67E5\u5F15\u7528\uFF0C\u8BF7\u91CD\u8BD5\u9884\u89C8\uFF1A", "Could not check references; retry preview: "],
  controlPreset: ["\u63D2\u69FD\u6216\u6DF1\u5EA6\u8FB9\u754C\u63A7\u5236 \xB7 \u4F4D\u7F6E\u9501\u5B9A", "Slot or depth boundary controlled \xB7 position locked"],
  controlMixed: ["\u90E8\u5206\u53D7\u63D2\u69FD\u6216\u6DF1\u5EA6\u8FB9\u754C\u63A7\u5236 \xB7 \u4EC5\u79FB\u52A8\u72EC\u7ACB\u90E8\u5206", "Partly slot or depth controlled \xB7 move independent content only"],
  controlIndependent: ["\u72EC\u7ACB\u5185\u5BB9 \xB7 \u6309\u89D2\u8272\u8FB9\u754C\u79FB\u52A8", "Independent content \xB7 move within role boundaries"],
  controlNative: ["\u539F\u751F\u8FB9\u754C \xB7 \u7531\u9884\u8BBE\u63D2\u69FD\u51B3\u5B9A", "Native boundary \xB7 follows preset slots"],
  controlEmpty: ["\u5F53\u524D\u65E0\u72EC\u7ACB\u5185\u5BB9", "No independent content currently"],
  nativeWorldRole: ["\u7531\u4E16\u754C\u4E66\u5404\u6761\u76EE\u51B3\u5B9A", "Per worldbook entry"],
  nativeSlotRole: ["\u6309\u63D2\u69FD\u6216\u6DF1\u5EA6\u8FB9\u754C\u9002\u914D", "Adapted to slot or depth boundary"],
  nativeDepthBoundary: ["\u6DF1\u5EA6\u6620\u5C04", "Depth mapping"],
  "before-history": ["\u539F\u751F\u5386\u53F2\u524D", "Before native history"],
  "after-history": ["\u539F\u751F\u5386\u53F2\u540E", "After native history"],
  worldSlotMissing: ["\u7F3A\u5C11\u9884\u8BBE\u951A\u70B9\uFF0C\u6CBF\u7528\u539F\u6709\u524D\u540E\u4F4D\u7F6E", "Missing preset anchor; using the existing before/after fallback"],
  nativeDepthApproximated: ["\u672A\u91C7\u7528\u5386\u53F2\u6DF1\u5EA6\uFF0C\u5DF2\u6309\u5F53\u524D\u6A21\u5F0F\u6392\u5217", "History depth not applied; placed by the selected mode"],
  nativeRoleChanged: ["\u89D2\u8272\u8C03\u6574", "Role adjusted"],
  nativeDeliveryChanged: ["\u6295\u9012\u8C03\u6574\u4E3A pre-step", "Delivery changed to pre-step"],
  nativeSlotsAbsent: ["\u9884\u8BBE\u672A\u5F15\u7528\u5386\u53F2\u6216\u672C\u6B65\u8F93\u5165\uFF0C\u5DF2\u6309\u8EAB\u4EFD\u4F18\u5148\u6392\u5217\u3002", "No preset history/input reference; using roles-first ordering."],
  nativePresetRole: ["\u7531\u9884\u8BBE\u5404\u6761\u76EE\u51B3\u5B9A", "Per preset entry"],
  nativeOrderChanged: ["\u5DF2\u6309\u539F\u751F\u8FB9\u754C\u8C03\u6574\u987A\u5E8F\uFF0C\u4EE5\u4E0B\u9884\u89C8\u662F\u8C03\u6574\u540E\u7684\u7ED3\u679C\u3002", "Order adjusted to native boundaries; the preview below shows the resulting order."],
  nativeHint: ["system \u6A21\u5757\u6309\u5B98\u65B9\u63A5\u53E3\u66F4\u65B0\uFF1Buser \u8D21\u732E\u53EA\u80FD\u8FFD\u52A0\u5230\u5DF2\u6709\u5386\u53F2\u4E4B\u540E\uFF0C\u4F7F\u7528\u6301\u4E45 context \u6216 pre-step\u3002\u539F\u751F\u5386\u53F2\u4E0E\u672C\u6B65\u8F93\u5165\u5FC5\u987B\u4FDD\u7559\uFF1B\u9884\u8BBE\u804A\u5929\u63D2\u69FD\u548C\u6761\u76EE\u89D2\u8272\u4E0D\u51B3\u5B9A\u6807\u51C6\u7248\u6A21\u5757\u4F4D\u7F6E\u3002", "System modules use official updates; new user contributions follow existing history through durable context or pre-step. Native history/input remain enabled. Preset chat slots and authored roles do not control standard module placement."],
  coreHint: ["\u6B64\u7B56\u7565\u8981\u6C42\u53EF\u9009\u6838\u5FC3\u88C5\u914D\u6269\u5C55\u4E0E\u914D\u5957 DSH \u6838\u5FC3\uFF1B\u6807\u51C6\u5B89\u88C5\u4E0D\u4F1A\u81EA\u52A8\u542F\u7528\u3002", "This strategy requires the optional core assembly extension and its prepared DSH core. Standard installation does not enable it."],
  delivery: ["user \u5199\u5165\u65B9\u5F0F", "User delivery"],
  context: ["\u5185\u5BB9\u53D8\u5316\u65F6\u5199\u5165\u4E0A\u4E0B\u6587\u5FEB\u7167", "Context snapshot when content changes"],
  "pre-step": ["\u6BCF\u4E2A\u5B9E\u9645\u6A21\u578B\u6B65\u9AA4\u5199\u5165\u6D88\u606F", "Message at each actual model step"],
  nativeRetentionHint: ["\u4E24\u79CD user \u5199\u5165\u65B9\u5F0F\u90FD\u4F1A\u8FDB\u5165 DSH \u5386\u53F2\uFF1B\u5173\u95ED\u6765\u6E90\u505C\u6B62\u540E\u7EED\u8D21\u732E\uFF0C\u65E7\u6B63\u6587\u4FDD\u7559\u3002", "Both user delivery modes enter DSH history. Disabling stops future contributions; earlier text remains."],
  "harness:identity": ["DSH \u8EAB\u4EFD\u6307\u4EE4", "DSH identity"],
  "deployment:persona-prefix": ["\u90E8\u7F72\u524D\u7F6E\u6307\u4EE4", "Deployment prefix"],
  "deployment:persona-suffix": ["\u90E8\u7F72\u540E\u7F6E\u6307\u4EE4", "Deployment suffix"],
  "rp:policy": ["Tavern \u89D2\u8272\u626E\u6F14\u89C4\u5219", "Tavern roleplay policy"],
  "tavern.mvu/state": ["MVU \u72B6\u6001\u4E0E\u66F4\u65B0\u6307\u4EE4", "MVU state and update instructions"],
  main: ["\u4E3B\u63D0\u793A\u8BCD", "Main prompt"],
  jailbreak: ["\u540E\u7F6E\u6307\u4EE4", "Post-history instructions"],
  charDescription: ["\u89D2\u8272\u63CF\u8FF0", "Character description"],
  charPersonality: ["\u89D2\u8272\u6027\u683C", "Character personality"],
  dialogueExamples: ["\u5BF9\u8BDD\u793A\u4F8B", "Dialogue examples"],
  personaDescription: ["\u7528\u6237\u8BBE\u5B9A", "User persona"],
  contentMode: ["\u5185\u5BB9\u65B9\u5F0F", "Content mode"],
  sourceMode: ["\u6765\u6E90\u5185\u5BB9", "Source content"],
  textMode: ["\u624B\u586B\u5185\u5BB9\uFF08\u6765\u6E90\u89E3\u6790\uFF09", "User text (source parser)"],
  "dsh.text": ["DSH \u81EA\u5B9A\u4E49\u6587\u672C", "DSH custom text"],
  retry: ["\u91CD\u8BD5", "Retry"],
  cancel: ["\u53D6\u6D88", "Cancel"],
  confirm: ["\u786E\u8BA4", "Confirm"],
  withdrawnPreset: ["\u8BE5\u5185\u7F6E\u7B56\u7565\u5DF2\u4E0D\u5728\u5F53\u524D\u76EE\u5F55\u4E2D\u3002\u6B64\u4F1A\u8BDD\u5DF2\u5E94\u7528\u7684\u65E7\u914D\u7F6E\u4ECD\u4FDD\u7559\uFF1B\u66F4\u6539\u65F6\u8BF7\u9009\u62E9\u5F53\u524D\u53EF\u7528\u7B56\u7565\u3002", "This built-in strategy is no longer in the current catalog. This session retains its applied configuration; choose an available strategy to change it."],
  placementTip: ["\u5C0F\u8D34\u58EB\uFF1A\u5982\u679C\u6A21\u578B\u51FA\u73B0\u6389\u683C\u5F0F\u3001\u4E0D\u9075\u5FAA\u6307\u4EE4\u7B49\u95EE\u9898\uFF0C\u53EF\u4EE5\u5C1D\u8BD5\u5C06\u76F8\u5173\u7684\u683C\u5F0F\u8981\u6C42\u6216\u884C\u4E3A\u6307\u4EE4\u540E\u7F6E\uFF0C\u5E76\u901A\u8FC7\u88C5\u914D\u7ED3\u679C\u786E\u8BA4\u5B9E\u9645\u4F4D\u7F6E\u3002", "Tip: If the model drops formatting or misses instructions, try placing the relevant format requirements or behavior instructions later, then check their actual position in the assembly result."],
  librarySection: ["\u7B56\u7565\u5E93", "Strategy library"],
  applicationSection: ["\u4F1A\u8BDD\u5E94\u7528", "Session application"],
  rulesSection: ["\u88C5\u914D\u89C4\u5219\u4E0E\u9884\u89C8", "Assembly rules and preview"],
  interfaceSettings: ["\u754C\u9762\u8BBE\u7F6E", "Interface settings"],
  createSession: ["\u4F7F\u7528\u6B64\u7B56\u7565\u65B0\u5EFA\u4F1A\u8BDD", "Create a session with this strategy"],
  session: ["\u4F1A\u8BDD", "Session"],
  newSession: ["\u65B0\u4F1A\u8BDD", "New Session"],
  disable: ["\u5173\u95ED\u7B56\u7565\uFF0C\u4F7F\u7528 DSH \u9ED8\u8BA4", "Disable; use DSH default"],
  "additional-phi": ["\u7B56\u7565\u8FFD\u52A0\u7684\u540E\u7F6E\u6307\u4EE4", "Additional strategy instructions"],
  description: ["\u89D2\u8272\u63CF\u8FF0", "Character description"],
  personality: ["\u89D2\u8272\u6027\u683C", "Character personality"],
  scenario: ["\u573A\u666F", "Scenario"],
  examples: ["\u5BF9\u8BDD\u793A\u4F8B", "Dialogue examples"],
  system: ["\u7CFB\u7EDF\u6307\u4EE4", "System instructions"],
  user: ["\u7528\u6237", "User"],
  assistant: ["\u52A9\u624B", "Assistant"],
  tool: ["\u5DE5\u5177\u7ED3\u679C", "Tool result"],
  greeting: ["\u5F00\u573A\u767D\u53C2\u8003", "Greeting reference"],
  depth_prompt: ["\u89D2\u8272\u6DF1\u5EA6\u63D0\u793A", "Character depth prompt"],
  defaultHint: ["\u5185\u7F6E\u7B56\u7565\u4E0D\u80FD\u6539\u540D\u6216\u5220\u9664\uFF1B\u4FEE\u6539\u89C4\u5219\u540E\u4FDD\u5B58\u4E3A\u526F\u672C\u3002", "Built-ins cannot be renamed or deleted; save rule changes as a copy."],
  dropHere: ["\u677E\u5F00\u4EE5\u79FB\u52A8\uFF1A", "Drop to move: "],
  draftPreviewScope: ["\u4EE5\u4E0B\u662F\u5F53\u524D\u5F00\u573A\u8349\u7A3F\u7684\u903B\u8F91\u6392\u5217\uFF0C\u4F7F\u7528\u6240\u9009\u8D44\u6E90\u4E0E\u8349\u7A3F\u53D8\u91CF\u3002\u5C1A\u65E0\u539F\u751F\u5386\u53F2\uFF0C\u4E0D\u542B\u5F85\u53D1\u9001\u8F93\u5165\uFF1B\u5B9E\u9645\u8BF7\u6C42\u9700\u53D1\u9001\u540E\u67E5\u770B\u3002", "This shows the opening draft\u2019s logical order using its selected resources and variables. There is no native history yet; pending input is excluded. Actual requests are available after sending."],
  nativePreviewScope: ["\u4EE5\u4E0B\u662F\u5F53\u524D\u7B56\u7565\u7684\u903B\u8F91\u6392\u5217\uFF0C\u4E0D\u662F\u5B8C\u6574\u7684\u5B9E\u9645\u8BF7\u6C42\u3002DSH \u4F1A\u4FDD\u5B58 user \u8D21\u732E\uFF1B\u540E\u7EED\u8BF7\u6C42\u8FD8\u53EF\u80FD\u5305\u542B\u5DF2\u4FDD\u5B58\u7684\u65E7\u8D21\u732E\u3002\u9884\u89C8\u4E0D\u542B\u5F85\u53D1\u9001\u8F93\u5165\u3002", "This shows the current strategy\u2019s logical order, not a complete actual request. DSH saves user contributions, so later requests may also contain earlier contributions. Pending input is excluded."],
  logicalMessages: ["\u903B\u8F91\u6392\u5217", "Logical order"],
  "source-unrecorded": ["\u6765\u6E90\u672A\u8BB0\u5F55", "Source not recorded"],
  "historical-system-update": ["\u5386\u53F2 system \u5FEB\u7167", "Historical system snapshot"],
  historicalSystemHint: ["\u6B64\u524D\u4FDD\u7559\u7684\u6709\u6548\u7CFB\u7EDF\u6307\u4EE4\uFF1B\u6765\u6E90\u660E\u7EC6\u672A\u8BB0\u5F55\u3002", "Effective system instructions retained from an earlier step; source details were not recorded."],
  "native-context-framing": ["\u539F\u751F\u4E0A\u4E0B\u6587\u5C01\u88C5", "Native context framing"],
  sourceNameUnrecorded: ["\u5F53\u65F6\u7684\u6761\u76EE\u540D\u79F0\u672A\u8BB0\u5F55\u3002", "Original item name not recorded."],
  sourceNameCurrent: ["\u540D\u79F0\u6765\u81EA\u5F53\u524D\u9884\u8BBE\uFF1B\u6B63\u6587\u6765\u81EA\u5F53\u65F6\u8BF7\u6C42\u3002", "Name from the current preset; body from the recorded request."],
  sourceFieldsUnrecorded: ["\u6765\u6E90\u5B57\u6BB5\u672A\u8BB0\u5F55\uFF1B\u4EC5\u6709\u5F53\u65F6\u4FDD\u5B58\u7684\u6BB5\u843D\u540D\u79F0\u3002", "Source fields not recorded; only the recorded section name is available."],
  actual: ["\u67E5\u770B\u6700\u8FD1\u5B9E\u9645\u8BF7\u6C42", "View latest actual request"],
  noActual: ["\u6682\u65E0\u53EF\u8BFB\u53D6\u7684\u5B9E\u9645\u8BF7\u6C42\u8BB0\u5F55", "No readable actual request record yet"],
  noActualNative: ["\u6682\u65E0\u53EF\u8BFB\u53D6\u7684\u539F\u751F\u5B9E\u9645\u8BF7\u6C42\u8BB0\u5F55\uFF1B\u66F4\u65B0\u524D\u672A\u8BB0\u5F55\u8BF7\u6C42\u8FB9\u754C\u7684\u4F1A\u8BDD\uFF0C\u8BF7\u5728\u4E0B\u4E00\u6B21\u53D1\u9001\u540E\u67E5\u770B\u3002", "No readable native request record yet. If this session predates request capture, view it after the next send."],
  actualNotice: ["\u4EE5\u4E0B\u662F\u8F68\u8FF9\u4FDD\u5B58\u7684\u5B9E\u9645\u8BF7\u6C42\uFF0C\u4FEE\u6539\u5F53\u524D\u9884\u8BBE\u4E0D\u4F1A\u6539\u53D8\u5B83\u3002", "This is the recorded request. Editing the preset does not change it."],
  addSource: ["\u6DFB\u52A0\u6A21\u5757\uFF08\u5F53\u524D\u6709\u72EC\u7ACB\u5185\u5BB9\uFF09", "Add a module (current independent content)"],
  chooseSource: ["\u9009\u62E9\u6765\u6E90\u2026", "Choose source\u2026"],
  sourceHelp: ["\u6A21\u5757\u53EA\u5217\u51FA\u5F53\u524D\u63D0\u4F9B\u72EC\u7ACB\u5185\u5BB9\u7684\u6765\u6E90\u3002\u5206\u6563\u5185\u5BB9\u53EF\u901A\u8FC7\u6587\u672C\u89E3\u6790\u5668\u5F15\u7528\uFF1B\u586B\u5199\u6587\u672C\u540E\u4FDD\u5B58\u89C4\u5219\u5E76\u5E94\u7528\u5230\u5F53\u524D\u4F1A\u8BDD\u3002", "Modules list sources with independent content. Reference dispersed content through a text parser, save the rules, then apply them to the current session."],
  missingSource: ["\u6765\u6E90\u63D2\u4EF6\u672A\u5B89\u88C5\u6216\u672A\u6CE8\u518C\uFF1B\u672C\u6B21\u8BF7\u6C42\u8DF3\u8FC7\u6B64\u6A21\u5757\u3002", "Source unavailable; this module is omitted from the request."],
  title: ["\u63D0\u793A\u8BCD\u88C5\u914D\u7B56\u7565", "Prompt assembly strategy"],
  intro: ["\u5B89\u6392\u5185\u5BB9\u5982\u4F55\u8FDB\u5165\u6BCF\u6B21\u6A21\u578B\u8BF7\u6C42\u3002\u9884\u89C8\u5F53\u524D\u8D44\u4EA7\u3001\u5B8F\u5F15\u7528\u548C\u5B9E\u9645\u987A\u5E8F\u3002", "Arrange each model request. Preview assets, macro references and message order."],
  import: ["\u5BFC\u5165", "Import"],
  export: ["\u5BFC\u51FA", "Export"],
  create: ["\u521B\u5EFA", "Create"],
  copy: ["\u53E6\u5B58\u4E3A", "Save as"],
  save: ["\u4FDD\u5B58\u89C4\u5219", "Save rules"],
  remove: ["\u5220\u9664", "Delete"],
  select: ["\u9009\u62E9\u88C5\u914D\u7B56\u7565", "Assembly strategy"],
  name: ["\u540D\u79F0", "Name"],
  apply: ["\u5E94\u7528\u5230\u5F53\u524D\u4F1A\u8BDD", "Apply to this session"],
  applied: ["\u5F53\u524D\u5E94\u7528", "Applied"],
  legacy: ["DSH \u9ED8\u8BA4\u7B56\u7565", "DSH default strategy"],
  reset: ["\u5E94\u7528\u9ED8\u8BA4\u88C5\u914D\u7B56\u7565", "Apply default strategy"],
  preview: ["\u88C5\u914D\u7ED3\u679C", "Assembly result"],
  rules: ["\u8D44\u6E90\u4F4D\u7F6E", "Resource positions"],
  expanded: ["\u5C55\u5F00\u9884\u89C8", "Expanded preview"],
  add: ["\u6DFB\u52A0", "Add"],
  source: ["\u6765\u6E90", "Source"],
  stability: ["\u7A33\u5B9A\u6027", "Stability"],
  lifetime: ["\u4FDD\u7559\u65B9\u5F0F", "Retention"],
  request: ["\u6BCF\u6B21\u91CD\u65B0\u88C5\u914D", "Rebuild each request"],
  snapshot: ["\u7D2F\u79EF\u5FEB\u7167\u4F9B\u540E\u7EED\u8BF7\u6C42\u4F7F\u7528", "Retain snapshots for later requests"],
  retained: ["\u5DF2\u4FDD\u5B58\u7684\u5FEB\u7167", "Saved snapshot"],
  nativeRetention: ["\u7531 DSH \u4FDD\u5B58\u4E0E\u63D0\u4F9B", "Saved and supplied by DSH"],
  native: ["\u539F\u751F\u5386\u53F2", "Native history"],
  preserve: ["\u4FDD\u7559\u539F\u59CB\u89D2\u8272", "Preserve original role"],
  depth: ["\u5386\u53F2\u6DF1\u5EA6\uFF08\u7559\u7A7A\u4F7F\u7528\u5217\u8868\u4F4D\u7F6E\uFF09", "History depth (blank uses list position)"],
  asset: ["\u8D44\u4EA7\u4FEE\u6539\u65F6\u53D8\u5316", "Changes with asset"],
  conversation: ["\u968F\u5BF9\u8BDD\u53D8\u5316", "Changes with conversation"],
  evaluation: ["\u6BCF\u6B21\u6C42\u503C\u53EF\u80FD\u53D8\u5316", "May change on evaluation"],
  assembly: ["\u7531\u5B98\u65B9\u88C5\u914D\u51B3\u5B9A", "Determined by core assembly"],
  saved: ["\u5DF2\u4FDD\u5B58\uFF1B\u5E94\u7528\u540E\u5F71\u54CD\u540E\u7EED\u8BF7\u6C42", "Saved; apply to affect future requests"],
  appliedStatus: ["\u5DF2\u5E94\u7528\u5230\u5F53\u524D\u4F1A\u8BDD", "Applied to this session"],
  unavailable: ["\u5BBF\u4E3B\u5C1A\u672A\u652F\u6301\u8BF7\u6C42\u88C5\u914D\u534F\u8BAE\u3002\u53EF\u4EE5\u7F16\u8F91\u548C\u9884\u89C8\uFF1B\u5E94\u7528\u524D\u9700\u5B89\u88C5\u6838\u5FC3\u6269\u5C55\u3002", "Editing and preview are available. Applying requires the request assembly core extension."],
  previewScope: ["\u9884\u89C8\u4F7F\u7528\u5F53\u524D\u8D44\u4EA7\u4E0E\u53EF\u8BFB\u53D6\u5386\u53F2\uFF0C\u4E0D\u542B\u5F85\u53D1\u9001\u8F93\u5165\uFF1B\u968F\u673A\u5B8F\u4F7F\u7528\u56FA\u5B9A\u6837\u4F8B\u3002\u5B9E\u9645\u8BF7\u6C42\u4EE5\u8F68\u8FF9\u4E2D\u7684\u51BB\u7ED3\u7ED3\u679C\u4E3A\u51C6\u3002", "Preview uses current assets and available history, without pending input. Random macros use a fixed sample. Recorded requests contain the frozen result."],
  deferredSelection: ["\u5E94\u7528\u5230\u5F53\u524D\u5F00\u573A\u914D\u7F6E\uFF1B\u9996\u6B21\u53D1\u9001\u65F6\u63A5\u5165\u4F1A\u8BDD\u3002\u53EF\u9884\u89C8\u5F53\u524D\u5F00\u573A\u8D44\u6E90\uFF0C\u5B9E\u9645\u8BF7\u6C42\u9700\u53D1\u9001\u540E\u67E5\u770B\u3002", "Apply to the current opening configuration; it transfers on first send. Preview opening resources now; actual requests are available after sending."],
  noSession: ["\u8BF7\u5148\u6253\u5F00\u4F1A\u8BDD", "Open a session first"],
  loading: ["\u52A0\u8F7D\u4E2D\u2026", "Loading\u2026"],
  close: ["\u5173\u95ED", "Close"],
  up: ["\u4E0A\u79FB", "Move up"],
  down: ["\u4E0B\u79FB", "Move down"],
  text: ["\u5185\u5BB9", "Content"],
  role: ["\u6D88\u606F\u89D2\u8272", "Message role"],
  placement: ["\u653E\u7F6E\u7B56\u7565", "Placement"],
  st: ["\u9075\u5FAA\u9884\u8BBE\u63D2\u69FD\u4E0E\u6DF1\u5EA6", "Preset slots and depth"],
  stHelp: ["\u9884\u8BBE\u63D2\u69FD\uFF08ST marker\uFF09\u662F\u9884\u8BBE\u5217\u8868\u4E2D\u7684\u72EC\u7ACB\u6761\u76EE\uFF0C\u4F8B\u5982\u89D2\u8272\u63CF\u8FF0\u3001\u4E16\u754C\u4E66\u3001\u804A\u5929\u5386\u53F2\u3002\u5B8F\u5219\u5199\u5728\u6B63\u6587\u5185\uFF0C\u5982 {{description}}\u3002\u4E24\u8005\u90FD\u53EF\u5F15\u7528\u5185\u5BB9\uFF0C\u4F46\u63D2\u69FD\u51B3\u5B9A\u5217\u8868\u4F4D\u7F6E\uFF0C\u5B8F\u5728\u6B63\u6587\u4F4D\u7F6E\u5C55\u5F00\u3002", "ST markers are standalone preset slots, such as character description, world books and chat history. Macros such as {{description}} expand inside text. Both reference content, but slots occupy list positions while macros expand at their authored text position."],
  previewDepth: ["\u5386\u53F2\u6DF1\u5EA6", "History depth"],
  listPosition: ["\u6309\u5217\u8868\u4F4D\u7F6E", "List position"],
  emptyRequest: ["\u88C5\u914D\u7ED3\u679C\u4E3A\u7A7A\u3002\u8BF7\u542F\u7528\u6216\u586B\u5199\u81F3\u5C11\u4E00\u6761\u5185\u5BB9\u3002", "The assembled request is empty. Enable or fill at least one item."],
  systemOnly: ["\u5F53\u524D\u53EA\u6709\u7CFB\u7EDF\u6307\u4EE4\u3002DeepSeek \u7B49\u63A5\u53E3\u8FD8\u8981\u6C42\u975E\u7A7A\u7684\u5BF9\u8BDD\u6D88\u606F\uFF1B\u4EC5\u4F7F\u7528\u81EA\u5B9A\u4E49\u5185\u5BB9\u65F6\uFF0C\u8BF7\u5C06\u81F3\u5C11\u4E00\u6761\u7684\u89D2\u8272\u8BBE\u4E3A\u300C\u7528\u6237\u300D\u3002", "Only system instructions remain. APIs such as DeepSeek also require a nonempty conversation message. When using only custom content, set at least one item to User."],
  modules: ["\u6309\u6A21\u5757\u5217\u8868\u987A\u5E8F", "Module order"],
  removed: ["\u5378\u8F7D\u540E\u4E0D\u518D\u751F\u6210\uFF1B\u5DF2\u8BB0\u5F55\u6B63\u6587\u4ECD\u53EF\u8BFB", "Plugin required to generate; recorded content remains readable"],
  nativeSource: ["DSH \u539F\u751F\u63D0\u4F9B\uFF0C\u4E0D\u4F9D\u8D56 Tavern", "Provided by DSH, independent of Tavern"],
  recorded: ["\u53D1\u9001\u65F6\u4FDD\u5B58\u5230\u8BF7\u6C42\u8F68\u8FF9", "Recorded in request trace when sent"],
  locked: ["\u4F4D\u7F6E\u7531\u5F15\u7528\u6216\u6DF1\u5EA6\u89C4\u5219\u51B3\u5B9A", "Position owned by a reference or depth rule"],
  empty: ["\u8BF7\u751F\u6210\u9884\u89C8", "Generate a preview"],
  dirty: ["\u6709\u672A\u4FDD\u5B58\u4FEE\u6539", "Unsaved changes"],
  discard: ["\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF1F", "Discard unsaved changes?"],
  confirmDelete: ["\u5220\u9664\u8FD9\u4EFD\u88C5\u914D\u7B56\u7565\uFF1F", "Delete this preset?"],
  diagnostics: ["\u88C5\u914D\u8BCA\u65AD", "Assembly diagnostics"],
  tools: ["\u5DE5\u5177\u5B9A\u4E49\u4F7F\u7528\u72EC\u7ACB\u8BF7\u6C42\u5B57\u6BB5\uFF0C\u4E0D\u53C2\u4E0E\u6D88\u606F\u62D6\u62FD\u3002", "Tool definitions are a separate request field, not draggable messages."],
  result: ["\u8BF7\u6C42\u6D88\u606F", "Request messages"],
  audit: ["\u6BCF\u6B21\u91CD\u65B0\u88C5\u914D\uFF1A\u8F68\u8FF9\u4FDD\u7559\u5B9E\u9645\u8BF7\u6C42\uFF0C\u4F46\u4E0B\u6B21\u91CD\u65B0\u6C42\u503C\uFF0C\u4E0D\u7D2F\u79EF\u65E7\u526F\u672C\u3002\u7D2F\u79EF\u5FEB\u7167\uFF1A\u5185\u5BB9\u53D8\u5316\u65F6\u4FDD\u7559\u65B0\u526F\u672C\uFF0C\u5E76\u5E26\u5165\u540E\u7EED\u8BF7\u6C42\u3002\u539F\u751F\u7528\u6237\u6D88\u606F\u3001\u56DE\u590D\u548C\u5DE5\u5177\u7ED3\u679C\u4ECD\u7531 DSH \u4FDD\u5B58\uFF0C\u662F\u5426\u53D1\u9001\u7531\u539F\u751F\u5386\u53F2\u4E0E\u672C\u6B65\u8F93\u5165\u63A7\u5236\u3002", "Rebuild each request: the trace records the actual request, while later requests evaluate fresh content without accumulating copies. Retain snapshots: changed content adds a copy reused by later requests. DSH still saves native user messages, replies and tool results; history and current-input rules control whether they are sent."],
  contains: ["\u5305\u542B\u5185\u5BB9", "Included content"],
  contentOrigin: ["\u5185\u5BB9\u6765\u6E90", "Content origin"],
  editable: ["\u624B\u52A8\u7F16\u8F91", "Manual editing"],
  editAt: ["\u4FEE\u6539\u5165\u53E3", "Where to edit"],
  unknownContains: ["\u6765\u6E90\u672A\u58F0\u660E\u6A21\u5757\u5305\u542B\u54EA\u4E9B\u5B57\u6BB5\uFF1B\u8BF7\u5148\u9884\u89C8\u5B9E\u9645\u6B63\u6587\u3002", "The provider has not described its included fields; preview the actual content first."],
  unknownOrigin: ["\u6765\u6E90\u672A\u63D0\u4F9B\u8D44\u6E90\u4F4D\u7F6E\u8BF4\u660E\uFF1B\u9884\u89C8\u8282\u70B9\u663E\u793A\u5DF2\u8FD4\u56DE\u7684\u8D44\u6E90 ID\u3002", "The provider has not described resource locations; preview identifies returned resource IDs."],
  unknownEditable: ["\u6765\u6E90\u672A\u58F0\u660E\u6B63\u6587\u7F16\u8F91\u80FD\u529B\uFF0C\u4E0D\u80FD\u5728\u6B64\u76F4\u63A5\u4FEE\u6539\u3002", "The provider has not declared content editing support; content cannot be edited here."],
  unknownEditAt: ["\u6765\u6E90\u672A\u63D0\u4F9B\u7F16\u8F91\u5165\u53E3\uFF1B\u8BF7\u67E5\u9605\u8BE5\u6765\u6E90\u63D2\u4EF6\u7684\u6587\u6863\u3002", "The provider has not supplied an editing entry point; consult its documentation."],
  modulePreviewHelp: ["\u6253\u5F00\u300C\u88C5\u914D\u7ED3\u679C\u300D\uFF0C\u5C55\u5F00\u6A21\u5757\u67E5\u770B\u5B9E\u9645\u6B63\u6587\u3001\u8D44\u6E90 ID \u548C\u5B57\u6BB5\uFF1B\u9884\u89C8\u4E0D\u4F1A\u5199\u5165\u8D44\u6E90\u3002", "Open Assembly result and expand a node to inspect actual text, resource IDs and fields; preview does not write resources."],
  "tavern.text": ["Tavern \u6587\u672C\u89E3\u6790\u5668", "Tavern text parser"],
  tavernParserHelp: ["\u5148\u5BF9\u624B\u586B\u6587\u672C\u6267\u884C\u53D7\u9650 EJS\uFF0C\u518D\u5C55\u5F00\u89D2\u8272\u3001\u4E16\u754C\u4E66\u548C\u5386\u53F2\u5F15\u7528\uFF0C\u6700\u540E\u89E3\u6790 ST \u5B8F\u3002\u53EF\u6DF7\u7528\u8FD9\u4E9B\u8BED\u6CD5\uFF1B\u5F15\u7528\u5185\u5BB9\u4E0D\u4F1A\u518D\u6B21\u4F5C\u4E3A EJS \u6267\u884C\u3002ST setvar/getvar \u5728\u672C\u6B21\u88C5\u914D\u5185\u5171\u4EAB\u4E34\u65F6\u53D8\u91CF\uFF0C\u987A\u5E8F\u53EF\u80FD\u5F71\u54CD\u7ED3\u679C\u3002", "Authored text runs restricted EJS, then character/world-book/history references, then ST macros. These syntaxes can be mixed; referenced content is never reevaluated as EJS. ST setvar/getvar share temporary variables within this assembly, so order can affect results."],
  dshParserHelp: ["\u4EC5\u5C55\u5F00 DSH \u63D0\u4F9B\u7684 {{\u53D8\u91CF\u540D}}\uFF1B\u672A\u77E5\u53D8\u91CF\u62A5\u9519\u3002Tavern \u5B8F\u548C EJS \u8BF7\u4F7F\u7528 Tavern \u6587\u672C\u89E3\u6790\u5668\u3002", "Expands only DSH-provided {{variable}} values; unknown variables fail. Use the Tavern text parser for Tavern macros and EJS."],
  parser: ["\u6587\u672C\u89E3\u6790\u5668", "Text parser"],
  addText: ["\u6DFB\u52A0\u81EA\u5B9A\u4E49\u6587\u672C", "Add custom text"],
  "native-system": ["\u5B98\u65B9\u57FA\u7840\u6307\u4EE4", "Native instructions"],
  preset: ["\u9884\u8BBE\u6B63\u6587", "Preset content"],
  character: ["\u89D2\u8272\u8BBE\u5B9A", "Character"],
  persona: ["\u7528\u6237\u8BBE\u5B9A", "User persona"],
  worldbook: ["\u4E16\u754C\u4E66", "World books"],
  history: ["\u539F\u751F\u5386\u53F2", "Native history"],
  input: ["\u672C\u6B65\u8F93\u5165", "Current input"],
  phi: ["PHI \xB7 \u540E\u7F6E\u6307\u4EE4", "Post-history instructions"],
  custom: ["\u81EA\u5B9A\u4E49\u5185\u5BB9", "Custom content"]
};
function sourceColor(plugin) {
  if (!plugin) return "#999999";
  if (plugin === "DSH") return "#8192ad";
  if (plugin === "pmp-dsh-tavern" || plugin?.startsWith("pmp-dsh-tavern/")) return "#6495ed";
  let hash = 0;
  for (const c of plugin ?? "unknown") hash = hash * 31 + c.charCodeAt(0) | 0;
  return `hsl(${Math.abs(hash) % 360} 60% 62%)`;
}
async function request(fetcher, apiRoot, path = "", method = "GET", body) {
  const res = await fetcher(`${apiRoot}${path}`, { method, headers: { "Content-Type": "application/json" }, ...body === void 0 ? {} : { body: JSON.stringify(body) } });
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}
var assemblyCss = `
.dta-stage{position:absolute;top:var(--dta-content-top,84px);bottom:0;left:var(--dta-content-left,0px);width:var(--dta-center-width,100%);z-index:1;pointer-events:none;background:#0005;padding:8px;box-sizing:border-box;display:flex;justify-content:center}
.dta-stage.dta-standalone{inset:0;width:100%;z-index:100;padding:24px}.dta-launcher{font:inherit;color:inherit;border:1px solid currentColor;border-radius:8px;background:transparent;padding:7px 10px;cursor:pointer}.dta-standalone .dtv-assembly-screen{width:min(960px,100%)}.dta-section-title{font-size:15px;font-weight:600;margin:24px 0 16px;padding-top:20px;border-top:1px solid var(--dta-border)}.dta-content>.dta-section-title:first-child{margin-top:0;padding-top:0;border-top:0}.dta-interface-settings{margin-top:28px}.dta-toolbar.dta-session-controls{gap:16px 24px}.dta-session-controls label{display:flex;align-items:center;gap:12px;max-width:100%}.dtv-assembly-screen .dta-session-controls select{width:120px;flex-shrink:1}.dtv-assembly-screen .dta-session-controls label:first-child select{width:220px}@media(max-width:600px){.dta-session-controls label{flex-wrap:wrap}}
.dtv-assembly-screen{--dta-border:color-mix(in srgb,var(--dsw-alias-label-primary,#24252b) 32%,var(--dsw-alias-bg-base,#fff));position:relative;contain:paint;transform:translateZ(0);width:min(var(--dsh-composer-card-max-width,780px),100%);pointer-events:auto;display:flex;flex-direction:column;box-sizing:border-box;container-type:inline-size;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#24252b);border:1px solid var(--dta-border);border-radius:18px;box-shadow:0 18px 65px #0003;font:14px/1.55 system-ui;overflow:hidden}.dtv-assembly-screen *{box-sizing:border-box}
.dta-confirm-shade{position:absolute;inset:0;z-index:4;background:#0006;display:grid;place-items:center;padding:20px}.dta-confirm{background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dta-border);border-radius:14px;padding:24px;max-width:100%;width:360px;box-shadow:0 10px 40px #0004}.dta-confirm p{margin:0 0 20px}.dta-confirm .dta-toolbar{justify-content:flex-end;margin:0}
.dta-head{display:flex;justify-content:space-between;align-items:start;padding:20px 28px;border-bottom:1px solid var(--dta-border)}.dta-head{width:100%;max-width:calc(var(--dsh-composer-card-max-width,780px) + 56px);margin:auto}.dta-head h2{margin:0;font-size:22px}.dta-head p{margin:5px 0 0;opacity:.7}.dta-body{overflow:auto;padding:22px 28px 50px;flex:1}.dta-content{max-width:var(--dsh-composer-card-max-width,780px);margin:auto}.dta-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center}
.dtv-assembly-screen button,.dtv-assembly-screen select,.dtv-assembly-screen input:not([type=checkbox]),.dtv-assembly-screen textarea{font:inherit;color:inherit;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));border:1px solid var(--dta-border);border-radius:9px;padding:8px 12px;min-width:0}.dtv-assembly-screen select,.dtv-assembly-screen input:not([type=checkbox]){height:40px;line-height:22px;width:100%}.dtv-assembly-screen .dta-toolbar select{width:auto;max-width:100%}.dtv-assembly-screen button{cursor:pointer}.dtv-assembly-screen button:disabled{opacity:.45;cursor:default}.dtv-assembly-screen :focus-visible{outline:2px solid #4386dc;outline-offset:2px}.dtv-assembly-screen .primary{background:#347cd2;color:white;border-color:#347cd2}.dta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.dta-grid label{display:flex;flex-direction:column;gap:5px}.dta-notice{padding:12px 15px;border-radius:10px;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base));margin:12px 0;overflow-wrap:anywhere}.dta-notice[data-error=true]{color:#be4747}.dta-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0 14px}.dtv-assembly-screen .dta-tabs button[aria-pressed=true]{border-color:var(--dsw-alias-state-business-primary,#4d6bfe);box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary,#4d6bfe);color:var(--dsw-alias-state-business-primary,#4d6bfe)}
.dtv-assembly-screen select{appearance:none;-webkit-appearance:none;padding-right:40px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='m4 6 4 4 4-4' fill='none' stroke='%23787880' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;background-size:16px 16px}@media(forced-colors:active){.dtv-assembly-screen select{appearance:auto;-webkit-appearance:auto;background-image:none}}
.dta-row,.dta-position-row{border:1px solid var(--dta-border);border-left:5px solid var(--assembly-color);border-radius:14px;margin:10px 0;background:var(--dsw-alias-bg-base,#fff);overflow:hidden}.dta-row[data-dragover=true]{outline:2px solid #4386dc}.dta-summary{display:flex;align-items:center;gap:14px;padding:15px 17px;min-height:69px}.dta-summary input{width:20px;height:20px;accent-color:#2484ed}.dta-handle{cursor:grab;color:var(--dsw-alias-label-tertiary,#858993);font-size:22px;line-height:1}.dta-name{flex:1;font-size:17px;min-width:0;overflow-wrap:anywhere;cursor:pointer}.dta-summary-meta{display:grid;grid-template-columns:repeat(var(--dta-meta-columns,3),minmax(0,1fr));gap:12px;flex:0 0 318px;margin:0;font-size:12px;line-height:1.5}.dta-summary-meta dt{color:var(--dsw-alias-label-tertiary,#858993);font-size:11px}.dta-summary-meta dd{margin:3px 0 0;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.dta-detail{padding:4px 20px 20px;border-top:1px solid var(--dta-border)}.dta-properties>*,.dta-summary-meta>div{min-width:0}.dta-properties>*+*,.dta-summary-meta>div+div{border-left:1px solid var(--dsw-alias-state-business-primary,#4d6bfe);padding-left:14px}.dta-properties label,.dta-fields label{display:flex;flex-direction:column;gap:8px}.dta-fields{display:flex;flex-direction:column;gap:16px;margin:16px 0}.dta-fields .dta-field-name{max-width:320px}.dta-preview-depth{margin:12px 0}.dta-properties{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:16px 0}.dta-detail textarea{width:100%;min-height:130px;resize:vertical}.dtv-assembly-screen pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 ui-monospace,monospace;max-height:360px;overflow:auto}.dta-child{margin:10px 0;padding:10px 14px;border-left:3px solid #ae73cf;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base));border-radius:6px}.dtv-assembly-screen small{display:block;opacity:.7;overflow-wrap:anywhere}
.dta-row[data-dragging=true],.dta-sort-item[data-dragging=true]{height:4px;min-height:4px;margin:5px 10px;border:0;border-radius:999px;background:var(--dsw-alias-state-business-primary,#4d6bfe);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 25%,transparent)}.dta-row[data-dragging=true]>*,.dta-sort-item[data-dragging=true]>*{opacity:0}.dta-drop-placeholder{min-height:42px;border:2px dashed var(--dsw-alias-state-business-primary,#4d6bfe);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4d6bfe) 7%,transparent);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-state-business-primary,#4d6bfe);pointer-events:none}.dtv-assembly-screen .dta-handle{touch-action:none;user-select:none;background:transparent;border:0;padding:2px}.dta-origin{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px}.dta-legend{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}.dta-legend span{border-left:4px solid var(--assembly-color);padding-left:6px;font-size:12px}
.dta-resource-layout{display:flex;flex-direction:column;gap:16px;min-width:0}.dta-resource-layout h3,.dta-resource-layout p{margin:0}.dta-resource-layout>h3:not(:first-child){padding-top:8px}.dta-resource-layout>button{align-self:flex-start}.dta-resource-policy{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px 16px}.dta-resource-policy label,.dta-resource-body>label,.dta-position-menu label{display:grid;gap:8px;min-width:0}.dta-resource-blocks{display:grid;gap:12px;min-width:0}.dta-resource-blocks>.dta-row{margin:0}.dta-resource-layout .dta-summary{display:grid;grid-template-columns:24px minmax(0,1fr);gap:4px 12px;padding:16px 18px;min-height:0}.dta-resource-layout .dta-summary>.dta-handle{grid-row:1 / span 3}.dta-resource-layout .dta-summary>small{grid-column:2}.dta-resource-body{display:grid;gap:12px;padding:0 18px 18px;min-width:0}.dta-resource-body .dta-notice{margin:0;padding:10px 12px}.dta-resource-body details[open]>summary{margin-bottom:10px}.dta-resource-body .dta-child+.dta-child{margin-top:10px}.dta-resource-layout summary{cursor:pointer;overflow-wrap:anywhere}.dta-resource-body .dta-child{margin:0;padding:12px 14px}.dta-resource-body pre{margin:8px 0 0}.dta-resource-layout>.dta-notice{margin:0}.dta-resource-layout>.dta-notice>button{margin-top:12px}.dta-layout-override{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;margin-top:12px}.dta-layout-override>code{flex:0 1 auto;min-width:0;max-width:100%;overflow-wrap:anywhere}.dta-layout-override>button{flex:0 0 auto}
.dta-sort-item{min-width:0}.dta-sort-item[data-dragging=true]{overflow:hidden;pointer-events:none}.dtv-assembly-screen .dta-sort-handle{display:flex;align-items:center;justify-content:center;width:28px;min-height:32px;padding:2px;border:0;border-radius:0;background:transparent;color:var(--dsw-alias-label-secondary,#424957);cursor:grab}.dta-sort-handle .dta-grip-icon{font-size:22px;line-height:1}.dtv-assembly-screen .dta-sort-handle:not(:disabled):hover{color:var(--dsw-alias-state-business-primary,#4386dc)}.dta-sort-handle:active{cursor:grabbing}.dta-drop-placeholder{padding:10px 14px;text-align:center;overflow-wrap:anywhere;font-weight:600}.dta-sort-item[data-dragging=true]>*{pointer-events:none}
.dta-priorities{display:grid;gap:8px}.dta-priority-row{display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--dta-border);border-radius:10px}.dta-priority-row button{padding:4px 9px}.dta-priority-row[data-drop-side=before]{box-shadow:0 -3px #4386dc}.dta-priority-row[data-drop-side=after]{box-shadow:0 3px #4386dc}.dta-result-tools{display:flex;justify-content:flex-end;margin:-4px 0 14px}.dta-position-list{display:grid;gap:12px}.dta-position-row{margin:0}.dta-position-summary{display:grid;grid-template-columns:28px 20px minmax(150px,1fr) minmax(0,1.65fr);gap:12px;align-items:center;padding:14px 16px}.dta-position-summary input{width:18px;height:18px;margin:0}.dta-position-name{min-width:0;overflow-wrap:anywhere}.dta-position-name strong{font-size:17px}.dta-position-meta{min-width:0}.dta-resource-layout .dta-position-note{margin-top:8px}.dta-position-meta .dta-position-actions{margin-top:10px}.dta-preview-meta{flex:0 1 65%;min-width:0}.dta-position-actions{display:flex;gap:8px;flex-wrap:wrap}.dta-position-actions button{padding:5px 10px}.dta-source-settings{margin-top:24px}.dta-position-decisions{margin:16px 0;padding:14px 16px;border:1px solid var(--dta-border);border-radius:10px}.dta-position-decisions li{margin:7px 0}.dta-position-row[data-drop-side=before]{box-shadow:0 -3px #4386dc}.dta-position-row[data-drop-side=after]{box-shadow:0 3px #4386dc}.dta-position-row[data-resource-dragging=true]{opacity:.55}.dta-resource-origins{grid-column:2;display:flex;flex-wrap:wrap;gap:6px 12px;margin:4px 0;font-size:12px;color:var(--dsw-alias-label-secondary)}.dta-resource-origin{border-left:3px solid var(--assembly-color);padding-left:7px;overflow-wrap:anywhere}.dta-position-menu>p{margin-bottom:12px}.dta-resource-blocks>.dta-row[data-drop-side=before]{box-shadow:0 -3px #4386dc}.dta-resource-blocks>.dta-row[data-drop-side=after]{box-shadow:0 3px #4386dc}.dta-resource-blocks>.dta-row[data-resource-dragging=true]{opacity:.55}.dta-resource-layout .dta-handle:active{cursor:grabbing}
@container(max-width:600px){.dta-resource-layout .dta-summary{padding:12px;gap:4px 8px}.dta-resource-body{padding:0 12px 12px}.dta-resource-policy{grid-template-columns:1fr}}

@container(max-width:600px){.dta-summary{flex-wrap:wrap}.dta-summary-meta{display:grid;flex:1 1 100%;grid-template-columns:repeat(2,minmax(0,1fr));row-gap:14px}.dta-summary-meta>div:nth-child(odd){border-left:0;padding-left:0}.dta-position-summary{grid-template-columns:28px 20px minmax(0,1fr)}.dta-position-meta{grid-column:1/-1}.dta-grid,.dta-properties{grid-template-columns:1fr}.dta-properties>*+*{border-left:0;border-top:1px solid var(--dsw-alias-state-business-primary,#4d6bfe);padding:12px 0 0}.dta-head,.dta-body{padding:15px}.dta-summary{gap:8px;padding:12px 10px}.dta-fields .dta-field-name{max-width:100%}}
@media(max-width:700px){.dtv-assembly-screen{border-radius:12px}.dta-head,.dta-body{padding:15px}.dta-head{padding-right:64px}.dta-grid,.dta-properties{grid-template-columns:1fr}.dta-summary{gap:8px;padding:12px 10px}.dta-name{font-size:15px}.dta-summary{flex-wrap:wrap}.dta-summary-meta{display:grid;flex:1 1 100%;grid-template-columns:repeat(2,minmax(0,1fr));row-gap:14px}.dta-summary-meta>div:nth-child(odd){border-left:0;padding-left:0}.dta-position-summary{grid-template-columns:28px 20px minmax(0,1fr)}.dta-position-meta{grid-column:1/-1}.dta-properties>*+*{border-left:0;border-top:1px solid var(--dsw-alias-state-business-primary,#4d6bfe);padding:12px 0 0}}
`;
function AssemblyPanel(props) {
  return (0, import_react4.createElement)(AssemblyPanelContent, { ...props, key: props.selectionTarget?.id ?? props.sessionId ?? "no-session" });
}
function AssemblyPanelContent({ selectionTarget, sessionId, sessionLabel: sessionLabel2, onCreateSession, createSessionControls, interfaceControls, standalone = false, close, registerBeforeLeave, chromeMode, locale: selectedLocale = "zh-CN", fetcher = globalThis.fetch, apiRoot = "/dsh-prompt-assembler/api/v1/assembly-presets", traceRoot, historyApiRoot, historyFragmentPresets, refreshEvent = "dsh-prompt-assembler:refresh" }) {
  const locale = selectedLocale === "zh-CN" ? 0 : 1, t = (key) => labels[key]?.[locale] ?? key;
  const [confirmation, setConfirmation] = (0, import_react4.useState)(null);
  const confirmationResolve = (0, import_react4.useRef)(null);
  const confirm = (message) => new Promise((resolve) => {
    confirmationResolve.current?.(false);
    confirmationResolve.current = resolve;
    setConfirmation(message);
  });
  const answerConfirmation = (answer) => {
    const resolve = confirmationResolve.current;
    confirmationResolve.current = null;
    setConfirmation(null);
    resolve?.(answer);
  };
  (0, import_react4.useEffect)(() => () => confirmationResolve.current?.(false), []);
  (0, import_react4.useEffect)(() => {
    if (confirmation) dialog.current?.querySelector(".dta-confirm button")?.focus();
  }, [confirmation]);
  const [sources, setSources] = (0, import_react4.useState)([]), [addParser, setAddParser] = (0, import_react4.useState)("custom"), [addKind, setAddKind] = (0, import_react4.useState)(""), [defaultId, setDefaultId] = (0, import_react4.useState)(BUILTINS[0].id);
  const [items, setItems] = (0, import_react4.useState)([]), [draft, setDraft] = (0, import_react4.useState)(null), [selection, setSelection] = (0, import_react4.useState)(null), [capable, setCapable] = (0, import_react4.useState)(false), [capabilities, setCapabilities] = (0, import_react4.useState)(null);
  const [status, setStatus] = (0, import_react4.useState)(""), [error, setError] = (0, import_react4.useState)(false), [busy, setBusy] = (0, import_react4.useState)(false), [tab, setTab] = (0, import_react4.useState)("rules"), [preview, setPreview] = (0, import_react4.useState)(null), [dirty, setDirty] = (0, import_react4.useState)(false), [expanded, setExpanded] = (0, import_react4.useState)({});
  const [historyDirty, setHistoryDirty] = (0, import_react4.useState)(false);
  const [validationFailure, setValidationFailure] = (0, import_react4.useState)(null);
  const appliedBackend = selection?.backend ?? "native";
  const file = (0, import_react4.useRef)(), stage = (0, import_react4.useRef)(), dialog = (0, import_react4.useRef)(), generation = (0, import_react4.useRef)(0), mounted = (0, import_react4.useRef)(true);
  (0, import_react4.useLayoutEffect)(() => {
    if (standalone) return;
    const panel = dialog.current;
    let frame = panel?.parentElement;
    while (frame && getComputedStyle(frame).display !== "grid") frame = frame.parentElement;
    if (!frame) return;
    const measure = () => {
      const columns = getComputedStyle(frame).gridTemplateColumns.split(" ").map(parseFloat);
      if (columns.length !== 3 || columns.some((n) => !Number.isFinite(n))) return;
      stage.current.style.setProperty("--dta-content-left", `${columns[0]}px`);
      const header = [...frame.querySelectorAll("header")].find((el) => !panel.contains(el) && el.querySelector("[role=tablist]"));
      const top = header ? header.getBoundingClientRect().bottom - frame.getBoundingClientRect().top : 76;
      stage.current.style.setProperty("--dta-content-top", `${top}px`);
      stage.current.style.setProperty("--dta-center-width", `${columns[1]}px`);
      const composer = frame.querySelector("[data-composer-input]");
      const composerWidth = composer && getComputedStyle(composer).getPropertyValue("--dsh-composer-card-max-width").trim();
      if (composerWidth) stage.current.style.setProperty("--dsh-composer-card-max-width", composerWidth);
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(frame);
    for (const child of frame.children) resize.observe(child);
    for (const header of frame.querySelectorAll("header")) if (!panel.contains(header)) resize.observe(header);
    const changes = new MutationObserver(measure);
    changes.observe(frame, { attributes: true, attributeFilter: ["style", "data-sidebar-collapsed", "data-rightbar-collapsed"] });
    return () => {
      resize.disconnect();
      changes.disconnect();
    };
  }, []);
  const [slotAnalysis, setSlotAnalysis] = (0, import_react4.useState)(null);
  const [reload, setReload] = (0, import_react4.useState)(0);
  const api = async (...args) => {
    const result = selectionTarget && args[0] === "/preview" ? await selectionTarget.previewAssembly(args[2].preset) : selectionTarget && args[0] === "/selection" ? await selectionTarget.applyAssembly(args[2].id) : await request(fetcher, apiRoot, ...args);
    if (selectionTarget && String(args[0]).startsWith("?")) result.selection = await selectionTarget.getSelection();
    if (!mounted.current) throw new DOMException("Panel closed", "AbortError");
    return result;
  };
  const run = async (fn) => {
    setBusy(true);
    setError(false);
    try {
      await fn();
    } catch (e) {
      if (mounted.current) {
        setError(true);
        setStatus(e.message);
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  (0, import_react4.useEffect)(() => {
    mounted.current = true;
    const gen = ++generation.current;
    run(async () => {
      const data = await api(`?sessionId=${encodeURIComponent(sessionId ?? "")}`);
      if (gen !== generation.current || !mounted.current) return;
      setItems(data.presets);
      setSelection(data.selection);
      setCapable(data.capability);
      setCapabilities(data.capabilities ?? null);
      setSources(data.sources ?? []);
      setDefaultId(data.defaultPresetId ?? data.presets[0]?.id);
      setAddParser(data.sources?.some((s) => s.id === "tavern.text") ? "tavern.text" : data.sources?.find((s) => s.acceptsText && !s.textParserAliasFor)?.id ?? "");
      setAddKind(data.sources?.find((s) => s.supportsModule !== false && s.moduleAvailable !== false && !data.presets[0]?.rules.some((r) => r.kind === s.id))?.id ?? "");
      setDraft(data.presets.find((p) => p.id === data.selection?.id) ?? data.presets[0]);
      setPreview(null);
      setDirty(false);
      setStatus("");
    });
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, [sessionId, selectionTarget, reload]);
  (0, import_react4.useEffect)(() => {
    const refresh = () => run(async () => {
      const gen = generation.current;
      const data = await api(`?sessionId=${encodeURIComponent(sessionId ?? "")}`);
      if (gen !== generation.current || !mounted.current) return;
      setItems(data.presets);
      setSelection(data.selection);
      setCapable(data.capability);
      setCapabilities(data.capabilities ?? null);
      setSources(data.sources ?? []);
    });
    window.addEventListener(refreshEvent, refresh);
    return () => window.removeEventListener(refreshEvent, refresh);
  }, [sessionId, selectionTarget, chromeMode, refreshEvent]);
  (0, import_react4.useEffect)(() => {
    let active = true;
    api(`?sessionId=${encodeURIComponent(sessionId ?? "")}`).then((data) => {
      if (active) setSelection(data.selection);
    }).catch(() => {
    });
    return () => {
      active = false;
    };
  }, [chromeMode, sessionId, selectionTarget]);
  const discard = () => !busy && (!dirty || confirm(t("discard")));
  const leave = () => !busy && (!(dirty || historyDirty) || confirm(t("discard")));
  const changeHistoryBackend = (backend) => backend === appliedBackend || !historyDirty || confirm(t("discard"));
  (0, import_react4.useEffect)(() => registerBeforeLeave?.(leave), [dirty, historyDirty, busy, registerBeforeLeave]);
  const edit = (patch) => {
    if (busy) return;
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
    setPreview(null);
  };
  const editableRule = (rule) => {
    const source = sources.find((s) => s.id === rule.kind);
    const parser = sources.find((s) => s.id === source?.textParserAliasFor && s.acceptsText);
    return parser && (rule.inputMode === "text" || rule.kind === "custom") ? { ...rule, kind: parser.id, inputMode: "text", role: parser.roles.includes(rule.role) ? rule.role : parser.roles[0], lifetime: parser.lifetimes.includes(rule.lifetime) ? rule.lifetime : parser.lifetimes[0], depth: parser.depth === false ? null : rule.depth } : rule;
  };
  const editablePreset = (preset) => ({ ...preset, rules: preset.rules.map(editableRule) });
  const editLayout = (next) => edit({ rules: next.rules, layout: next.layout, placement: layoutPlacement(next) });
  async function validateCurrent(candidate = draft) {
    try {
      const data = await api("/preview", "POST", { sessionId, preset: editablePreset(candidate) });
      if (!data.preview) throw new Error(locale === 0 ? "\u672A\u8FD4\u56DE\u88C5\u914D\u6821\u9A8C\u7ED3\u679C" : "Assembly validation result is unavailable");
      setValidationFailure(null);
      return data.preview;
    } catch (error2) {
      setValidationFailure({ id: candidate.id, candidate, message: error2.message });
      throw error2;
    }
  }
  const controlRows = (rules) => contextControlRows(rules, sources.map((s) => s.id));
  const editRule = (id, patch) => edit({ rules: controlRows(draft.rules).map((r) => r.id === id ? { ...editableRule(r), ...patch } : r) });
  const toggle = (id) => setExpanded((old) => ({ ...old, [id]: !old[id] }));
  async function save(asCopy = false) {
    const creates = asCopy || draft.builtin || !draft.id;
    const data = await api(creates ? "" : `/${encodeURIComponent(draft.id)}`, creates ? "POST" : "PUT", editablePreset(draft));
    setDraft(data.preset);
    setItems((list) => [...list.filter((p) => p.id !== data.preset.id), data.preset]);
    setDirty(false);
    setStatus(t("saved"));
    window.dispatchEvent(new window.Event(refreshEvent));
    return data.preset;
  }
  function download() {
    const blob = new Blob([JSON.stringify({ ...editablePreset(draft), id: void 0, builtin: void 0 }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${draft.name.replace(/[\\/:*?"<>|]/g, "_")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }
  const button = (label, onClick, disabled = false, cls, pressed) => (0, import_react4.createElement)("button", { type: "button", onClick, disabled: busy || disabled, className: cls, "aria-pressed": pressed }, t(label));
  const select = (value, values, onChange, disabled = false) => (0, import_react4.createElement)("select", { value, disabled: busy || disabled, onChange: (e) => onChange(e.target.value) }, ...values.map((v) => (0, import_react4.createElement)("option", { key: v, value: v }, t(v))));
  const nodeName = (node) => {
    if (node.positionId && node.source?.module === "worldbook" && node.name?.startsWith("worldbook:")) {
      const position = sources.find((s) => s.id === "worldbook")?.positions?.find((p) => p.id === node.positionId);
      if (position) return `${position.name[locale]} \xB7 ${(preview?.nodes?.filter((n) => n.source?.module === "worldbook" && n.positionId === node.positionId).indexOf(node) ?? 0) + 1}`;
    }
    if (labels[node.name]) return t(node.name);
    const standard = { "Main Prompt": "main", "Post-History Instructions": "jailbreak", "Character Description": "charDescription", "Character Personality": "charPersonality", "Persona Description": "personaDescription", "Chat History": "history", "World Info (before)": "worldbook", "World Info (after)": "worldbook" };
    if (standard[node.name]) return t(standard[node.name]);
    if (node.sourceStatus === "name-unrecorded" && node.source?.field && !labels[node.source.field]) return `${t(node.module)} \xB7 ${Math.max(0, preview?.nodes?.filter((n) => n.module === node.module).indexOf(node) ?? -1) + 1}`;
    if (node.name?.startsWith("preset:") || node.name?.startsWith("worldbook:")) return labels[node.source?.field] ? t(node.source.field) : `${t(node.name.startsWith("preset:") ? "preset" : "worldbook")} \xB7 ${Math.max(0, preview?.nodes?.indexOf(node) ?? -1) + 1}`;
    return node.name;
  };
  const positionReason = (decision) => ({ user: locale === 0 ? "\u81EA\u5B9A\u4E49\u4F4D\u7F6E" : "Custom position", preset: locale === 0 ? "\u9884\u8BBE\u63D2\u69FD" : "Preset slot", runtime: locale === 0 ? "\u8FD0\u884C\u65F6\u7EA6\u675F" : "Runtime constraint", "resource-depth": locale === 0 ? "\u8D44\u6E90\u6DF1\u5EA6" : "Resource depth", resource: locale === 0 ? "\u8D44\u6E90\u81EA\u5E26\u4F4D\u7F6E" : "Resource position", default: locale === 0 ? "\u6765\u6E90\u9ED8\u8BA4\u987A\u5E8F" : "Default source order", source: locale === 0 ? "\u8D44\u6E90\u9ED8\u8BA4\u4F4D\u7F6E" : "Source position" })[decision];
  const originName = (plugin) => plugin === "DSH" ? "DSH" : plugin === "pmp-dsh-tavern" || plugin?.startsWith("pmp-dsh-tavern/") ? "DSH Tavern" : plugin ?? (locale === 0 ? "\u6765\u6E90\u672A\u77E5" : "Unknown source");
  const sourceDescriptor = (kind) => sources.find((s) => s.id === kind);
  const sourcePlugin = (kind) => sourceDescriptor(kind)?.pluginId ?? null;
  const sourceName = (kind) => labels[kind] ? t(kind) : sourceDescriptor(kind)?.name ?? kind;
  const modules = sources.filter((s) => !isContextControl(s.id) && s.supportsModule !== false && s.moduleAvailable !== false && (s.multiple || !draft?.rules.some((r) => r.kind === s.id && r.inputMode !== "text")));
  const parsers = sources.filter((s) => s.acceptsText && !sources.some((target) => target.id === s.textParserAliasFor && target.acceptsText));
  const addRule = (kind, inputMode) => {
    const source = sourceDescriptor(kind);
    if (!source) return;
    const id = `source-${crypto.randomUUID()}`;
    const role = draft.backend === "native" ? inputMode === "text" && source.roles.includes("user") ? "user" : source.roles.includes("system") ? "system" : source.roles[0] : inputMode === "text" && source.roles.includes("user") ? "user" : source.roles[0];
    const added = { id, kind, ...inputMode ? { inputMode } : {}, ...draft.backend === "native" && role === "user" ? { delivery: "context" } : {}, enabled: true, role, lifetime: draft.backend === "native" ? "request" : source.lifetimes[0], depth: null, text: "", name: "" };
    const rules = [...draft.rules];
    const index = draft.backend !== "native" ? -1 : role !== "user" ? rules.findIndex((r) => r.kind === "history") : rules.findIndex((r, i) => i > rules.findIndex((x) => x.kind === "input") && r.role === "user" && r.delivery === "pre-step");
    rules.splice(index < 0 ? rules.length : index, 0, added);
    edit({ rules });
    setExpanded((old) => ({ ...old, [id]: true }));
  };
  const sourceInfo = (kind) => sourceDescriptor(kind)?.generationRequiresPlugin === false ? t("nativeSource") : t("removed");
  async function actualRequest() {
    const show = (record) => {
      if (!record?.messages) return false;
      setPreview(actualAssemblyResult(record));
      setTab("expanded");
      setStatus("");
      return true;
    };
    if (!traceRoot) {
      const data = await api(`/actual?sessionId=${encodeURIComponent(sessionId)}`);
      if (!show(data.request)) setStatus(t(data.backend === "native" ? "noActualNative" : "noActual"));
      return;
    }
    const response = await fetcher(`${traceRoot}/sessions/${encodeURIComponent(sessionId)}/assemblies`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const list = await response.json();
    for (const item of [...list.records ?? []].reverse().slice(0, 20)) {
      const res = await fetcher(`${traceRoot}/sessions/${encodeURIComponent(sessionId)}/assemblies/${encodeURIComponent(item.id)}`);
      if (!res.ok) continue;
      const detail = (await res.json()).record;
      const raw = detail?.requestAssembly ?? detail?.nativeRequest;
      const record = raw && detail.nativeProvenance ? { ...raw, metadata: { ...raw.metadata, assembly: raw.metadata?.assembly ?? detail.nativeProvenance } } : raw;
      if (!mounted.current) return;
      if (show(record)) return;
    }
    setStatus(t(draft?.backend === "native" ? "noActualNative" : "noActual"));
  }
  const safeClose = async () => {
    if (registerBeforeLeave || await leave()) close();
  };
  (0, import_react4.useEffect)(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector("button")?.focus();
    return () => {
      previous?.focus?.();
    };
  }, []);
  (0, import_react4.useEffect)(() => {
    const warn = (e) => {
      if (dirty || historyDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, historyDirty]);
  (0, import_react4.useEffect)(() => {
    if (registerBeforeLeave) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        safeClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dirty, historyDirty, busy, registerBeforeLeave]);
  const nativeDraft = draft?.backend === "native";
  const adaptiveNative = nativeDraft && ["native-roles", "native-slots"].includes(draft.placement);
  const slotMode = nativeDraft && draft.placement === "native-slots";
  (0, import_react4.useEffect)(() => {
    if (!slotMode && !draft?.layout || !sessionId && !selectionTarget) {
      setSlotAnalysis(null);
      return;
    }
    let active = true;
    setSlotAnalysis(null);
    api("/preview", "POST", { sessionId, preset: editablePreset(draft) }).then((data) => {
      if (active) setSlotAnalysis({ draft, preview: data.preview });
    }).catch((error2) => {
      if (active) setSlotAnalysis({ draft, error: error2.message });
    });
    return () => {
      active = false;
    };
  }, [draft, sessionId, selectionTarget, sources, reload]);
  const analysis = slotAnalysis?.draft === draft ? slotAnalysis : null;
  const controlFor = (rule) => analysis?.preview?.placementControls?.find((c) => c.ruleId === rule.id)?.control;
  const controlLabel = (control) => ({ preset: "controlPreset", mixed: "controlMixed", independent: "controlIndependent", native: "controlNative", empty: "controlEmpty" })[control];
  let nativeError = null;
  if (nativeDraft) {
    try {
      validateNativePreset(draft);
    } catch (error2) {
      nativeError = error2.message;
    }
  }
  const draftAvailable = capabilities ? nativeDraft ? capabilities.native && !nativeError : capabilities.core : capable;
  const displayRows = tab === "rules" ? draft ? controlRows(draft.rules) : [] : preview?.nodes ?? [];
  const ruleStability = (rule) => sourceDescriptor(rule.kind)?.stability ?? "conversation";
  const summaryMetadata = (stability, lifetime, role, history) => (0, import_react4.createElement)(SummaryMetadata, { className: history ? "dta-preview-meta" : "", items: [
    ...[["stability", stability], ["lifetime", lifetime], ["role", role]].map(([label, value]) => ({ label: t(label), content: t(label === "stability" && value === "snapshot" ? "retained" : value) })),
    ...history ? [{ label: locale === 0 ? "\u539F\u751F\u5386\u53F2" : "Native history", content: history, className: "dta-history-note" }] : []
  ] });
  function ruleRow(rule, index) {
    rule = editableRule(rule);
    if (isContextControl(rule.kind)) return (0, import_react4.createElement)(
      "article",
      { key: rule.id, className: "dta-row", "data-context-control": rule.kind, style: { "--assembly-color": sourceColor("DSH") } },
      (0, import_react4.createElement)(
        "div",
        { className: "dta-summary" },
        (0, import_react4.createElement)("span", { "aria-hidden": true }, "\u{1F512}"),
        (0, import_react4.createElement)("input", { type: "checkbox", checked: rule.enabled, disabled: busy, "aria-label": sourceName(rule.kind), onChange: (e) => editRule(rule.id, { enabled: e.target.checked }) }),
        (0, import_react4.createElement)("span", { className: "dta-name" }, sourceName(rule.kind), (0, import_react4.createElement)("small", { className: "dta-origin" }, t("contextControlled")))
      ),
      (0, import_react4.createElement)("div", { className: "dta-detail" }, (0, import_react4.createElement)("small", null, t(rule.kind === "dsh.runtime-context" ? "contextMasterHint" : "contextControlHint")))
    );
    const roleLabel = draft.layout?.identity === "preserve" && rule.inputMode !== "text" && !["custom", "dsh.text", "native-system", "history", "input"].includes(rule.kind) ? "sourceIdentity" : adaptiveNative && rule.kind === "worldbook" && !slotMode ? "nativeWorldRole" : slotMode && controlFor(rule) === "preset" ? "nativeSlotRole" : adaptiveNative && rule.kind === "preset" ? "nativePresetRole" : null;
    const textInput = rule.inputMode === "text" || ["custom", "dsh.text"].includes(rule.kind);
    return (0, import_react4.createElement)(
      "article",
      { key: rule.id, className: "dta-row", "data-assembly-index": index, style: { "--assembly-color": sourceColor(sourcePlugin(rule.kind)) } },
      (0, import_react4.createElement)(
        "div",
        { className: "dta-summary" },
        (0, import_react4.createElement)("span", { title: locale === 0 ? "\u6765\u6E90\u914D\u7F6E\uFF1B\u5728\u5F53\u524D\u8D44\u6E90\u5E03\u5C40\u4E2D\u79FB\u52A8\u8FDE\u7EED\u5757" : "Source configuration; move contiguous blocks in the current layout" }, "\u25C8"),
        (0, import_react4.createElement)("input", { type: "checkbox", checked: rule.enabled, disabled: busy || nativeDraft && ["history", "input"].includes(rule.kind), "aria-label": sourceName(rule.kind), onChange: (e) => editRule(rule.id, { enabled: e.target.checked }) }),
        (0, import_react4.createElement)("span", { className: "dta-name", role: "button", tabIndex: 0, "aria-expanded": !!expanded[rule.id], onClick: () => toggle(rule.id), onKeyDown: (e) => {
          if (["Enter", " "].includes(e.key)) {
            e.preventDefault();
            toggle(rule.id);
          }
        } }, rule.name || sourceName(rule.kind), (0, import_react4.createElement)("small", { className: "dta-origin" }, originName(sourcePlugin(rule.kind))), slotMode && !draft.layout && (0, import_react4.createElement)("small", { "data-placement-control": controlFor(rule) ?? "pending" }, t(controlLabel(controlFor(rule)) ?? "placementPending"))),
        summaryMetadata(ruleStability(rule), ["native-system", "history", "input"].includes(rule.kind) ? "nativeRetention" : nativeDraft && rule.role === "user" ? rule.delivery ?? "context" : rule.lifetime, roleLabel ?? rule.role)
      ),
      expanded[rule.id] && (0, import_react4.createElement)(
        "div",
        { className: "dta-detail" },
        (0, import_react4.createElement)("div", { className: "dta-properties" }, (0, import_react4.createElement)("div", null, t("source"), (0, import_react4.createElement)("small", null, originName(sourcePlugin(rule.kind))), (0, import_react4.createElement)("small", null, sourceInfo(rule.kind))), (0, import_react4.createElement)("div", null, t("stability"), (0, import_react4.createElement)("small", null, t(ruleStability(rule)))), (0, import_react4.createElement)("label", null, t("lifetime"), ["native-system", "history", "input"].includes(rule.kind) ? (0, import_react4.createElement)("small", null, t("nativeRetention")) : nativeDraft && rule.role === "user" ? (0, import_react4.createElement)("small", null, t(rule.delivery ?? "context")) : select(rule.lifetime, nativeDraft ? ["request"] : sourceDescriptor(rule.kind)?.lifetimes ?? ["request", "snapshot"], (v) => editRule(rule.id, { lifetime: v }), sourceDescriptor(rule.kind)?.lifetimes.length === 1))),
        nativeDraft && (rule.role === "user" || adaptiveNative && ["preset", "worldbook"].includes(rule.kind)) && (0, import_react4.createElement)("label", null, t("delivery"), select(rule.delivery ?? "context", ["context", "pre-step"], (delivery) => editRule(rule.id, { delivery }))),
        (0, import_react4.createElement)("div", { className: "dta-grid" }, (0, import_react4.createElement)("label", null, t("role"), roleLabel ? (0, import_react4.createElement)("small", null, t(roleLabel)) : select(rule.role, (sourceDescriptor(rule.kind)?.roles ?? ["preserve", "system", "user", "assistant"]).filter((role) => !nativeDraft || role !== "assistant"), (v) => editRule(rule.id, { role: v }), sourceDescriptor(rule.kind)?.roles.length === 1)), sourceDescriptor(rule.kind)?.depth !== false && (0, import_react4.createElement)("label", null, t("depth"), (0, import_react4.createElement)("input", { type: "number", min: 0, max: 1e4, value: rule.depth ?? "", disabled: busy || nativeDraft, onChange: (e) => editRule(rule.id, { depth: e.target.value === "" ? null : Number(e.target.value) }) }))),
        textInput ? (0, import_react4.createElement)(
          "div",
          { className: "dta-fields" },
          (0, import_react4.createElement)("label", null, t("parser"), (0, import_react4.createElement)("select", { value: rule.kind, onChange: (e) => {
            const source = sourceDescriptor(e.target.value);
            editRule(rule.id, { kind: source.id, inputMode: "text", role: source.roles.includes(rule.role) ? rule.role : source.roles[0], lifetime: source.lifetimes.includes(rule.lifetime) ? rule.lifetime : source.lifetimes[0], depth: source.depth === false ? null : rule.depth });
          } }, ...parsers.map((s) => (0, import_react4.createElement)("option", { key: s.id, value: s.id }, `${originName(s.pluginId)} \xB7 ${sourceName(s.id)}`)))),
          ["tavern.text", "dsh.text"].includes(rule.kind) && (0, import_react4.createElement)("p", null, t(rule.kind === "tavern.text" ? "tavernParserHelp" : "dshParserHelp")),
          (0, import_react4.createElement)("label", null, t("name"), (0, import_react4.createElement)("input", { value: rule.name ?? "", onChange: (e) => editRule(rule.id, { name: e.target.value }) })),
          (0, import_react4.createElement)("label", null, t("text"), (0, import_react4.createElement)("textarea", { value: rule.text, onChange: (e) => editRule(rule.id, { text: e.target.value }) })),
          button("remove", () => edit({ rules: draft.rules.filter((r) => r.id !== rule.id) }))
        ) : (0, import_react4.createElement)("div", { className: "dta-fields" }, moduleGuide(rule.kind), rule.kind === "phi" ? (0, import_react4.createElement)("label", null, t("additional-phi"), (0, import_react4.createElement)("textarea", { value: rule.text, onChange: (e) => editRule(rule.id, { text: e.target.value }) })) : !["native-system", "history", "input", "preset", "character", "persona", "worldbook"].includes(rule.kind) && button("remove", () => edit({ rules: draft.rules.filter((r) => r.id !== rule.id) }))),
        !sourceDescriptor(rule.kind) && (0, import_react4.createElement)("small", { role: "status" }, t("missingSource")),
        (0, import_react4.createElement)("small", null, t(nativeDraft ? "nativeRetentionHint" : "audit"))
      )
    );
  }
  function moduleGuide(kind) {
    const guide = sourceDescriptor(kind)?.contentGuide;
    return (0, import_react4.createElement)("div", { className: "dta-module-guide" }, ...[["contains", "contains", "unknownContains"], ["origin", "contentOrigin", "unknownOrigin"], ["editable", "editable", "unknownEditable"], ["editAt", "editAt", "unknownEditAt"]].map(([key, label, fallback]) => (0, import_react4.createElement)("p", { key }, (0, import_react4.createElement)("strong", null, t(label) + "\uFF1A"), guide?.[key]?.[locale] ?? t(fallback))), (0, import_react4.createElement)("small", null, t("modulePreviewHelp")));
  }
  function historyNote(node) {
    const zh = locale === 0, kind = node.source?.module;
    if (kind === "history") return zh ? "\u5DF2\u6709 \xB7 \u8BFB\u53D6\u5DF2\u4FDD\u5B58\u6D88\u606F" : "Existing \xB7 Saved messages";
    if (kind === "input") return zh ? "\u4F1A\u8FDB\u5165 \xB7 DSH \u4FDD\u5B58\u672C\u6B65\u8F93\u5165" : "Yes \xB7 DSH saves current input";
    if (preview?.backend === "native") {
      if (node.role === "system" || kind === "native-system") return zh ? "\u4F1A\u8FDB\u5165 \xB7 \u7CFB\u7EDF\u6307\u4EE4\u66F4\u65B0" : "Yes \xB7 System instruction updates";
      if (node.role === "user") return node.nativeDelivery === "pre-step" ? zh ? "\u4F1A\u8FDB\u5165 \xB7 \u6BCF\u6B65\u4FDD\u5B58\u6CE8\u5165\u6D88\u606F" : "Yes \xB7 Injection saved each step" : zh ? "\u4F1A\u8FDB\u5165 \xB7 \u4E0A\u4E0B\u6587\u53D8\u5316\u65F6\u4FDD\u5B58\uFF0C\u672A\u53D8\u5316\u65F6\u590D\u7528" : "Yes \xB7 Save changed context; reuse unchanged context";
    }
    if (node.lifetime === "native") return zh ? "\u5DF2\u6709 \xB7 DSH \u4FDD\u5B58\u4E0E\u63D0\u4F9B" : "Existing \xB7 Saved by DSH";
    if (preview?.backend === "core") return ["snapshot", "retained"].includes(node.lifetime) ? zh ? "\u4E0D\u8FDB\u5165 \xB7 \u88C5\u914D\u5FEB\u7167\u5355\u72EC\u7559\u5B58" : "No \xB7 Assembly snapshots retained separately" : zh ? "\u4E0D\u8FDB\u5165 \xB7 \u4EC5\u672C\u6B21\u8BF7\u6C42\uFF0C\u53EF\u8BB0\u5F55\u8F68\u8FF9" : "No \xB7 Request only; trace may record it";
    return zh ? "\u8BB0\u5F55\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u5224\u65AD" : "Unknown \xB7 Insufficient record";
  }
  function nodeRow(node, index) {
    const retention = node.nativeDelivery ?? (node.lifetime === "native" ? "nativeRetention" : node.lifetime);
    return (0, import_react4.createElement)(
      "article",
      { key: node.id, className: "dta-row", style: { "--assembly-color": sourceColor(node.source.plugin) } },
      (0, import_react4.createElement)("div", { className: "dta-summary" }, (0, import_react4.createElement)("span", { className: "dta-name", role: "button", tabIndex: 0, onClick: () => toggle(node.id), onKeyDown: (e) => {
        if (e.key === "Enter") toggle(node.id);
      }, "aria-expanded": !!expanded[node.id], title: nodeName(node) }, nodeName(node), node.sourceStatus === "name-unrecorded" && (0, import_react4.createElement)("small", null, t("sourceNameUnrecorded")), node.sourceStatus === "historical-system" && (0, import_react4.createElement)("small", null, t("historicalSystemHint")), node.sourceStatus === "current-name" && (0, import_react4.createElement)("small", null, t("sourceNameCurrent")), node.sourceStatus === "section-only" && (0, import_react4.createElement)("small", null, t("sourceFieldsUnrecorded")), (0, import_react4.createElement)("small", { className: "dta-origin" }, `${originName(node.source.plugin)} \xB7 ${sourceName(node.source.module)} \xB7 ${positionReason(node.positionDecision) ?? (node.depth == null ? t("listPosition") : t("previewDepth") + ": " + node.depth)}`)), summaryMetadata(node.stability, retention, node.role, historyNote(node))),
      expanded[node.id] && (0, import_react4.createElement)("div", { className: "dta-detail" }, (0, import_react4.createElement)("div", { className: "dta-properties" }, (0, import_react4.createElement)("div", null, t("source"), (0, import_react4.createElement)("small", null, `${node.source.plugin} / ${node.source.resourceId ?? ""} / ${node.source.field}`), (0, import_react4.createElement)("small", null, sourceInfo(node.module))), (0, import_react4.createElement)("div", null, t("stability"), (0, import_react4.createElement)("small", null, t(node.stability))), (0, import_react4.createElement)("div", null, t("lifetime"), (0, import_react4.createElement)("small", null, t(retention)), (0, import_react4.createElement)("small", null, t(preview?.backend === "native" ? "nativeRetentionHint" : "recorded")))), (0, import_react4.createElement)("div", { className: "dta-preview-depth" }, `${t("previewDepth")}: ${node.depth == null ? t("listPosition") : node.depth}`), node.locked && (0, import_react4.createElement)("small", null, `${t("locked")}: ${node.lockReason}`), ...(node.children ?? []).map((child) => (0, import_react4.createElement)("div", { key: child.id, className: "dta-child", style: { borderLeftColor: sourceColor(child.source?.plugin) } }, `\u{1F512} ${nodeName(child)}`, (0, import_react4.createElement)("small", null, child.lockReason), (0, import_react4.createElement)("small", null, [originName(child.source?.plugin), child.source?.resourceId, child.source?.field, child.source?.sourceKind].filter(Boolean).join(" / ")), (0, import_react4.createElement)("pre", null, child.text))), (0, import_react4.createElement)("pre", null, node.text))
    );
  }
  return (0, import_react4.createElement)("div", { ref: stage, className: `dta-stage${standalone ? " dta-standalone" : ""}` }, (0, import_react4.createElement)(
    "section",
    { ref: dialog, className: "dtv-assembly-screen", role: "dialog", "aria-modal": standalone, "aria-label": t("title") },
    (0, import_react4.createElement)("style", null, assemblyCss, historyPanelCss),
    confirmation && (0, import_react4.createElement)("div", { className: "dta-confirm-shade" }, (0, import_react4.createElement)("div", { className: "dta-confirm", role: "alertdialog", "aria-modal": true, "aria-label": confirmation, onKeyDown: (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        answerConfirmation(false);
      } else if (e.key === "Tab") {
        e.preventDefault();
        const buttons = [...e.currentTarget.querySelectorAll("button")];
        const at = buttons.indexOf(document.activeElement);
        buttons[(at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    } }, (0, import_react4.createElement)("p", null, confirmation), (0, import_react4.createElement)("div", { className: "dta-toolbar" }, (0, import_react4.createElement)("button", { type: "button", onClick: () => answerConfirmation(false) }, t("cancel")), (0, import_react4.createElement)("button", { type: "button", className: "primary", onClick: () => answerConfirmation(true) }, t("confirm"))))),
    (0, import_react4.createElement)("header", { className: "dta-head" }, (0, import_react4.createElement)("div", null, (0, import_react4.createElement)("h2", null, t("title")), (0, import_react4.createElement)("p", null, t("intro")), sessionLabel2 !== void 0 && (0, import_react4.createElement)("p", { "data-assembly-session": sessionId ?? "" }, `${t("session")}: ${sessionLabel2 || t("newSession")}`)), (0, import_react4.createElement)("button", { onClick: safeClose, "aria-label": t("close") }, "\xD7")),
    (0, import_react4.createElement)("div", { className: "dta-body" }, (0, import_react4.createElement)(
      "fieldset",
      { className: "dta-content", disabled: busy, style: { border: 0, padding: 0, minWidth: 0 } },
      (0, import_react4.createElement)("h3", { className: "dta-section-title" }, t("librarySection")),
      (0, import_react4.createElement)("div", { className: "dta-toolbar" }, (0, import_react4.createElement)("input", { type: "file", accept: ".json,application/json", hidden: true, ref: file, onChange: (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) run(async () => {
          if (f.size > 2 * 1024 * 1024) throw new Error("2 MiB limit");
          if (!await discard()) return;
          const data = await api("", "POST", JSON.parse(await f.text()));
          setDraft(data.preset);
          setItems((i) => [...i, data.preset]);
          setDirty(false);
          setPreview(null);
        });
      } }), button("import", () => file.current.click()), button("export", download, !draft), button("create", async () => {
        if (await discard()) {
          setDraft({ ...structuredClone(items.find((p) => p.id === defaultId) ?? items[0] ?? BUILTINS[0]), builtin: false, id: void 0, name: t("title") });
          setDirty(true);
          setPreview(null);
        }
      })),
      status && (0, import_react4.createElement)("div", { role: error ? "alert" : "status", className: "dta-notice", "data-error": error }, status),
      validationFailure && validationFailure.id === draft?.id && (0, import_react4.createElement)(
        "div",
        { role: "alert", className: "dta-notice", "data-assembly-validation-error": true },
        validationFailure.candidate === draft ? locale === 0 ? "\u5F53\u524D\u8D44\u6E90\u88C5\u914D\u6821\u9A8C\u5931\u8D25\uFF1A" : "Current-resource validation failed: " : locale === 0 ? "\u914D\u7F6E\u5DF2\u4FEE\u6539\u6216\u4FDD\u5B58\uFF0C\u5C1A\u672A\u901A\u8FC7\u91CD\u65B0\u6821\u9A8C\u3002\u4E0A\u6B21\u9519\u8BEF\uFF1A" : "Configuration changed or saved; revalidation is required. Last error: ",
        validationFailure.message
      ),
      !draft ? (0, import_react4.createElement)("div", null, !error && (0, import_react4.createElement)("p", null, t("loading")), error && button("retry", () => setReload((n) => n + 1))) : (0, import_react4.createElement)(
        "div",
        null,
        (0, import_react4.createElement)("div", { className: "dta-grid" }, (0, import_react4.createElement)("label", null, t("select"), (0, import_react4.createElement)("select", { value: draft.id ?? "", disabled: busy, onChange: async (e) => {
          const id = e.target.value;
          if (await discard()) {
            setDraft(items.find((p) => p.id === id));
            setDirty(false);
            setPreview(null);
          }
        } }, !draft.id && (0, import_react4.createElement)("option", { value: "" }, draft.name), ...items.map((p) => (0, import_react4.createElement)("option", { key: p.id, value: p.id }, p.name)))), (0, import_react4.createElement)("label", null, t("name"), (0, import_react4.createElement)("input", { value: draft.name, disabled: draft.builtin, onChange: (e) => edit({ name: e.target.value }) }))),
        (0, import_react4.createElement)("div", { className: "dta-toolbar" }, button("save", () => run(() => save())), button("copy", () => run(() => save(true))), button("remove", () => run(async () => {
          if (!await confirm(t("confirmDelete"))) return;
          await api(`/${draft.id}`, "DELETE");
          setItems((i) => i.filter((p) => p.id !== draft.id));
          setDraft(items[0]);
          setDirty(false);
          setPreview(null);
        }), !draft.id || draft.builtin), dirty && (0, import_react4.createElement)("span", null, t("dirty"))),
        (0, import_react4.createElement)("h3", { className: "dta-section-title" }, t("rulesSection")),
        (0, import_react4.createElement)("p", { className: "dta-notice", "data-assembly-placement-tip": true }, t("placementTip")),
        (0, import_react4.createElement)("label", { className: "dta-toolbar" }, t("backend"), (0, import_react4.createElement)("select", { "aria-label": t("backend"), value: draft.backend ?? "core", onChange: (e) => edit({ backend: e.target.value }) }, (0, import_react4.createElement)("option", { value: "native" }, t("backendNative")), (0, import_react4.createElement)("option", { value: "core" }, t("backendCore")))),
        (0, import_react4.createElement)("div", { className: "dta-notice" }, draft.layout ? locale === 0 ? "\u62D6\u62FD\u5373\u81EA\u5B9A\u4E49\u4F4D\u7F6E\uFF1B\u5176\u4F59\u5185\u5BB9\u6309\u81EA\u52A8\u4F18\u5148\u7EA7\u5B9A\u4F4D\u3002\u5F53\u524D\u8D44\u6E90\u53EF\u786E\u5B9A\u7684\u4F4D\u7F6E\u4F1A\u540C\u6B65\u66F4\u65B0\uFF0C\u8EAB\u4EFD\u4E0E\u8FD0\u884C\u65F6\u7EA6\u675F\u59CB\u7EC8\u751F\u6548\u3002" : "Dragging sets a custom position; other content follows automatic priority. Definite positions update from current resources, within identity and runtime constraints." : t(adaptiveNative ? draft.placement === "native-slots" ? "nativeSlotsHint" : "nativeRolesHint" : nativeDraft ? "nativeHint" : "coreHint")),
        nativeError && (0, import_react4.createElement)("div", { className: "dta-notice", role: "alert" }, nativeError),
        (0, import_react4.createElement)("div", { className: "dta-tabs" }, (0, import_react4.createElement)("button", { "aria-pressed": tab === "rules", onClick: () => setTab("rules") }, t("rules")), button("preview", () => run(async () => {
          const result = await validateCurrent();
          setPreview(result);
          if (slotMode) setSlotAnalysis({ draft, preview: result });
          setTab("expanded");
        }), Boolean(selectionTarget && (typeof selectionTarget.previewAssembly !== "function" || selectionTarget.editable === false)), void 0, tab === "expanded" && !preview?.actual)),
        (0, import_react4.createElement)("div", { className: "dta-result-tools" }, button("actual", () => run(actualRequest), !sessionId)),
        (0, import_react4.createElement)("div", { className: "dta-legend" }, ...[...new Set(sources.map((s) => s.pluginId))].map((plugin) => (0, import_react4.createElement)("span", { key: plugin, style: { "--assembly-color": sourceColor(plugin) } }, originName(plugin)))),
        tab === "rules" ? (0, import_react4.createElement)("div", null, (0, import_react4.createElement)(ResourcePositionEditor, { preset: draft, sources, preview: analysis?.preview, resolving: !!draft.layout && !!(sessionId || selectionTarget) && !analysis, resolutionError: analysis?.error, locale, busy, sourceColor, originName, sourceName, onChange: editLayout }), (0, import_react4.createElement)(
          "details",
          { className: "dta-source-settings" },
          (0, import_react4.createElement)("summary", null, locale === 0 ? "\u6765\u6E90\u3001\u6587\u672C\u4E0E\u6295\u9012\u8BBE\u7F6E" : "Source, text and delivery settings"),
          slotMode && analysis?.error && (0, import_react4.createElement)("div", { role: "alert" }, t("placementFailed") + analysis.error),
          !draft.layout && (0, import_react4.createElement)("label", { className: "dta-toolbar" }, t("placement"), select(draft.placement, nativeDraft ? ["modules", "native-roles", "native-slots"] : ["modules", "st"], (placement) => edit({ placement }))),
          draft.placement === "st" && (0, import_react4.createElement)("small", null, t("stHelp")),
          ...displayRows.map(ruleRow),
          modules.length > 0 && (0, import_react4.createElement)("div", { className: "dta-toolbar" }, (0, import_react4.createElement)("label", { htmlFor: "dta-add-source" }, t("addSource")), (0, import_react4.createElement)("select", { id: "dta-add-source", value: modules.some((s) => s.id === addKind) ? addKind : modules[0].id, onChange: (e) => setAddKind(e.target.value) }, ...modules.map((s) => (0, import_react4.createElement)("option", { key: s.id, value: s.id }, `${originName(s.pluginId)} \xB7 ${sourceName(s.id)}`))), button("add", () => addRule(modules.some((s) => s.id === addKind) ? addKind : modules[0].id))),
          parsers.length > 0 && (0, import_react4.createElement)("div", { className: "dta-toolbar" }, (0, import_react4.createElement)("label", { htmlFor: "dta-add-parser" }, t("parser")), (0, import_react4.createElement)("select", { id: "dta-add-parser", value: addParser, onChange: (e) => setAddParser(e.target.value) }, ...parsers.map((s) => (0, import_react4.createElement)("option", { key: s.id, value: s.id }, `${originName(s.pluginId)} \xB7 ${sourceName(s.id)}`))), button("addText", () => addRule(addParser, "text"))),
          (0, import_react4.createElement)("small", null, t("sourceHelp"))
        )) : (0, import_react4.createElement)("div", null, (0, import_react4.createElement)("div", { className: "dta-notice" }, t(preview?.actual ? "actualNotice" : preview?.scope === "opening-draft" ? "draftPreviewScope" : preview?.backend === "native" ? "nativePreviewScope" : "previewScope")), !preview ? (0, import_react4.createElement)("p", null, t("empty")) : (0, import_react4.createElement)("div", null, (0, import_react4.createElement)(PositionDecisions, { preview, sources, locale, sourceName }), ...preview.diagnostics.filter((d) => ["ASSEMBLY_EMPTY", "ASSEMBLY_SYSTEM_ONLY"].includes(d.code) && !(preview.scope === "opening-draft" && d.code === "ASSEMBLY_SYSTEM_ONLY")).map((d) => (0, import_react4.createElement)("div", { key: d.code, className: "dta-notice", role: "alert" }, t(d.code === "ASSEMBLY_EMPTY" ? "emptyRequest" : "systemOnly"))), preview.diagnostics.some((d) => d.code === "NATIVE_PLACEMENT_ADJUSTED") && (0, import_react4.createElement)("div", { className: "dta-notice" }, t("nativeOrderChanged")), ...preview.diagnostics.filter((d) => ["NATIVE_ROLE_ADJUSTED", "NATIVE_DELIVERY_ADJUSTED", "NATIVE_SLOTS_ABSENT", "NATIVE_DEPTH_APPROXIMATED", "NATIVE_DEPTH_BOUNDARY", "WORLD_BOOK_SLOT_MISSING"].includes(d.code)).map((d, i) => (0, import_react4.createElement)("div", { key: `native-adjustment:${i}`, className: "dta-notice" }, d.code === "NATIVE_SLOTS_ABSENT" ? t("nativeSlotsAbsent") : d.code === "WORLD_BOOK_SLOT_MISSING" ? `${d.name} \xB7 ${t("worldSlotMissing")}: ${d.anchor}` : d.code === "NATIVE_DEPTH_BOUNDARY" ? `${d.name} \xB7 ${t("nativeDepthBoundary")}: ${d.depth} \u2192 ${t(d.placement)}` : d.code === "NATIVE_DEPTH_APPROXIMATED" ? `${d.name} \xB7 ${t("nativeDepthApproximated")} (${d.depth})` : `${d.name} \xB7 ${t(d.code === "NATIVE_ROLE_ADJUSTED" ? "nativeRoleChanged" : "nativeDeliveryChanged")}: ${d.from} \u2192 ${d.to}`)), ...preview.nodes.map(nodeRow), preview.runtimeContextControls?.length > 0 && (0, import_react4.createElement)("div", { className: "dta-notice" }, (0, import_react4.createElement)("strong", null, t("contextPreview")), ...preview.runtimeContextControls.map((c) => (0, import_react4.createElement)("div", { key: c.name }, `${c.name} \xB7 ${t(c.enabled ? "contextIncluded" : "contextExcluded")}`))), (0, import_react4.createElement)("details", null, (0, import_react4.createElement)("summary", null, `${t(preview.backend === "native" && !preview.actual ? "logicalMessages" : "result")} (${preview.messages.length})`), ...preview.messages.map((m, i) => (0, import_react4.createElement)("div", { key: `${m.id}:${i}`, className: "dta-child" }, `${i + 1} \xB7 ${m.role}`, (0, import_react4.createElement)("pre", null, (m.content ?? []).map((b) => b.type === "text" ? b.text : `[${b.type}]`).join("\n"))))), preview.diagnostics.length > 0 && (0, import_react4.createElement)("details", null, (0, import_react4.createElement)("summary", null, t("diagnostics")), (0, import_react4.createElement)("pre", null, JSON.stringify(preview.diagnostics, null, 2))))),
        (0, import_react4.createElement)("small", { style: { marginTop: 20 } }, t("tools")),
        (0, import_react4.createElement)("h3", { className: "dta-section-title" }, t("applicationSection")),
        (0, import_react4.createElement)("div", { className: "dta-notice" }, `${t("applied")}: ${selection?.name ?? t("legacy")}`, selection?.id?.startsWith("builtin-") && !items.some((p) => p.id === selection.id) && (0, import_react4.createElement)("small", null, t("withdrawnPreset")), !capable && (0, import_react4.createElement)("small", null, t("unavailable"))),
        onCreateSession && (0, import_react4.createElement)("div", null, createSessionControls, (0, import_react4.createElement)("div", { className: "dta-toolbar" }, button("createSession", () => run(async () => {
          const preset = dirty || !draft.id ? await save() : draft;
          if (!mounted.current) return;
          await onCreateSession(preset.id);
        }), !draftAvailable, "primary"))),
        (0, import_react4.createElement)("div", { className: "dta-toolbar" }, button("apply", async () => {
          if (!await changeHistoryBackend(draft.backend ?? "core")) return;
          run(async () => {
            await validateCurrent();
            const preset = dirty || !draft.id ? await save() : draft;
            const data = await api("/selection", "PUT", { sessionId, id: preset.id });
            setSelection(data.selection);
            setStatus(t("appliedStatus"));
            window.dispatchEvent(new window.Event(refreshEvent));
          });
        }, !sessionId && !selectionTarget || !draftAvailable || selectionTarget?.editable === false, "primary"), button("reset", async () => {
          const nextBackend = items.find((p) => p.id === defaultId)?.backend ?? "core";
          if (!await (nextBackend === appliedBackend ? discard() : leave())) return;
          run(async () => {
            await validateCurrent(items.find((p) => p.id === defaultId));
            const data = await api("/selection", "PUT", { sessionId, id: defaultId });
            setSelection(data.selection);
            setDraft(items.find((p) => p.id === defaultId));
            setDirty(false);
            setPreview(null);
            setTab("rules");
            setStatus(t("appliedStatus"));
            window.dispatchEvent(new window.Event(refreshEvent));
          });
        }, !sessionId && !selectionTarget || !capable || selectionTarget?.editable === false), button("disable", async () => {
          if (!await changeHistoryBackend("native")) return;
          run(async () => {
            const data = await api("/selection", "PUT", { sessionId, id: null });
            setSelection(data.selection);
            window.dispatchEvent(new window.Event(refreshEvent));
          });
        }, !sessionId && !selectionTarget || !selection || selectionTarget?.editable === false)),
        draft.builtin && (0, import_react4.createElement)("small", null, t("defaultHint")),
        !sessionId && (0, import_react4.createElement)("small", null, selectionTarget ? t("deferredSelection") : t("noSession")),
        sessionId && !selectionTarget && (0, import_react4.createElement)(HistoryPanel, { sessionId, backend: appliedBackend, fetcher, root: historyApiRoot, fragmentPresets: historyFragmentPresets, onDirtyChange: setHistoryDirty, locale })
      ),
      interfaceControls && (0, import_react4.createElement)("section", { className: "dta-interface-settings", "aria-label": t("interfaceSettings") }, (0, import_react4.createElement)("h3", { className: "dta-section-title" }, t("interfaceSettings")), interfaceControls)
    ))
  ));
}

// src/client-fetch.js
var API_ROOT = "/dsh-prompt-assembler/api/v1";
function createAssemblerFetch({ fetcher = (...args) => globalThis.fetch(...args), protocol = () => globalThis.location?.protocol } = {}) {
  let tokenPromise;
  const requestToken = () => tokenPromise ??= fetcher(`${API_ROOT}/request-token`, {
    headers: { "X-Assembler-Client": "embedded" },
    cache: "no-store"
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Assembler request token: HTTP ${response.status}`);
    const { token } = await response.json();
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid assembler request token");
    return token;
  }).catch((error) => {
    tokenPromise = void 0;
    throw error;
  });
  return async (url, options = {}) => {
    if (typeof url !== "string" || !url.startsWith(`${API_ROOT}/`) || /[\\#]/.test(url) || url.split("?")[0].split("/").some((part) => {
      try {
        return [".", ".."].includes(decodeURIComponent(part)) || /[/\\]/.test(decodeURIComponent(part));
      } catch {
        return true;
      }
    })) throw new Error("Invalid assembler API path");
    const method = String(options.method ?? "GET").toUpperCase();
    if (protocol() !== "dsh-app:" || ["GET", "HEAD", "OPTIONS"].includes(method)) return fetcher(url, options);
    const send = async () => {
      const headers = new Headers(options.headers);
      headers.set("X-Assembler-Request-Token", await requestToken());
      return fetcher(url, { ...options, headers });
    };
    const response = await send();
    if (response.status !== 403) return response;
    const error = await response.clone().json().catch(() => null);
    if (error?.code !== "ASSEMBLER_API_ORIGIN_FORBIDDEN") return response;
    tokenPromise = void 0;
    return send();
  };
}
var assemblerFetch = createAssemblerFetch();

// src/plugin-client.js
var name = "dsh-prompt-assembler";
var inject = ["slots", "sessions", "workspaces", "uiWorkspace"];
var REFRESH_EVENT = "dsh-prompt-assembler:refresh";
function mainSession(snapshot) {
  return Object.values(snapshot?.byId ?? {}).find((row) => (row.retainedBy?.mainView ?? 0) > 0) ?? null;
}
function sessionLabel(session, locale = "zh-CN") {
  return session?.blank || !session ? locale === "zh-CN" ? "\u65B0\u4F1A\u8BDD" : "New Session" : session.title || session.displayTitle || session.id;
}
function createAssemblyController(sessions) {
  let state = { open: false, session: null, revision: 0 }, guard, disposed = false, transition = 0;
  const listeners = /* @__PURE__ */ new Set();
  const publish = (patch) => {
    if (disposed) return;
    state = { ...state, ...patch, revision: state.revision + 1 };
    for (const fn of listeners) fn();
  };
  const getMain = () => mainSession(sessions.list.getSnapshot());
  const move = async (session, open) => {
    const ticket = ++transition;
    if (state.open && (state.session?.id !== session?.id || !open) && guard && !await guard()) return false;
    if (disposed || ticket !== transition) return false;
    if (state.session?.id !== session?.id || state.open !== open) guard = void 0;
    publish({ open, session });
    return true;
  };
  let lastMainId = getMain()?.id;
  const stop = sessions.list.subscribe(() => {
    const session = getMain();
    if (session?.id === lastMainId) {
      if (state.open && state.session?.id === session?.id) publish({ session });
      return;
    }
    lastMainId = session?.id;
    if (state.open) void move(session, true);
  });
  return {
    getSnapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    open: (sessionId) => move(sessionId ? sessions.list.getSnapshot().byId[sessionId] ?? { id: sessionId } : getMain(), true),
    close: () => move(state.session, false),
    registerBeforeLeave: (fn) => {
      guard = fn;
      return () => {
        if (guard === fn) guard = void 0;
      };
    },
    // Completing an intentional create workflow closes the old editor without
    // consulting its busy leave guard. No late callback can reopen it.
    completeCreate: () => {
      ++transition;
      guard = void 0;
      publish({ open: false, session: null });
    },
    dispose: () => {
      disposed = true;
      ++transition;
      stop();
      listeners.clear();
      guard = void 0;
    },
    isDisposed: () => disposed
  };
}
async function createSessionWithPreset({ sessions, uiWorkspace, fetcher = assemblerFetch, workspaceId, presetId, isCurrent = () => true }) {
  if (!workspaceId) throw new Error("\u8BF7\u9009\u62E9\u5DE5\u4F5C\u533A / Choose a workspace");
  if (!presetId) throw new Error("Missing assembly preset");
  if (!isCurrent()) throw new DOMException("Editor closed", "AbortError");
  const sessionId = await sessions.create({ workspaceId });
  if (!isCurrent()) throw new DOMException("Editor closed", "AbortError");
  const response = await fetcher(`${API_ROOT}/assembly-presets/selection`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, id: presetId })
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${response.status}`);
  if (!isCurrent()) throw new DOMException("Editor closed", "AbortError");
  await uiWorkspace.openSession(sessionId);
  return sessionId;
}
function AssemblyLauncher({ assembler, wide = true, sessionId }) {
  return (0, import_react5.createElement)("button", { type: "button", className: "dta-launcher", style: { font: "inherit", color: "inherit", border: "1px solid currentColor", borderRadius: 8, background: "transparent", padding: "7px 10px", cursor: "pointer" }, title: "\u63D0\u793A\u8BCD\u88C5\u914D / Prompt assembly", "aria-label": "\u63D0\u793A\u8BCD\u88C5\u914D", onClick: () => void assembler.open(sessionId) }, wide ? "\u63D0\u793A\u8BCD\u88C5\u914D" : "\u2318");
}
function AssemblyOverlay({ assembler, sessions, workspaces, uiWorkspace, fetcher = assemblerFetch }) {
  const state = (0, import_react5.useSyncExternalStore)(assembler.subscribe, assembler.getSnapshot, assembler.getSnapshot);
  const workspaceState = (0, import_react5.useSyncExternalStore)(workspaces.list.subscribe.bind(workspaces.list), workspaces.list.getSnapshot.bind(workspaces.list), workspaces.list.getSnapshot.bind(workspaces.list));
  const [locale, setLocale] = (0, import_react5.useState)(globalThis.navigator?.language?.startsWith("zh") ? "zh-CN" : "en");
  const [chosenWorkspace, setWorkspace] = (0, import_react5.useState)("");
  (0, import_react5.useEffect)(() => {
    if (!state.open) setWorkspace("");
  }, [state.open]);
  (0, import_react5.useEffect)(() => {
    if (!state.open) return;
    const handler = (event) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        void assembler.close();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.open, assembler]);
  if (!state.open) return null;
  const items = workspaceState.phase === "ready" ? workspaceState.items : [];
  const workspaceId = items.length === 1 ? items[0].workspaceId : items.some((w) => w.workspaceId === chosenWorkspace) ? chosenWorkspace : "";
  const controls = (0, import_react5.createElement)(
    "div",
    { className: "dta-toolbar dta-session-controls" },
    (0, import_react5.createElement)(
      "label",
      null,
      locale === "zh-CN" ? "\u65B0\u4F1A\u8BDD\u5DE5\u4F5C\u533A" : "New session workspace",
      (0, import_react5.createElement)(
        "select",
        { value: workspaceId, onChange: (e) => setWorkspace(e.target.value), disabled: items.length === 0, "aria-label": locale === "zh-CN" ? "\u65B0\u4F1A\u8BDD\u5DE5\u4F5C\u533A" : "New session workspace" },
        (0, import_react5.createElement)("option", { value: "" }, locale === "zh-CN" ? "\u8BF7\u9009\u62E9\u5DE5\u4F5C\u533A\u2026" : "Choose a workspace\u2026"),
        ...items.map((w) => (0, import_react5.createElement)("option", { key: w.workspaceId, value: w.workspaceId }, w.title))
      )
    )
  );
  const interfaceControls = (0, import_react5.createElement)("div", { className: "dta-toolbar dta-session-controls" }, (0, import_react5.createElement)("label", null, "Language / \u8BED\u8A00", (0, import_react5.createElement)("select", { value: locale, onChange: (e) => setLocale(e.target.value), "aria-label": "Language / \u8BED\u8A00" }, (0, import_react5.createElement)("option", { value: "zh-CN" }, "\u4E2D\u6587"), (0, import_react5.createElement)("option", { value: "en" }, "English"))));
  return (0, import_react5.createElement)(AssemblyPanel, {
    sessionId: state.session?.id,
    sessionLabel: sessionLabel(state.session, locale),
    locale,
    standalone: true,
    close: assembler.close,
    registerBeforeLeave: assembler.registerBeforeLeave,
    fetcher,
    refreshEvent: REFRESH_EVENT,
    createSessionControls: controls,
    interfaceControls,
    onCreateSession: async (presetId) => {
      const original = assembler.getSnapshot();
      const id = await createSessionWithPreset({
        sessions,
        uiWorkspace,
        fetcher,
        workspaceId,
        presetId,
        isCurrent: () => !assembler.isDisposed() && assembler.getSnapshot().open && assembler.getSnapshot().session?.id === original.session?.id
      });
      assembler.completeCreate();
      globalThis.window?.dispatchEvent(new Event(REFRESH_EVENT));
      return id;
    }
  });
}
function apply(ctx) {
  const assembler = createAssemblyController(ctx.sessions);
  ctx.effect(() => () => assembler.dispose());
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: `${name}-launcher`,
    order: 80,
    inject: () => ({ assembler })
  }, AssemblyLauncher));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: `${name}-editor`,
    order: 80,
    inject: () => ({ assembler, sessions: ctx.sessions, workspaces: ctx.workspaces, uiWorkspace: ctx.uiWorkspace, fetcher: assemblerFetch })
  }, AssemblyOverlay));
}

    return module.exports;
  }
});
