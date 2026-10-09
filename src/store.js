import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { BUILTINS, normalizePreset } from './model.js'

export class AssemblyPresetStore {
  #providerPresets = new Map()
  constructor(root, { mode = () => null, builtins = BUILTINS, defaultPresetId = builtins[0]?.id, unified = false } = {}) {
    this.unified = unified; this.mode = mode; this.builtins = builtins; this.defaultPresetId = defaultPresetId
    mkdirSync(root, { recursive: true }); this.path = join(root, 'assembly-presets.json')
    this.state = { version: 1, presets: {}, selections: {} }
    try {
      const raw = readFileSync(this.path, 'utf8')
      if (Buffer.byteLength(raw) > 8 * 1024 * 1024) throw new Error('Assembly store exceeds limit')
      const state = JSON.parse(raw)
      if (state.version !== 1 || !state.presets || !state.selections) throw new Error('Invalid assembly store')
      const clean = { version: 1, presets: {}, selections: {} }
      for (const [id, preset] of Object.entries(state.presets)) {
        if (!/^[a-zA-Z0-9_-]{1,200}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id) || id.startsWith('builtin-')) throw new Error('Invalid stored preset id')
        clean.presets[id] = { ...normalizePreset(preset), id }
      }
      for (const [id, preset] of Object.entries(state.selections)) {
        if (!validSession(id.replace(/^(play|native):/, '')) || (preset !== null && typeof preset?.id !== 'string')) throw new Error('Invalid stored selection')
        clean.selections[id] = preset === null ? null : { ...normalizePreset(preset), id: preset.id }
      }
      this.state = clean
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  persist(next) {
    const text = JSON.stringify(next)
    if (Buffer.byteLength(text) > 8 * 1024 * 1024) throw new TypeError('Assembly store exceeds limit')
    const temp = `${this.path}.${randomUUID()}.tmp`
    writeFileSync(temp, text, { mode: 0o600 })
    try { renameSync(temp, this.path) } catch (error) { unlinkSync(temp); throw error }
    this.state = next
  }
  migrateLegacy(root) {
    if (join(root, 'assembly-presets.json') === this.path || !existsSync(join(root, 'assembly-presets.json'))) return false
    const legacy = new AssemblyPresetStore(root) // Validate before changing owned state.
    const builtinIds = new Set(this.builtins.map(p => p.id))
    for (const id of Object.keys(legacy.state.presets)) {
      if (!Object.hasOwn(this.state.presets, id) && (builtinIds.has(id) || this.#providerPresets.has(id))) throw new TypeError(`Duplicate assembly preset: ${id}`)
    }
    const next = structuredClone(this.state); let changed = false
    for (const area of ['presets', 'selections']) for (const [id, value] of Object.entries(legacy.state[area])) {
      if (!Object.hasOwn(next[area], id)) { next[area][id] = value; changed = true }
    }
    if (changed) this.persist(next)
    return changed
  }
  list() {
    // Applied snapshots are session state, never registrations in the catalog.
    return structuredClone([...this.builtins.map(p => ({ ...p, builtin: true })), ...this.#providerPresets.values(), ...Object.values(this.state.presets)])
  }
  registerPresets({ pluginId, presets }) {
    if (typeof pluginId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/.test(pluginId) || ['__proto__', 'constructor', 'prototype'].includes(pluginId)) throw new TypeError('Invalid preset provider pluginId')
    if (!Array.isArray(presets)) throw new TypeError('Preset registration requires an array')
    const entries = new Map(), builtinIds = new Set(this.builtins.map(p => p.id))
    for (const value of presets) {
      const id = value?.id
      if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new TypeError('Invalid registered preset id')
      if (entries.has(id) || builtinIds.has(id) || this.#providerPresets.has(id) || Object.hasOwn(this.state.presets, id)) throw new TypeError(`Duplicate assembly preset: ${id}`)
      entries.set(id, structuredClone({ ...normalizePreset(value), id, builtin: true, pluginId }))
    }
    // Validate the complete registration before publishing any catalog entries.
    for (const [id, entry] of entries) this.#providerPresets.set(id, entry)
    return () => {
      for (const [id, entry] of entries) if (this.#providerPresets.get(id) === entry) this.#providerPresets.delete(id)
    }
  }
  get(id) {
    const preset = this.list().find(p => p.id === id)
    if (!preset) throw Object.assign(new Error('Assembly preset not found'), { status: 404 })
    return preset
  }
  save(value, id) {
    if (id?.startsWith('builtin-')) throw new TypeError('Copy a built-in preset before editing')
    if (id !== undefined && this.get(id).builtin) throw new TypeError('Copy a built-in preset before editing')
    const preset = { ...normalizePreset(value), id: id ?? randomUUID() }
    const next = structuredClone(this.state); next.presets[preset.id] = preset; this.persist(next); return preset
  }
  remove(id) {
    const preset = this.get(id)
    if (id.startsWith('builtin-') || preset.builtin) throw new TypeError('Built-in presets cannot be deleted')
    if (Object.values(this.state.selections).some(s => s?.id === id)) throw Object.assign(new Error('Preset is applied to a session'), { status: 409 })
    const next = structuredClone(this.state); delete next.presets[id]; this.persist(next)
  }
  selectionKey(sessionId, mode = this.mode()) { return !this.unified && mode ? `${mode}:${sessionId}` : sessionId }
  hasSelection(sessionId) {
    return [this.selectionKey(sessionId), ...(this.unified && this.mode() ? [`${this.mode()}:${sessionId}`] : []), ...(!this.mode() ? [`native:${sessionId}`, `play:${sessionId}`] : this.mode() === 'play' ? [sessionId] : [])].some(key => Object.hasOwn(this.state.selections, key))
  }
  selection(sessionId, mode = this.mode()) {
    if (!validSession(sessionId)) return null
    const key = this.selectionKey(sessionId, mode)
    if (Object.hasOwn(this.state.selections, key)) return structuredClone(this.state.selections[key])
    if (this.unified && mode && Object.hasOwn(this.state.selections, `${mode}:${sessionId}`)) return structuredClone(this.state.selections[`${mode}:${sessionId}`])
    if (!mode) {
      for (const legacy of [`native:${sessionId}`, `play:${sessionId}`]) if (Object.hasOwn(this.state.selections, legacy)) return structuredClone(this.state.selections[legacy])
    }
    if (mode === 'play') {
      // Existing explicit selections, including disabled, remain meaningful.
      if (Object.hasOwn(this.state.selections, sessionId)) return structuredClone(this.state.selections[sessionId])
      return this.get(this.defaultPresetId)
    }
    return null
  }
  apply(sessionId, id) {
    return this.applySnapshot(sessionId, id === null ? null : this.get(id))
  }
  applySnapshot(sessionId, preset) {
    if (!validSession(sessionId)) throw new TypeError('Invalid session id')
    const next = structuredClone(this.state)
    if (preset !== null && (typeof preset?.id !== 'string' || !preset.id || preset.id.length > 200)) throw new TypeError('Snapshot requires a preset identity')
    next.selections[this.selectionKey(sessionId)] = preset === null ? null : { ...normalizePreset(preset), id: preset.id }
    this.persist(next); return this.selection(sessionId)
  }
  copySelection(from, to) {
    if (!validSession(to)) throw new TypeError('Invalid session id')
    const next = structuredClone(this.state)
    let changed = false
    for (const mode of this.unified ? [this.mode()] : this.mode() ? ['play', 'native'] : [null]) {
      const key = this.selectionKey(to, mode)
      if (Object.hasOwn(next.selections, key)) continue
      next.selections[key] = this.selection(from, mode); changed = true
    }
    if (changed) this.persist(next)
  }
}
const validSession = id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id)
