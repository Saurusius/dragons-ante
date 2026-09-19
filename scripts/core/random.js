const UINT32_RANGE = 0x100000000;

function hash32(value) {
  let h = 2166136261 >>> 0;
  const text = String(value);
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h += h << 13;
  h ^= h >>> 7;
  h += h << 3;
  h ^= h >>> 17;
  h += h << 5;
  return h >>> 0;
}

export function createRunSeed() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid.replaceAll("-", "").slice(0, 12).toUpperCase();

  const entropy = [
    Date.now(),
    globalThis.performance?.now?.() ?? 0,
    globalThis.navigator?.userAgent ?? "dragons-ante"
  ].join(":");
  return hash32(entropy).toString(16).padStart(8, "0").toUpperCase();
}

export function ensureRunRandomState(state) {
  state.run ??= {};
  state.run.seed = String(state.run.seed || createRunSeed());
  state.run.rngCounter = Math.max(0, Math.floor(Number(state.run.rngCounter || 0)));
  return { seed: state.run.seed, counter: state.run.rngCounter };
}

export function runRandom(state) {
  const { seed, counter } = ensureRunRandomState(state);
  const value = hash32(`${seed}:${counter}`) / UINT32_RANGE;
  state.run.rngCounter = counter + 1;
  return value;
}

export function runRandomFn(state) {
  return () => runRandom(state);
}

export function seedLabel(state) {
  return ensureRunRandomState(state).seed;
}
