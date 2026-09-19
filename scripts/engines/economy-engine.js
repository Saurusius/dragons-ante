import { JOKER_MAP } from "../data/jokers-data.js";

const COSTS = {
  common: 4,
  uncommon: 6,
  rare: 9,
  legendary: 14
};

export function jokerPrice(idOrDef) {
  const def = typeof idOrDef === "string" ? JOKER_MAP.get(idOrDef) : idOrDef;
  if (!def) return 0;
  return COSTS[def.rarity] ?? 5;
}

export function sellValue(state, id) {
  const def = JOKER_MAP.get(id);
  if (!def) return 0;

  let value = Math.max(1, Math.floor(jokerPrice(def) / 2));
  value += Math.max(0, Number(state?.globalSellBonus || 0));

  if (id === "egg") {
    value += Math.max(0, Number(state?.jokerState?.egg?.sellBonus || 0));
  }

  return value;
}

export function spendingFloor(state) {
  return state?.jokers?.includes("credit-card") ? -20 : 0;
}

export function canSpend(state, amount) {
  return Number(state?.money || 0) - Number(amount || 0) >= spendingFloor(state);
}
