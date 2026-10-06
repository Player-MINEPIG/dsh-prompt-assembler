import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const result = await build({
  absWorkingDir: root, entryPoints: ['src/plugin-client.js'], bundle: true,
  format: 'cjs', platform: 'browser', target: 'es2022', write: false,
  external: ['react', '@deepseek-ai/*'],
})
await mkdir(new URL('../dist/', import.meta.url), { recursive: true })
await writeFile(new URL('../dist/client.js', import.meta.url), `window.__ModuleLoader__.load({
  id: "dsh-prompt-assembler",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${result.outputFiles[0].text}
    return module.exports;
  }
});
`)
console.log('built dist/client.js')
