/** Stock rc.2 DeepSeek Messages v1 stores type/signature metadata, never text hashes.
 * Only text bytes may change: keep every block, index, reasoning byte and signature.
 * Unknown fields/formats fail closed until their owning adapter contract is verified.
 */
export function supportsReplayTextEdits(message) {
  const source = message.source, replay = source?.replayState, response = replay?.response
  const exact = (object, allowed) => object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).every(key => allowed.includes(key))
  return message.role === 'assistant' && source?.kind === 'model'
    && exact(replay, ['response', 'blocks']) && exact(response, ['kind', 'version', 'model'])
    && response.kind === 'deepseek-messages' && response.version === 1 && typeof response.model === 'string' && response.model === source.model
    && Array.isArray(replay.blocks) && replay.blocks.length === message.content.length
    && replay.blocks.every((block, index) => exact(block, ['type', 'signature'])
      && ['text', 'reasoning', 'tool-call'].includes(block.type) && block.type === message.content[index].type
      && (block.signature === undefined || (block.type === 'reasoning' && typeof block.signature === 'string')))
}
