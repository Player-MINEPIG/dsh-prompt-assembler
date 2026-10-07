import { normalizePreset } from './model.js'
const fail = (message, detail) => { throw Object.assign(new Error(message), { status: 409, code: 'ASSEMBLY_NATIVE_UNSUPPORTED', detail }) }
export function presetBackend(preset) { return preset?.backend ?? 'core' }

/** Reject unsupported layouts before changing the applied snapshot. Legacy layouts are never converted. */
export function validateNativePreset(value) {
  const preset = normalizePreset(value)
  if (presetBackend(preset) !== 'native') fail('This strategy requires the optional core assembly extension.', { backend: 'core' })
  for (const kind of ['history', 'input']) {
    const rule = preset.rules.find(r => r.kind === kind)
    if (!rule?.enabled) fail(`Native assembly must preserve ${kind}.`, { ruleId: rule?.id, kind })
  }
  let phase = 'system', afterInputMessages = false
  for (const rule of preset.rules.filter(r => r.enabled)) {
    if (rule.kind === 'history') { if (phase !== 'system') fail('Native history cannot be moved after current input.'); phase = 'before-input'; continue }
    if (rule.kind === 'input') { if (phase !== 'before-input') fail('Current input must follow native history.'); phase = 'after-input'; continue }
    if (rule.lifetime === 'snapshot' || rule.depth !== null) fail('Retained request snapshots and insertion depth require core assembly.', { ruleId: rule.id })
    if (rule.role === 'assistant') fail('Assistant-role contributions require core assembly.', { ruleId: rule.id })
    if (rule.role === 'user') {
      if (phase === 'system') fail('Native user contributions must follow native history.', { ruleId: rule.id })
      if (phase === 'before-input' && rule.delivery !== 'pre-step') fail('User context snapshots follow current input; use pre-step before input.', { ruleId: rule.id })
      if (phase === 'after-input') {
        if (rule.delivery === 'pre-step') afterInputMessages = true
        else if (afterInputMessages) fail('Native context snapshots precede post-input pre-step messages; reorder these contributions.', { ruleId: rule.id })
      }
    } else if (phase !== 'system') fail('Native system contributions must precede native history.', { ruleId: rule.id })
  }
  if (preset.placement !== 'modules') fail('ST slot/depth placement requires core assembly; choose a native strategy.')
  return preset
}
