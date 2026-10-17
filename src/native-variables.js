// Keep existing DSH text strategies usable after the Host moved cwd into runtime context.
export function nativeVariables(ctx, agent, variables = {}) {
  if (Object.hasOwn(variables, 'cwd') || !agent?.session) return variables
  const cwd = ctx.get('workingDirectory')?.get(agent.session) ?? agent.session.header?.cwd
  return typeof cwd === 'string' ? { ...variables, cwd } : variables
}
