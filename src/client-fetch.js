export const API_ROOT = '/dsh-prompt-assembler/api/v1'

// The opaque request token is CSRF protection. Host authentication stays in
// the official desktop proxy, rather than entering the plugin's JavaScript.
export function createAssemblerFetch({ fetcher = (...args) => globalThis.fetch(...args), protocol = () => globalThis.location?.protocol } = {}) {
  let tokenPromise
  const requestToken = () => tokenPromise ??= fetcher(`${API_ROOT}/request-token`, {
    headers: { 'X-Assembler-Client': 'embedded' }, cache: 'no-store',
  }).then(async response => {
    if (!response.ok) throw new Error(`Assembler request token: HTTP ${response.status}`)
    const { token } = await response.json()
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid assembler request token')
    return token
  }).catch(error => { tokenPromise = undefined; throw error })
  return async (url, options = {}) => {
    // Never let a caller carry this plugin's token outside its own API root.
    if (typeof url !== 'string' || !url.startsWith(`${API_ROOT}/`) || /[\\#]/.test(url) || url.split('?')[0].split('/').some(part => {
      try { return ['.', '..'].includes(decodeURIComponent(part)) || /[/\\]/.test(decodeURIComponent(part)) } catch { return true }
    })) throw new Error('Invalid assembler API path')
    const method = String(options.method ?? 'GET').toUpperCase()
    if (protocol() !== 'dsh-app:' || ['GET', 'HEAD', 'OPTIONS'].includes(method)) return fetcher(url, options)
    const send = async () => {
      const headers = new Headers(options.headers)
      headers.set('X-Assembler-Request-Token', await requestToken())
      return fetcher(url, { ...options, headers })
    }
    const response = await send()
    if (response.status !== 403) return response
    const error = await response.clone().json().catch(() => null)
    if (error?.code !== 'ASSEMBLER_API_ORIGIN_FORBIDDEN') return response
    tokenPromise = undefined // Rejected writes have no side effects; Host may have restarted.
    return send()
  }
}

export const assemblerFetch = createAssemblerFetch()
