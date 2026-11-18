import { hash } from './hash.js';

export function verify(rows, expectedHead) {
  let previous = null;
  for (let i = 0; i < rows.length; i++) {
    const { hash: digest, ...payload } = rows[i];
    if (payload.seq !== i + 1 || payload.prev_hash !== previous || hash(payload) !== digest) return false;
    previous = digest;
  }
  return expectedHead === undefined || expectedHead === previous;
}
export class AuditLog {
  #rows = [];
  #clock;
  constructor(clock = () => new Date().toISOString()) { this.#clock = clock; }
  append(event) {
    const payload = { ...structuredClone(event), time: this.#clock(), seq: this.#rows.length + 1, prev_hash: this.#rows.at(-1)?.hash ?? null };
    const row = { ...payload, hash: hash(payload) };
    this.#rows.push(row);
    return structuredClone(row);
  }
  get rows() { return structuredClone(this.#rows); }
  get head() { return this.#rows.at(-1)?.hash ?? null; }
  verify(rows = this.#rows, expectedHead = this.head) { return verify(rows, expectedHead); }
}
