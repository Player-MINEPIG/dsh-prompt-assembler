#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, renameSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const version = '0.2.0-rc.2', addon = 'dsh-prompt-assembler-core'
const files = ['session', 'agent-loop'].flatMap(name => ['index.js', 'index.js.map', 'invariant.js', 'invariant.js.map'].map(file => `${name}/lib/${file}`))
const json = path => JSON.parse(readFileSync(path, 'utf8'))
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const atomicJson = (path, value) => { writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); renameSync(`${path}.tmp`, path) }
const packageFile = (runtime, relative) => join(runtime, 'node_modules/@deepseek-ai', `dsh-${relative}`)
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to) }

/** Caller must stop the intended Host before entering this operation. */
export async function switchRuntime({ action, runtime, home, profile = 'web', prepared, stock, npm = 'npm', packagePath, runPlugin }) {
  if (!['install', 'uninstall'].includes(action)) throw new Error('Action must be install or uninstall')
  if (!runtime || !home || !/^[a-zA-Z0-9_-]+$/.test(profile)) throw new Error('Explicit runtime, home and valid profile are required')
  runtime = resolve(runtime); home = resolve(home)
  const profileDir = join(home, 'profiles', profile), stateDir = join(profileDir, '.assembler-core-switch'), receiptPath = join(stateDir, 'receipt.json')
  const profileManifest = join(profileDir, 'package.json'), storePath = join(home, 'dsh-prompt-assembler/assembly-presets.json')
  const profileData = json(profileManifest)
  for (const name of ['session', 'agent-loop']) if (json(packageFile(runtime, `${name}/package.json`)).version !== version) throw new Error(`Unsupported runtime dsh-${name}; expected ${version}`)
  if (json(join(profileDir, 'node_modules/dsh-prompt-assembler/package.json')).version !== '0.2.0') throw new Error('Install standard dsh-prompt-assembler@0.2.0 first')
  let receipt = existsSync(receiptPath) ? json(receiptPath) : null
  if (!receipt) {
    if (action !== 'install' || !prepared || !stock) throw new Error('First install requires --prepared and --stock-runtime; uninstall requires an installation receipt')
    prepared = resolve(prepared); stock = resolve(stock)
    const input = json(join(prepared, 'receipt.json'))
    if (input.sourceVersion !== version || input.requestAssemblyVersion !== 1) throw new Error('Prepared protocol-1 rc.2 receipt required')
    for (const name of ['session', 'agent-loop']) if (json(packageFile(stock, `${name}/package.json`)).version !== version) throw new Error('Stock runtime must use rc.2')
    const hashes = Object.fromEntries(files.map(file => [file, { standard: hash(packageFile(stock, file)), advanced: hash(join(prepared, file)) }]))
    if (readFileSync(packageFile(stock, 'agent-loop/lib/index.js'), 'utf8').includes('requestAssemblyVersion')) throw new Error('Stock runtime is already prepared')
    for (const file of files) if (![hashes[file].standard, hashes[file].advanced].includes(hash(packageFile(runtime, file)))) throw new Error(`Unrecognized runtime build: ${file}`)
    mkdirSync(stateDir, { recursive: true })
    for (const file of files) { copy(packageFile(stock, file), join(stateDir, 'standard', file)); copy(join(prepared, file), join(stateDir, 'advanced', file)) }
    receipt = { version: 1, runtime, home, profile, files: hashes, mode: 'standard', source: input }
    atomicJson(receiptPath, receipt)
  }
  if (receipt.version !== 1 || receipt.runtime !== runtime || receipt.home !== home || receipt.profile !== profile) throw new Error('Receipt belongs to another runtime/profile')
  for (const file of files) {
    const hashes = receipt.files[file]
    if (!hashes || hash(join(stateDir, 'standard', file)) !== hashes.standard || hash(join(stateDir, 'advanced', file)) !== hashes.advanced) throw new Error(`Backup verification failed: ${file}`)
    if (![hashes.standard, hashes.advanced].includes(hash(packageFile(runtime, file)))) throw new Error(`Runtime changed outside this installer: ${file}`)
  }
  let selections, migrated = 0
  if (action === 'uninstall' && existsSync(storePath)) {
    selections = json(storePath)
    const { NATIVE_BUILTINS } = await import(pathToFileURL(join(profileDir, 'node_modules/dsh-prompt-assembler/adapters/tavern.js')))
    const fallback = NATIVE_BUILTINS.find(p => p.id === 'builtin-native-slots')
    for (const [id, selected] of Object.entries(selections.selections ?? {})) if (selected && (selected.backend ?? 'core') === 'core') {
      selections.selections[id] = structuredClone(fallback); migrated++
    }
    if (migrated) copy(storePath, join(stateDir, 'selections-before-uninstall.json'))
  }
  if (!runPlugin) {
    const require = createRequire(join(runtime, 'package.json'))
    const api = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-plugin-manager/operations')))
    runPlugin = args => api.runPluginCommand({ profile, dir: profileDir, installAnchor: join(runtime, 'package.json'), cwd: runtime }, args, {
      command: npm, execution: 'service', outputBytes: 4096, lockWaitMs: 120000, lookupTimeoutMs: 120000, activateNewBundles: true,
      env: { PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}`, DSH_HOME: home,
        ...Object.fromEntries(['npm_config_userconfig', 'npm_config_globalconfig'].filter(key => process.env[key]).map(key => [key, process.env[key]])) }
    })
  }
  let result
  if (action === 'install') {
    if (!packagePath) {
      const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
      const packed = JSON.parse(execFileSync(npm, ['pack', coreRoot, '--json', '--ignore-scripts', '--pack-destination', stateDir], { encoding: 'utf8' }))[0]
      packagePath = join(stateDir, packed.filename)
    }
    result = await runPlugin(['add', resolve(packagePath), '--ignore-scripts'])
  } else if (profileData.dependencies?.[addon]) result = await runPlugin(['remove', addon, '--ignore-scripts'])
  if (result && result.exitCode !== 0) throw new Error(`Plugin operation failed; core files unchanged. See ${result.logPath ?? 'plugin-manager log'}`)
  const mode = action === 'install' ? 'advanced' : 'standard'
  for (const file of files) copy(join(stateDir, mode, file), packageFile(runtime, file))
  if (migrated) atomicJson(storePath, selections)
  atomicJson(receiptPath, { ...receipt, mode })
  return { mode, migratedSelections: migrated, profile, version, receiptPath }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, ...args] = process.argv.slice(2), options = { action }
  const keys = { '--runtime': 'runtime', '--home': 'home', '--profile': 'profile', '--prepared': 'prepared', '--stock-runtime': 'stock', '--npm': 'npm', '--package': 'packagePath' }
  for (let i = 0; i < args.length; i += 2) {
    if (!keys[args[i]] || !args[i + 1]) throw new Error('Usage: switch-runtime.mjs install|uninstall --runtime <runtime> --home <DSH_HOME> [--profile web] [--prepared <output> --stock-runtime <stock-runtime>] [--npm <npm>]')
    options[keys[args[i]]] = args[i + 1]
  }
  console.log(JSON.stringify(await switchRuntime(options), null, 2))
}
