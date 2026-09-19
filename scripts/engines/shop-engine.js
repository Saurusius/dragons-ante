
import {
  JOKERS,
  JOKER_MAP,
  MAX_JOKERS,
  ensureJokerState,
  equipJoker,
  removeJoker
} from "./joker-engine.js";

import {
  CONSUMABLE_MAP,
  addConsumable,
  canStoreConsumable,
  generateBoosterChoices,
  applyBoosterChoice
} from "./deck-engine.js";

const RARITY_WEIGHTS = [
  ["common", 65],
  ["uncommon", 25],
  ["rare", 9],
  ["legendary", 1]
];

const COSTS = {
  common: 4,
  uncommon: 6,
  rare: 9,
  legendary: 14
};

function randomChoice(items, random = Math.random) {
  return items[Math.floor(random() * items.length)];
}

function weightedRarity(random = Math.random) {
  const roll = random() * 100;
  let cursor = 0;
  for (const [rarity, weight] of RARITY_WEIGHTS) {
    cursor += weight;
    if (roll < cursor) return rarity;
  }
  return "common";
}

function hasAtout(state, id) {
  return state.jokers?.includes(id);
}

export function jokerPrice(idOrDef) {
  const def = typeof idOrDef === "string" ? JOKER_MAP.get(idOrDef) : idOrDef;
  if (!def) return 0;
  return COSTS[def.rarity] ?? 5;
}

export function sellValue(state, id) {
  ensureJokerState(state);
  const def = JOKER_MAP.get(id);
  if (!def) return 0;

  let value = Math.max(1, Math.floor(jokerPrice(def) / 2));
  value += Math.max(0, Number(state.globalSellBonus || 0));

  if (id === "egg") {
    value += Math.max(0, Number(state.jokerState?.["egg"]?.sellBonus || 0));
  }

  return value;
}

export function spendingFloor(state) {
  return hasAtout(state, "credit-card") ? -20 : 0;
}

export function canSpend(state, amount) {
  return Number(state.money || 0) - Number(amount || 0) >= spendingFloor(state);
}

function offerPool(state) {
  const locked = new Set(state.metaLockedJokers || []);
  return JOKERS.filter(j => j.status === "live" && !state.jokers.includes(j.id) && !locked.has(j.id));
}

function rollOneOffer(state, excluded = new Set(), random = Math.random) {
  const pool = offerPool(state).filter(j => !excluded.has(j.id));
  if (!pool.length) return null;

  const desired = weightedRarity(random);
  const rarityPool = pool.filter(j => j.rarity === desired);
  const chosen = randomChoice(rarityPool.length ? rarityPool : pool, random);

  return { id: chosen.id, price: jokerPrice(chosen), purchased: false };
}

function generateOffers(state, count = 3, random = Math.random) {
  const offers = [];
  const excluded = new Set();

  while (offers.length < count) {
    const offer = rollOneOffer(state, excluded, random);
    if (!offer) break;
    excluded.add(offer.id);
    offers.push(offer);
  }

  return offers;
}

function randomConsumable(random = Math.random) {
  const defs = [...CONSUMABLE_MAP.values()];
  return randomChoice(defs, random);
}

function generateConsumableOffer(random = Math.random) {
  const def = randomConsumable(random);
  return { id: def.id, price: def.price ?? 4, purchased: false };
}

function generateBoosterOffer(random = Math.random) {
  const names = ["Booster de Forges", "Booster des Présages", "Booster des Constellations"];
  return {
    id: `booster-${Math.floor(random()*1e6)}`,
    name: randomChoice(names, random),
    price: 6,
    purchased: false
  };
}

export function ensureShop(state, force = false) {
  ensureJokerState(state);
  const session = `${state.run?.ante || 1}-${state.run?.blindIndex || 0}`;

  if (force || !state.run?.shop || state.run.shop.session !== session) {
    state.run.shop = {
      session,
      offers: generateOffers(state),
      consumableOffer: generateConsumableOffer(),
      boosterOffer: generateBoosterOffer(),
      rerollCost: 1,
      freeRerolls: hasAtout(state, "chaos-the-clown") ? 1 : 0,
      rerolls: 0,
      purchases: 0,
      sales: 0,
      pendingBooster: null
    };
  }

  return state.run.shop;
}

export function buyOffer(state, index) {
  const shop = ensureShop(state);
  const offer = shop.offers[index];
  if (!offer || offer.purchased) return { ok: false, reason: "Offre indisponible." };

  const def = JOKER_MAP.get(offer.id);
  if (!def || def.status !== "live") return { ok: false, reason: "Cet Atout n’est pas encore disponible." };
  if (state.jokers.length >= MAX_JOKERS) return { ok: false, reason: "Vos 5 emplacements d’Atouts sont occupés." };
  if (state.jokers.includes(offer.id)) return { ok: false, reason: "Vous possédez déjà cet Atout." };
  if (!canSpend(state, offer.price)) return { ok: false, reason: "Vous n’avez pas assez de pièces d’or." };

  state.money -= offer.price;
  if (!equipJoker(state, offer.id)) return { ok: false, reason: "Impossible d’équiper cet Atout." };

  offer.purchased = true;
  shop.purchases += 1;
  return { ok: true, id: offer.id, price: offer.price };
}

export function buyConsumableOffer(state) {
  const shop = ensureShop(state);
  const offer = shop.consumableOffer;
  if (!offer || offer.purchased) return { ok: false, reason: "Offre indisponible." };
  if (!canStoreConsumable(state)) return { ok: false, reason: "Inventaire de consommables plein." };
  if (!canSpend(state, offer.price)) return { ok: false, reason: "Vous n’avez pas assez de pièces d’or." };

  state.money -= offer.price;
  if (!addConsumable(state, offer.id)) return { ok: false, reason: "Impossible de stocker ce consommable." };
  offer.purchased = true;
  shop.purchases += 1;
  return { ok: true, id: offer.id, price: offer.price };
}

export function buyBoosterOffer(state) {
  const shop = ensureShop(state);
  const offer = shop.boosterOffer;
  if (!offer || offer.purchased) return { ok: false, reason: "Offre indisponible." };
  if (!canSpend(state, offer.price)) return { ok: false, reason: "Vous n’avez pas assez de pièces d’or." };

  state.money -= offer.price;
  offer.purchased = true;
  shop.purchases += 1;
  shop.pendingBooster = {
    name: offer.name,
    choices: generateBoosterChoices()
  };
  return { ok: true, price: offer.price, pending: shop.pendingBooster };
}

export function chooseBoosterReward(state, index) {
  const shop = ensureShop(state);
  const pending = shop.pendingBooster;
  if (!pending) return { ok: false, reason: "Aucun booster n’est ouvert." };
  const choice = pending.choices?.[index];
  if (!choice) return { ok: false, reason: "Choix invalide." };
  const result = applyBoosterChoice(state, choice);
  if (result.ok) shop.pendingBooster = null;
  return result;
}

export function rerollShop(state) {
  const shop = ensureShop(state);

  let cost = 0;
  if (shop.freeRerolls > 0) {
    shop.freeRerolls -= 1;
  } else {
    cost = shop.rerollCost;
    if (!canSpend(state, cost)) return { ok: false, reason: "Pas assez de pièces d’or pour relancer." };
    state.money -= cost;
    shop.rerollCost += 1;
  }

  shop.rerolls += 1;
  state.shopRerolls = (state.shopRerolls || 0) + 1;

  if (hasAtout(state, "flash-card")) {
    const js = state.jokerState["flash-card"] ??= {};
    js.mult = (js.mult || 0) + 2;
  }

  shop.offers = generateOffers(state);
  shop.consumableOffer = generateConsumableOffer();
  shop.boosterOffer = generateBoosterOffer();

  return { ok: true, cost };
}

export function sellJoker(state, id) {
  const shop = ensureShop(state);
  if (!state.jokers.includes(id)) return { ok: false, reason: "Atout non équipé." };

  const value = sellValue(state, id);
  const campfireActive = state.jokers.includes("campfire") && id !== "campfire";

  if (id === "luchador" && state.run?.blindIndex === 1) {
    state.run.bossDisabled = true;
  }

  if (campfireActive) {
    const js = state.jokerState["campfire"] ??= {};
    js.xmult = (js.xmult || 1) + 0.25;
  }

  if (!removeJoker(state, id)) return { ok: false, reason: "Impossible de vendre cet Atout." };

  state.money += value;
  shop.sales += 1;
  return { ok: true, value };
}
