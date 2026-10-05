import { RequestAssembler as CoreAssembler } from '../src/runtime.js'
import { AssemblyPresetStore as CoreStore } from '../src/store.js'
import { BUILTINS, createDefaultRegistry, diagnoseTavernAssembly } from './tavern.js'
export class RequestAssembler extends CoreAssembler {
  constructor(options) { super({ ...options, owner: 'pmp-dsh-tavern', afterAssembly: diagnoseTavernAssembly, registry: options.registry ?? createDefaultRegistry() }) }
}
export class AssemblyPresetStore extends CoreStore {
  constructor(root, options = {}) { super(root, { ...options, builtins: BUILTINS, defaultPresetId: 'builtin-st' }) }
}
