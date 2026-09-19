
import { HANDS, RANKS, SUITS, clonePlayingCard, randomPlayingCard, sortHand } from "./poker-engine.js";
import { runRandomFn } from "../core/random.js";

export const INVENTORY_LIMIT = 6;

const arcaneDefs = [
  { id: "forge-doree", name: "Forge dorée", category: "arcanes", kind: "card", price: 4, description: "Ajoute +30 Jetons bonus et l’amélioration Dorée à une carte." },
  { id: "miroir-de-cire", name: "Miroir de cire", category: "arcanes", kind: "card", price: 4, description: "Crée une copie exacte de la carte ciblée." },
  { id: "cisailles-du-deck", name: "Cisailles du deck", category: "arcanes", kind: "card", price: 4, description: "Détruit définitivement la carte ciblée." },
  { id: "transmutation-errante", name: "Transmutation errante", category: "arcanes", kind: "card", price: 4, description: "Change aléatoirement le rang et la couleur de la carte ciblée." }
];

const constellationDefs = [
  { id: "atlas-des-mains", name: "Atlas des mains", category: "constellations", kind: "hand", price: 5, description: "Augmente de 1 le niveau d’une main de poker au choix." },
  { id: "encre-runique", name: "Encre runique", category: "constellations", kind: "card", price: 5, description: "Applique l’édition Runique à une carte." },
  { id: "eclat-prismatique", name: "Éclat prismatique", category: "constellations", kind: "card", price: 6, description: "Applique l’édition Prismatique à une carte." }
];

const omenDefs = [
  { id: "sceau-de-sang", name: "Sceau de Sang", category: "presages", kind: "card", price: 3, description: "Ajoute un Sceau de Sang à une carte : elle se rejoue une fois lorsqu’elle score." },
  { id: "sceau-astral", name: "Sceau Astral", category: "presages", kind: "card", price: 3, description: "Ajoute un Sceau Astral : la carte gagne du multiplicateur lorsqu’elle score." },
  { id: "sceau-du-marchand", name: "Sceau du Marchand", category: "presages", kind: "card", price: 3, description: "Ajoute un Sceau du Marchand : la carte rapporte une pièce d’or quand elle score." },
  { id: "sceau-occult", name: "Sceau Occulte", category: "presages", kind: "card", price: 3, description: "Ajoute un Sceau Occulte : défausser la carte peut produire un nouveau Présage." }
];

export const CONSUMABLES = {
  arcanes: arcaneDefs,
  constellations: constellationDefs,
  presages: omenDefs
};

export const CONSUMABLE_MAP = new Map(
  Object.values(CONSUMABLES).flat().map(item => [item.id, item])
);

const LEGACY_CONSUMABLE_MAP = {
  tarot: { category: "arcanes", id: "forge-doree" },
  spectral: { category: "presages", id: "sceau-astral" },
  planet: { category: "constellations", id: "atlas-des-mains" }
};

function ensureInventoryShape(state) {
  state.inventory ??= { arcanes: [], constellations: [], presages: [] };
  for (const category of Object.keys(CONSUMABLES)) {
    if (!Array.isArray(state.inventory[category])) state.inventory[category] = [];
  }
  return state.inventory;
}

function rawInventoryCount(state) {
  return Object.values(state.inventory).reduce((sum, items) => sum + items.length, 0);
}

export function migrateLegacyConsumables(state) {
  ensureInventoryShape(state);
  state.legacyConsumablesPending ??= {};

  if (state.consumables && typeof state.consumables === "object") {
    for (const key of Object.keys(LEGACY_CONSUMABLE_MAP)) {
      const amount = Math.max(0, Math.floor(Number(state.consumables[key] || 0)));
      if (amount) {
        state.legacyConsumablesPending[key] =
          Math.max(0, Number(state.legacyConsumablesPending[key] || 0)) + amount;
      }
    }
    delete state.consumables;
  }

  let migrated = 0;
  for (const [legacyKey, mapping] of Object.entries(LEGACY_CONSUMABLE_MAP)) {
    let pending = Math.max(0, Math.floor(Number(state.legacyConsumablesPending[legacyKey] || 0)));
    while (pending > 0 && rawInventoryCount(state) < INVENTORY_LIMIT) {
      state.inventory[mapping.category].push(mapping.id);
      pending -= 1;
      migrated += 1;
    }
    state.legacyConsumablesPending[legacyKey] = pending;
  }

  if (Object.values(state.legacyConsumablesPending).every(value => Number(value || 0) <= 0)) {
    delete state.legacyConsumablesPending;
  }
  return migrated;
}

export function ensureDeckState(state) {
  ensureInventoryShape(state);
  migrateLegacyConsumables(state);
  return state.inventory;
}

export function inventoryCount(state) {
  ensureDeckState(state);
  return rawInventoryCount(state);
}

export function canStoreConsumable(state) {
  return inventoryCount(state) < INVENTORY_LIMIT;
}

export function addConsumable(state, id) {
  ensureDeckState(state);
  const def = CONSUMABLE_MAP.get(id);
  if (!def) return false;
  if (!canStoreConsumable(state)) return false;
  state.inventory[def.category].push(id);
  return true;
}

export function grantRandomConsumable(state, category, random = null) {
  ensureDeckState(state);
  const rng = random || runRandomFn(state);
  const pool = CONSUMABLES[category];
  if (!Array.isArray(pool) || !pool.length || !canStoreConsumable(state)) return null;
  const def = pool[Math.floor(rng() * pool.length)];
  if (!def || !addConsumable(state, def.id)) return null;
  return def.id;
}

export function removeConsumable(state, category, index) {
  ensureDeckState(state);
  if (!state.inventory[category]) return null;
  if (index < 0 || index >= state.inventory[category].length) return null;
  return state.inventory[category].splice(index, 1)[0] ?? null;
}

export function getConsumable(id) {
  return CONSUMABLE_MAP.get(id) || null;
}

export function allCards(state) {
  return [
    ...(state.hand || []),
    ...(state.drawPile || []),
    ...(state.played || []),
    ...(state.discarded || [])
  ];
}

export function findCard(state, cardId) {
  for (const zone of ["hand", "drawPile", "played", "discarded"]) {
    const cards = state[zone] || [];
    const index = cards.findIndex(card => card.id === cardId);
    if (index >= 0) return { card: cards[index], zone, index };
  }
  return null;
}

export function destroyCard(state, cardId) {
  const found = findCard(state, cardId);
  if (!found) return false;
  state[found.zone].splice(found.index, 1);
  state.cardsDestroyed = (state.cardsDestroyed || 0) + 1;
  return true;
}

function copyIntoDeck(state, card) {
  const clone = clonePlayingCard(card, `${Date.now()}-arcane`);
  state.drawPile.unshift(clone);
  state.cardsAdded = (state.cardsAdded || 0) + 1;
  return clone;
}

function randomFrom(array, random = Math.random) {
  return array[Math.floor(random() * array.length)];
}

function randomSuit(random = Math.random) {
  return randomFrom(SUITS, random);
}

function randomRank(random = Math.random) {
  return randomFrom(RANKS, random);
}

export function levelHand(state, handKey, amount = 1) {
  state.handLevels ??= {};
  state.handLevels[handKey] = Math.max(1, (state.handLevels[handKey] || 1) + amount);
  return state.handLevels[handKey];
}

function applyEdition(card, edition) {
  card.edition = edition;
  if (edition === "gilded") {
    card.bonusChips = Math.max(card.bonusChips || 0, 30);
    card.enhancement = "gold";
  }
}

function applySeal(card, seal) {
  card.seal = seal;
}

export function boosterTemplates() {
  return [
    { type: "consumable", id: "forge-doree", label: "Recevoir l’Arcane Forge dorée" },
    { type: "consumable", id: "miroir-de-cire", label: "Recevoir l’Arcane Miroir de cire" },
    { type: "consumable", id: "atlas-des-mains", label: "Recevoir la Constellation Atlas des mains" },
    { type: "consumable", id: "encre-runique", label: "Recevoir la Constellation Encre runique" },
    { type: "consumable", id: "eclat-prismatique", label: "Recevoir la Constellation Éclat prismatique" },
    { type: "consumable", id: "sceau-de-sang", label: "Recevoir le Présage Sceau de Sang" },
    { type: "consumable", id: "sceau-astral", label: "Recevoir le Présage Sceau Astral" },
    { type: "consumable", id: "sceau-du-marchand", label: "Recevoir le Présage Sceau du Marchand" },
    { type: "gold", amount: 8, label: "Gagner 8 pièces d’or" },
    { type: "level", handKey: "pair", label: "Améliorer Paire" },
    { type: "level", handKey: "straight", label: "Améliorer Suite" },
    { type: "level", handKey: "flush", label: "Améliorer Couleur" }
  ];
}

export function generateBoosterChoices(state, random = null) {
  const rng = random || runRandomFn(state);
  const pool = boosterTemplates().map(entry => ({ ...entry }));
  const picks = [];
  while (picks.length < 3 && pool.length) {
    const index = Math.floor(rng() * pool.length);
    picks.push(pool.splice(index, 1)[0]);
  }
  return picks;
}

function patchCardAfterTransform(card, newRank, newSuit) {
  card.rank = newRank.id;
  card.rankLabel = newRank.label;
  card.rankOrder = newRank.order;
  card.chips = newRank.chips;
  card.baseId = `${newRank.id}-${newSuit.id}`;
  card.suit = newSuit.id;
  card.suitSymbol = newSuit.symbol;
  card.color = newSuit.color;
}

export function applyBoosterChoice(state, choice) {
  if (!choice) return { ok: false, reason: "Choix invalide." };
  if (choice.type === "consumable") {
    if (!addConsumable(state, choice.id)) return { ok: false, reason: "Inventaire plein." };
    return { ok: true, message: `${getConsumable(choice.id)?.name || "Consommable"} ajouté à l’inventaire.` };
  }
  if (choice.type === "gold") {
    state.money = Number(state.money || 0) + Number(choice.amount || 0);
    return { ok: true, message: `${choice.amount} pièces d’or gagnées.` };
  }
  if (choice.type === "level") {
    levelHand(state, choice.handKey, 1);
    return { ok: true, message: `${HANDS[choice.handKey]?.name || choice.handKey} améliorée.` };
  }
  return { ok: false, reason: "Choix non pris en charge." };
}

export function useConsumable(state, category, index, payload = {}) {
  ensureDeckState(state);
  const id = state.inventory?.[category]?.[index];
  const def = getConsumable(id);
  if (!def) return { ok: false, reason: "Consommable introuvable." };

  const consume = () => removeConsumable(state, category, index);

  if (def.kind === "hand") {
    const handKey = payload.handKey;
    if (!handKey || !HANDS[handKey]) return { ok: false, reason: "Choisissez une main valide." };
    levelHand(state, handKey, 1);
    consume();
    return { ok: true, message: `${def.name} améliore ${HANDS[handKey].name}.` };
  }

  const found = payload.cardId ? findCard(state, payload.cardId) : null;
  if (!found) return { ok: false, reason: "Choisissez une carte du deck." };
  const card = found.card;

  switch (id) {
    case "forge-doree":
      applyEdition(card, "gilded");
      consume();
      return { ok: true, message: `${card.rankLabel}${card.suitSymbol} devient Dorée.` };
    case "miroir-de-cire":
      copyIntoDeck(state, card);
      consume();
      return { ok: true, message: `${card.rankLabel}${card.suitSymbol} est copiée.` };
    case "cisailles-du-deck":
      destroyCard(state, card.id);
      consume();
      return { ok: true, message: `La carte ${card.rankLabel}${card.suitSymbol} est détruite.` };
    case "transmutation-errante": {
      const random = runRandomFn(state);
      const newRank = randomRank(random);
      const newSuit = randomSuit(random);
      patchCardAfterTransform(card, newRank, newSuit);
      if (found.zone === "hand") sortHand(state.hand);
      consume();
      return { ok: true, message: `La carte se transforme en ${card.rankLabel}${card.suitSymbol}.` };
    }
    case "encre-runique":
      applyEdition(card, "runic");
      consume();
      return { ok: true, message: `${card.rankLabel}${card.suitSymbol} devient Runique.` };
    case "eclat-prismatique":
      applyEdition(card, "prismatic");
      consume();
      return { ok: true, message: `${card.rankLabel}${card.suitSymbol} devient Prismatique.` };
    case "sceau-de-sang":
      applySeal(card, "blood");
      consume();
      return { ok: true, message: `${card.rankLabel}${card.suitSymbol} reçoit un Sceau de Sang.` };
    case "sceau-astral":
      applySeal(card, "astral");
      consume();
      return { ok: true, message: `${card.rankLabel}${card.suitSymbol} reçoit un Sceau Astral.` };
    case "sceau-du-marchand":
      applySeal(card, "merchant");
      consume();
      return { ok: true, message: `${card.rankLabel}${card.suitSymbol} reçoit un Sceau du Marchand.` };
    case "sceau-occult":
      applySeal(card, "occult");
      consume();
      return { ok: true, message: `${card.rankLabel}${card.suitSymbol} reçoit un Sceau Occulte.` };
    default:
      return { ok: false, reason: "Effet non pris en charge." };
  }
}
