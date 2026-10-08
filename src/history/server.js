import { secureAssemblerApi } from '../api-security.js'
export const HISTORY_API_ROOT = '/dsh-prompt-assembler/api/v1/history-policy'
const send = (res, status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)) }
async function read(req) {
  const chunks = []; let size = 0
  for await (const chunk of req) { size += chunk.length; if (size > 256 * 1024) throw Object.assign(new Error('History policy request too large'), { status: 413 }); chunks.push(chunk) }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}
/** Raw route handler for composition under the existing assembler security boundary. */
export function createHistoryPolicyHandler({ service, root = HISTORY_API_ROOT }) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost'), sessionId = url.searchParams.get('sessionId')
      if (!sessionId || sessionId.length > 512) return send(res, 400, { ok: false, error: 'Session id required' })
      const selected = typeof service === 'function' ? await service(sessionId) : service
      if (url.pathname === root && req.method === 'GET') return send(res, 200, { ok: true, ...selected.store.get(sessionId), capabilities: selected.capabilities })
      if (url.pathname === root && req.method === 'PUT') {
        const body = await read(req)
        return send(res, 200, { ok: true, ...selected.save(sessionId, body.policy, body.expectedRevision), capabilities: selected.capabilities })
      }
      if (url.pathname === `${root}/preview` && req.method === 'POST') {
        const body = await read(req)
        return send(res, 200, { ok: true, ...await selected.preview(sessionId, body.policy) })
      }
      return send(res, 404, { ok: false, error: 'History route not found' })
    } catch (error) { return send(res, error.status ?? (error instanceof SyntaxError ? 400 : 500), { ok: false, code: error.code, error: error.message }) }
  }
}
/** Standalone secured API; shares the standard loopback/origin/token contract. */
export function createHistoryPolicyApi(options) { return secureAssemblerApi(createHistoryPolicyHandler(options), options.security) }
