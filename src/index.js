export { ASSEMBLY_SERVICE, SOURCE_PROTOCOL_VERSION, RequestSourceRegistry } from './registry.js'
export { assembleRequest, assembleRequestAsync, textOf } from './assemble.js'
export { FORMAT, BUILTINS, normalizePreset, moveRule } from './model.js'
export { createDshRegistry, registerDshSources, parseDshText } from '../adapters/dsh.js'
export { RequestAssembler } from './runtime.js'
export { AssemblyPresetStore } from './store.js'
export { projectSystemSnapshots } from './system-snapshots.js'

// The package root is both a Cordis plugin and the composable library.
export { name, inject, apply, default } from './plugin.js'

export { presetBackend, validateNativePreset } from './native-policy.js'
