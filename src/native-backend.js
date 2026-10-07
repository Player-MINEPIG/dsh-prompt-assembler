import { randomUUID } from 'node:crypto'
import { assembleRequestAsync, textOf } from './assemble.js'

import { presetBackend, validateNativePreset } from './native-policy.js'
const fail = (message, detail) => { throw Object.assign(new Error(message), { status: 409, code: 'ASSEMBLY_NATIVE_UNSUPPORTED', detail }) }
export { presetBackend, validateNativePreset } from './native-policy.js'

export function renderOfficialSections(assembly) {
  return assembly.sections.map(s => s.interpolate === false ? s.text : s.text.replace(/\{\{([^{}]*)\}\}/g, (_, key) => {
    const value = assembly.variables?.[key]
    if (!/^[a-z][a-z0-9_]*$/.test(key) || typeof value !== 'string') throw Object.assign(new Error(`Native prompt variable ${key} is unavailable`), { status: 409, code: 'NATIVE_PREVIEW_VARIABLE_UNAVAILABLE' })
    return value
  })).filter(Boolean).join('\n\n')
}

export async function assembleNative(runtime, { preset, agent, sessionId = agent?.id ?? '', assembly, inputs = [], preview = false, signal }) {
  validateNativePreset(preset)
  const snapshot = (preview ? null : runtime.resources.assembledFor?.(agent)) ?? runtime.resources.compile({ agent, sessionId, resolveOnly: true })
  if (!snapshot?.assemblyInput) throw new Error('Resource snapshot missing at native assembly')
  const nativeMessages = (agent?.session?.deriveMessages?.() ?? []).filter(m => m.role !== 'system')
  const systemText = renderOfficialSections(assembly)
  if (systemText) nativeMessages.unshift({ id: 'assembler-native-system', role: 'system', content: [{ type: 'text', text: systemText }], source: { kind: 'system-prompt' } })
  nativeMessages.push(...inputs)
  const events = agent?.session?.snapshotEvents?.() ?? []
  const logical = await assembleRequestAsync({ registry: runtime.registry, afterAssembly: runtime.afterAssembly, sessionId,
    turn: events.findLast(e => e.type === 'turn/start')?.data.turn ?? null,
    step: (events.findLast(e => e.type === 'step/start')?.data.step ?? 0) + 1,
    signal, preset, assets: { ...snapshot.assemblyInput, diagnostics: snapshot.diagnostics,
      officialSections: assembly.sections, nativeVariables: assembly.variables ?? {} },
    nativeMessages, inputIds: inputs.map(m => m.id), preview, maxBytes: runtime.resources.maxProfileBytes })
  const nativeIds = new Set(nativeMessages.map(m => m.id))
  const contributed = logical.nodes.filter(n => n.source?.module !== 'history' && n.source?.module !== 'input' && n.source?.module !== 'native-system')
  const sections = [], contexts = [], beforeInput = [], afterInput = [], variables = { ...assembly.variables }
  let ordinal = 0
  for (const node of logical.nodes) {
    if (['history', 'input'].includes(node.source?.module)) continue
    if (node.source?.module === 'native-system') { sections.push(...assembly.sections); continue }
    const rule = preset.rules.find(r => r.id === node.ruleId)
    const field = String(node.source?.field ?? node.name).replace(/[^a-zA-Z0-9_.:-]/g, '_')
    const name = `${node.source?.plugin ?? 'dsh-prompt-assembler'}:part:${String(ordinal++).padStart(4, '0')}:${node.module}:${field}`
    if (node.role === 'system') { sections.push({ name, text: node.text, interpolate: false }); node.nativeSectionName = name }
    else if (node.role === 'user') {
      const delivery = rule?.delivery ?? 'context'
      node.nativeDelivery = delivery
      const historyIndex = preset.rules.findIndex(r => r.kind === 'history')
      if (preset.rules.findIndex(r => r.id === node.ruleId) < historyIndex) fail('Preserved user-role source content must follow native history.', { ruleId: node.ruleId })
      if (delivery === 'context') {
        let variable = `dsh_prompt_assembler_context_${ordinal}`
        while (Object.hasOwn(variables, variable)) variable += "_"
        variables[variable] = node.text
        contexts.push({ name, text: `{{${variable}}}` }); node.nativeContextName = name
      } else {
        const message = { id: randomUUID(), role: 'user', content: [{ type: 'text', text: node.text }], source: { kind: 'user' } }
        const inputIndex = preset.rules.findIndex(r => r.kind === 'input')
        node.nativeMessageId = message.id
        ;(preset.rules.findIndex(r => r.id === node.ruleId) < inputIndex ? beforeInput : afterInput).push(message)
      }
    } else fail('This source returned a role unsupported by native assembly.', { ruleId: node.ruleId, role: node.role })
  }
  // Contributions must not hide or duplicate any native conversation message.
  const finalNative = logical.messages.filter(m => nativeIds.has(m.id) && m.role !== 'system')
  const expected = nativeMessages.filter(m => m.role !== 'system')
  if (JSON.stringify(finalNative.map(m => m.id)) !== JSON.stringify(expected.map(m => m.id))) fail('Native conversation order must remain unchanged.')
  const result = { ...assembly, sections, contexts: [...assembly.contexts, ...contexts], variables }
  const plan = { logical, contributed, beforeInput, afterInput, assembly: result, snapshot, backend: 'native' }
  runtime.validateResult?.({ messages: logical.messages, metadata: { assembly: logical } }, agent)
  // The Tavern recorder reads this exact waterfall result before agent/request.
  snapshot.officialAssembly = structuredClone(result)
  snapshot.sections = sections.map(s => ({ ...s, provenance: 'assembler-native', sources: contributed.filter(n => s.name === n.nativeSectionName).map(n => ({ ...n.source, text: n.text })) }))
  return plan
}

/** Only observational evidence: it never replaces the frozen AgentLoop request. */
export function observeNativePlan(plan, options, session) {
  if (!plan || !session || !Object.isFrozen(options) || JSON.stringify(options.messages) !== JSON.stringify(session.deriveMessages())) return null
  const latestSystem = options.messages.findLast(m => m.role === 'system')
  const expectedSystem = renderOfficialSections(plan.assembly)
  const systemMatches = latestSystem && textOf(latestSystem) === expectedSystem
  const visible = plan.contributed.filter(node => node.nativeSectionName ? systemMatches
    : node.nativeMessageId ? options.messages.some(m => m.id === node.nativeMessageId && textOf(m) === node.text)
    : node.nativeContextName ? options.messages.some(m => m.source?.kind === 'runtime-context' && m.source.sections?.some(s => s.name === node.nativeContextName && s.text === node.text)) : false)
  return { ...plan.logical, nodes: visible, messages: options.messages, backend: 'native' }
}
