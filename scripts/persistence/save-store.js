export const SAVE_BUNDLE_SCHEMA_VERSION = 1;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readSaveBundle(raw, { fallbackState = null, fallbackProfile = null } = {}) {
  const bundle = isObject(raw) ? raw : {};
  const bundledState = isObject(bundle.state) && Object.keys(bundle.state).length ? bundle.state : null;
  const bundledProfile = isObject(bundle.profile) && Object.keys(bundle.profile).length ? bundle.profile : null;

  return {
    schemaVersion: SAVE_BUNDLE_SCHEMA_VERSION,
    state: structuredClone(bundledState ?? fallbackState ?? null),
    profile: structuredClone(bundledProfile ?? fallbackProfile ?? null),
    migratedFromLegacy: !bundledState && !bundledProfile && Boolean(fallbackState || fallbackProfile)
  };
}

export function createSaveBundle(state, profile) {
  return {
    schemaVersion: SAVE_BUNDLE_SCHEMA_VERSION,
    state: state ? structuredClone(state) : null,
    profile: profile ? structuredClone(profile) : null,
    updatedAt: Date.now()
  };
}
