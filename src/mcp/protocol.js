import { toolDefinitions, validateTool } from './tools.js';
import { result } from './channel.js';

export function createProtocol(channel, definitions = toolDefinitions) {
  return async function dispatch(request, session = 'stdio') {
    const id = request?.id ?? null;
    const error = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
    if (!request || typeof request !== 'object' || Array.isArray(request) || request.jsonrpc !== '2.0' || typeof request.method !== 'string' ||
      (Object.hasOwn(request, 'id') && request.id !== null && !['string', 'number'].includes(typeof request.id))) return error(-32600, 'Invalid Request');
    const notification = !Object.hasOwn(request, 'id');
    // Notifications never execute tools: there is no response on which a worker can rely.
    if (notification) return null;
    try {
      let response;
      switch (request.method) {
        case 'initialize': response = { protocolVersion: ['2024-11-05', '2025-03-26', '2025-06-18'].includes(request.params?.protocolVersion) ? request.params.protocolVersion : '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'clean-sheet-keeper', version: '1.0.0' }, instructions: 'Use start_task to declare scope. All effects are confined to the local demo runtime.' }; break;
        case 'ping': response = {}; break;
        case 'tools/list': response = { tools: definitions }; break;
        case 'tools/call': {
          if (!request.params || typeof request.params.name !== 'string') return error(-32602, 'Tool name is required');
          const args = request.params.arguments ?? {};
          if (definitions === toolDefinitions) {
            try { validateTool(request.params.name, args); } catch (e) {
              channel.emitEvent?.({ type: 'tool.rejected', tool: request.params.name, reason: e.message });
              return error(-32602, e.message);
            }
          }
          try { response = await channel.call(request.params.name, args, session); }
          catch (e) { channel.emitEvent?.({ type: 'tool.failed', tool: request.params.name, reason: e.message }); response = result(`Tool failed: ${e.message}`, {}, true); }
          break;
        }
        default: return error(-32601, 'Method not found');
      }
      return { jsonrpc: '2.0', id, result: response };
    } catch { return error(-32603, 'Internal error'); }
  };
}

export async function parseDispatch(text, dispatch, session) {
  let request;
  try { request = JSON.parse(text); } catch { return { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }; }
  return dispatch(request, session);
}
