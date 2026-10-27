import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import assembler from '../src/plugin.js'

test('shared service exposes the running Assembler package version', async () => {
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'assembler-version-'))
  try {
    ctx.provide('systemPrompt', { assemble() {}, section() {} })
    ctx.provide('sessionController', {})
    await ctx.plugin(assembler, { storageDir: directory })
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
    assert.equal(ctx.get('dshPromptAssembler').version, manifest.version)
  } finally {
    await ctx.fiber.dispose()
    rmSync(directory, { recursive: true, force: true })
  }
})
