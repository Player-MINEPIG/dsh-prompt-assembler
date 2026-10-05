const string = value => typeof value === 'string' ? value : ''
function resolveMacro(body, variables, context) {
  const macro = body.trim()
  if (macro.startsWith('//')) return ''
  const set = /^setvar::([^:]+)::([\s\S]*)$/i.exec(macro)
  if (set !== null) {
    variables.set(set[1].trim(), set[2])
    return ''
  }
  const get = /^getvar::(.+)$/i.exec(macro)
  if (get !== null) return variables.get(get[1].trim()) ?? ''
  if (/^user$/i.test(macro)) return context.user ?? 'User'
  if (/^char$/i.test(macro)) return context.character ?? 'Assistant'
  if (/^lastusermessage$/i.test(macro)) return context.lastUserMessage ?? ''
  if (/^lastcharmessage$/i.test(macro)) return context.lastAssistantMessage ?? ''
  if (/^trim$/i.test(macro)) return ''
  const random = /^random::([\s\S]+)$/i.exec(macro)
  if (random !== null) {
    const values = random[1].split(',').map((value) => value.trim()).filter(Boolean)
    if (values.length === 0) return ''
    const value = Math.min(0.999999, Math.max(0, context.random?.() ?? Math.random()))
    return values[Math.floor(value * values.length)]
  }
  const roll = /^roll\s+(\d+)d(\d+)([+-]\d+)?$/i.exec(macro)
  if (roll !== null) {
    const count = Math.min(100, Number(roll[1]))
    const sides = Math.max(1, Number(roll[2]))
    let total = Number(roll[3] ?? 0)
    for (let index = 0; index < count; index += 1) {
      const value = Math.min(0.999999, Math.max(0, context.random?.() ?? Math.random()))
      total += 1 + Math.floor(value * sides)
    }
    return String(total)
  }
  return ''
}

/** Protect source-provided literal values until all ordinary macro passes finish. */
export function protectLiteralMacros(content, literals = {}) {
  const values = Object.values(literals)
  if (values.some(value => typeof value !== 'string')) throw new TypeError('Literal macro values must be strings')
  let prefix = '\u0000TAVERN_LITERAL_'
  while ([String(content), ...values].some(value => value.includes(prefix))) prefix += '_'
  const replacements = []
  const text = String(content).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (whole, key) => {
    if (!Object.hasOwn(literals, key)) return whole
    const token = `${prefix}${replacements.length}\u0000`
    replacements.push([token, literals[key]])
    return token
  })
  const restore = value => replacements.reduce((result, [token, literal]) => result.replaceAll(token, (_match, offset, input) => {
    const line = input.slice(0, offset).split('\n').at(-1)
    return literal.replaceAll('\n', `\n${' '.repeat(line.length)}`)
  }), String(value))
  return { text, restore }
}

export function renderSillyTavernMacros(content, context = {}, variables = new Map(), options = {}) {
  const protectedText = protectLiteralMacros(string(content), options.literalMacros)
  let rendered = protectedText.text
  for (let pass = 0; pass < 5 && /\{\{[\s\S]*?\}\}/.test(rendered); pass += 1) {
    rendered = rendered.replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, (_match, body) => resolveMacro(body, variables, context))
  }
  return protectedText.restore(rendered.replaceAll('{{', '{ {').replaceAll('}}', '} }').trim())
}
