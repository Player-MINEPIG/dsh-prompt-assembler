import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleNative } from '../src/native-backend.js'
import { assembleRequest, textOf } from '../src/assemble.js'
import { createDefaultRegistry, diagnoseTavernAssembly, NATIVE_BUILTINS, BUILTINS } from '../adapters/tavern.js'

const input = { id: 'input', role: 'user', content: [{ type: 'text', text: 'Choose option 5' }], source: { kind: 'user' } }
const assets = includeGreetingReference => ({ includeGreetingReference,
  character: { id: 'card', data: { name: 'Guide', description: 'CHARACTER', firstMessage: 'OPENING for {{user}}', alternateGreetings: ['ALTERNATE from {{char}}'] } },
  context: { user: 'Traveler' },
  preset: { id: 'preset', prompts: [{ identifier: 'charDescription', marker: true, enabled: true, role: 'user' }, { identifier: 'chatHistory', marker: true, enabled: true, role: 'user' }] },
})
for (const preset of NATIVE_BUILTINS.filter(p => ['native-slots', 'native-roles'].includes(p.placement))) {
  for (const greetingIndex of [0, 1]) test(`${preset.placement} delivers selected first-turn greeting with provenance and no assistant/depth insertion (${greetingIndex})`, async () => {
    const assemblyInput = { ...assets(true), characterSelection: { greetingIndex } }
    const runtime = { registry: createDefaultRegistry(), afterAssembly: diagnoseTavernAssembly, resources: { compile: () => ({ assemblyInput, diagnostics: [] }) } }
    const result = await assembleNative(runtime, { preset, inputs: [input], assembly: { sections: [], contexts: [], variables: {} } })
    const greeting = result.logical.nodes.filter(node => node.source?.field === 'greeting')
    assert.equal(greeting.length, 1, 'selected greeting must reach native assembly exactly once')
    assert.equal(greeting[0].text, greetingIndex ? 'ALTERNATE from Guide' : 'OPENING for Traveler')
    assert.equal(greeting[0].role, 'system')
    assert.equal(greeting[0].depth, null)
    assert.equal(greeting[0].source.resourceId, 'card')
    assert.equal(greeting[0].source.plugin, 'pmp-dsh-tavern')
    assert.ok(result.assembly.sections.some(section => section.text === greeting[0].text))
    assert.equal(result.logical.messages.some(message => message.role === 'assistant'), false)
    assert.equal(result.logical.diagnostics.some(d => d.code === 'GREETING_AFTER_INPUT'), false)
    assert.equal(assemblyInput.includeGreetingReference, true)
    assert.deepEqual(result.logical.messages.filter(message => message.id === input.id), [input])
  })
  test(`${preset.placement} respects later-turn and disabled character gating`, async () => {
    for (const enabled of [true, false]) {
      const selected = structuredClone(preset)
      selected.rules.find(rule => rule.kind === 'character').enabled = enabled
      const runtime = { registry: createDefaultRegistry(), resources: { compile: () => ({ assemblyInput: assets(!enabled) }) } }
      const result = await assembleNative(runtime, { preset: selected, inputs: [input], assembly: { sections: [], contexts: [], variables: {} } })
      assert.equal(result.logical.nodes.some(node => node.source?.field === 'greeting'), false)
    }
  })
}
test('advanced greeting keeps its assistant role and explicit depth', () => {
  const preset = structuredClone(BUILTINS[0])
  preset.rules.find(rule => rule.kind === 'character').depth = 1
  const result = assembleRequest({ registry: createDefaultRegistry(), preset, assets: assets(true), nativeMessages: [input], inputIds: [input.id] })
  const greeting = result.nodes.find(node => node.source?.field === 'greeting')
  assert.equal(greeting.role, 'assistant')
  assert.equal(greeting.depth, 1)
  assert.ok(result.messages.some(message => message.role === 'assistant' && textOf(message) === 'OPENING for Traveler'))
})
