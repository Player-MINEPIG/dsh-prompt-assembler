const field = (id, zh, en, macros = []) => ({ id, name: [zh, en], match: { field: id }, macros })
export const tavernPositions = {
  preset: [field('main', '预设主提示词', 'Preset main prompt'), field('jailbreak', '预设后置指令', 'Preset post-history instructions'), { id: 'depth', name: ['预设深度注入', 'Preset depth injections'], match: { depth: true } }, { id: 'body', name: ['预设其他正文', 'Other preset text'] }],
  character: [field('description', '角色描述', 'Character description', ['description', 'charDescription']), field('personality', '角色性格', 'Character personality', ['personality', 'charPersonality']), field('scenario', '场景', 'Scenario', ['scenario']), field('examples', '对话示例', 'Dialogue examples', ['mesexamples', 'dialogueExamples']), field('system', '角色主提示词覆盖', 'Character system override'), field('phi', '角色后置指令', 'Character post-history instructions'), field('greeting', '开场白引用', 'Greeting reference'), field('depth_prompt', '角色深度提示', 'Character depth prompt')],
  persona: [field('persona', '用户描述', 'User description', ['persona', 'personaDescription'])],
  worldbook: [
    ['before', '世界书前置组', 'World info before', ['worldInfoBefore']], ['after', '世界书后置组', 'World info after', ['worldInfoAfter']],
    ['before_example_messages', '对话示例之前', 'Before dialogue examples'], ['after_example_messages', '对话示例之后', 'After dialogue examples'],
    ['before_author_note', '作者注释之前', 'Before author note'], ['after_author_note', '作者注释之后', 'After author note'], ['depth', '世界书深度注入', 'World info at depth'],
  ].map(([id, zh, en, macros = []]) => ({ id, name: [zh, en], match: { group: id }, macros,
    ...(id === 'depth' ? {} : { anchor: id.includes('author_note') ? { sourceId: 'preset', fields: ['authorNote', 'authorsNote'], side: id.startsWith('before') ? 'before' : 'after' } : { sourceId: 'character', fields: id.includes('example') ? ['examples'] : ['description', 'personality', 'scenario', 'system'], side: id.startsWith('before') ? 'before' : 'after' } }) })),
  phi: [{ id: 'content', name: ['后置指令补充', 'Additional post-history instructions'] }],
  'tavern.mvu/state': [field('stat_data', 'MVU 变量状态与更新指令', 'MVU variable state and update instructions')],
  'pmp-dsh-tavern/prompt-template': [{ id: 'depth', name: ['模板深度注入', 'Template depth injections'], match: { depth: true } }, { id: 'content', name: ['模板独立注入', 'Standalone template injections'] }],
}

// The current Tavern loader rejects named outlets instead of silently emitting them elsewhere.
tavernPositions.worldbook.push({ id: 'outlet', name: ['世界书命名出口', 'Named worldbook outlet'], match: { group: 'outlet' }, configurable: false, note: ['当前 Tavern 加载器尚不支持命名出口；此位置不产生内容。', 'The current Tavern loader does not support named outlets; this position emits no content.'] })
