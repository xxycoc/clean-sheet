import { relatedParties, resolveParty } from './parties.js';

export function inScope(task, file, parties = []) {
  const scope = task.scope ?? {};
  const paths = Array.isArray(scope) ? scope : (scope.files ?? []);
  if (paths.some(path => path === file.path || (path.endsWith('/') && file.path.startsWith(path)))) return true;
  const allowed = (scope.parties ?? []).map(p => resolveParty(p, parties)?.name ?? p);
  return relatedParties(file, parties).some(p => allowed.includes(p.name));
}
