import { createDeck, shuffle, drawToHand } from "./poker-engine.js";
import { ensureJokerState, prepareRound } from "./joker-engine.js";
import { createRunSeed, ensureRunRandomState, runRandom, runRandomFn } from "../core/random.js";

export const MAX_ANTE = 8;

export const BOSSES = [
  {
    id: "ash-wyrm",
    name: "Le Wyrm des Cendres",
    icon: "♠",
    targetFactor: 2.00,
    description: "La chaleur vous épuise : -1 Main.",
    modifiers: { hands: -1 }
  },
  {
    id: "mirror-sphinx",
    name: "La Sphinx des Miroirs",
    icon: "♦",
    targetFactor: 2.05,
    description: "Chaque choix compte : -1 Défausse.",
    modifiers: { discards: -1 }
  },
  {
    id: "felt-lich",
    name: "La Liche du Tapis Vert",
    icon: "♣",
    targetFactor: 2.10,
    description: "Sa présence glace votre jeu : -1 carte en main.",
    modifiers: { handSize: -1 }
  },
  {
    id: "toll-hydra",
    name: "L’Hydre du Péage",
    icon: "♥",
    targetFactor: 2.15,
    description: "Plus la partie dure, plus elle mord : -1 Main.",
    modifiers: { hands: -1 }
  },
  {
    id: "obsidian-basilisk",
    name: "Le Basilic d’Obsidienne",
    icon: "♠",
    targetFactor: 2.15,
    description: "Son regard fige vos options : -1 carte en main et -1 Défausse.",
    modifiers: { handSize: -1, discards: -1 }
  },
  {
    id: "treasure-griffin",
    name: "Le Griffon du Trésor",
    icon: "♦",
    targetFactor: 2.20,
    description: "Il défend jalousement sa mise : -1 Main.",
    modifiers: { hands: -1 }
  },
  {
    id: "iron-dragon",
    name: "Le Dragon de Fer",
    icon: "♣",
    targetFactor: 2.25,
    description: "Une table sans pitié : -1 Main et -1 carte en main.",
    modifiers: { hands: -1, handSize: -1 }
  },
  {
    id: "elder-dragon",
    name: "L’Ancien Dragon",
    icon: "♛",
    targetFactor: 2.35,
    description: "Le dernier pari : -1 Main, -1 Défausse et -1 carte en main.",
    modifiers: { hands: -1, discards: -1, handSize: -1 }
  }
];

const BLINDS = [
  { type: "small", name: "Petite Mise", icon: "◆", targetFactor: 1.00, baseReward: 3 },
  { type: "big", name: "Grande Mise", icon: "◆◆", targetFactor: 1.50, baseReward: 4 },
];

function fullDeck(state) {
  const cards = [
    ...(state.hand || []),
    ...(state.drawPile || []),
    ...(state.played || []),
    ...(state.discarded || [])
  ];
  return cards.length ? cards : createDeck();
}

function roundedTarget(value) {
  return Math.max(50, Math.round(value / 10) * 10);
}

export function anteBaseTarget(ante) {
  return roundedTarget(300 * Math.pow(1.65, Math.max(0, ante - 1)));
}

function ensureBossOrder(state) {
  ensureRunRandomState(state);
  const valid = Array.isArray(state.run.bossOrder)
    && state.run.bossOrder.length === BOSSES.length
    && state.run.bossOrder.every(id => BOSSES.some(boss => boss.id === id));

  if (valid) return state.run.bossOrder;

  const order = BOSSES.map(boss => boss.id);
  const random = runRandomFn(state);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  state.run.bossOrder = order;
  return order;
}

export function bossForAnte(ante, state = null) {
  if (!state) return BOSSES[(Math.max(1, ante) - 1) % BOSSES.length];
  const order = ensureBossOrder(state);
  const id = order[(Math.max(1, ante) - 1) % order.length];
  return BOSSES.find(boss => boss.id === id) || BOSSES[0];
}

export function ensureRunState(state) {
  if (!state.run || typeof state.run !== "object") {
    state.run = {
      version: 1,
      ante: 1,
      maxAnte: MAX_ANTE,
      blindIndex: 0,
      phase:
        state.status === "won" ? "blind-complete" :
        state.status === "lost" ? "run-over" :
        "blind",
      roundResolved: state.status !== "playing",
      bossDisabled: false,
      blindsWon: Math.max(0, state.roundsCompleted || 0),
      totalRewards: 0,
      lastReward: null,
      shop: null,
      history: [],
      startedAt: state.createdAt || Date.now()
    };
  }

  state.run.maxAnte ??= MAX_ANTE;
  ensureRunRandomState(state);
  ensureJokerState(state);
  ensureBossOrder(state);
  state.run.ante = Math.max(1, Number(state.run.ante || 1));
  state.run.blindIndex = Math.max(0, Math.min(2, Number(state.run.blindIndex || 0)));
  state.run.phase ??= "blind";
  state.run.roundResolved ??= false;
  state.run.bossDisabled ??= false;
  state.run.blindsWon ??= 0;
  state.run.totalRewards ??= 0;
  state.run.history ??= [];

  return state.run;
}

export function initializeFreshRun(state, { seed = createRunSeed() } = {}) {
  state.run = {
    version: 2,
    schemaVersion: 3,
    seed: String(seed),
    rngCounter: 0,
    bossOrder: null,
    ante: 1,
    maxAnte: MAX_ANTE,
    blindIndex: 0,
    phase: "blind",
    roundResolved: false,
    bossDisabled: false,
    blindsWon: 0,
    totalRewards: 0,
    lastReward: null,
    shop: null,
    history: [],
    startedAt: Date.now()
  };

  ensureRunRandomState(state);
  ensureJokerState(state);

  state.money = 4;
  state.hand = [];
  state.drawPile = createDeck();
  state.played = [];
  state.discarded = [];
  state.selected = [];
  state.jokers = [];
  state.jokerState = {};
  state.globalSellBonus = 0;
  state.shopRerolls = 0;
  state.handLevels = {};
  state.runHandCounts = {};
  state.runHandsPlayed = 0;
  state.roundsCompleted = 0;
  state.startingDeckSize = 52;
  state.cardsAdded = 0;
  state.cardsDestroyed = 0;
  state.discardedCardCount = 0;

  startCurrentBlind(state);
  return state;
}

export function getBlind(state, index = null) {
  ensureRunState(state);
  const blindIndex = index === null ? state.run.blindIndex : index;
  const base = anteBaseTarget(state.run.ante);

  if (blindIndex < 2) {
    const def = BLINDS[blindIndex];
    return {
      ...def,
      ante: state.run.ante,
      index: blindIndex,
      target: roundedTarget(base * def.targetFactor),
      isBoss: false,
      disabled: false,
      description:
        blindIndex === 0
          ? "La première marche de l’Ante."
          : "Une mise plus lourde avant le Boss."
    };
  }

  const boss = bossForAnte(state.run.ante, state);
  const disabled = Boolean(state.run.bossDisabled || state.jokers?.includes("chicot"));

  return {
    ...boss,
    type: "boss",
    ante: state.run.ante,
    index: 2,
    target: roundedTarget(base * boss.targetFactor),
    baseReward: 6,
    isBoss: true,
    disabled,
    description: disabled ? "Capacité neutralisée." : boss.description
  };
}

export function getNextBlind(state) {
  ensureRunState(state);
  const nextIndex = Math.min(2, state.run.blindIndex + 1);
  return getBlind(state, nextIndex);
}

export function startCurrentBlind(state) {
  ensureRunState(state);
  const blind = getBlind(state);

  const deck = shuffle(fullDeck(state).map(card => ({ ...card })), runRandomFn(state));

  state.status = "playing";
  state.target = blind.target;
  state.score = 0;
  state.baseHands = 4;
  state.baseDiscards = 3;
  state.baseHandSize = 8;
  state.handsRemaining = 4;
  state.discardsRemaining = 3;
  state.handSize = 8;
  state.hand = [];
  state.drawPile = deck;
  state.played = [];
  state.discarded = [];
  state.selected = [];
  state.lastResult = null;
  state.roundHandsPlayed = 0;
  state.roundDiscardsUsed = 0;
  state.roundSettled = false;

  state.run.phase = "blind";
  state.run.roundResolved = false;
  state.run.lastReward = null;
  state.run.shop = null;

  prepareRound(state);
  applyBossRule(state, blind);
  drawToHand(state);

  state.updatedAt = Date.now();
  return blind;
}

function applyBossRule(state, blind) {
  if (!blind.isBoss || blind.disabled) return;

  const mods = blind.modifiers || {};
  if (mods.hands) state.handsRemaining = Math.max(1, state.handsRemaining + mods.hands);
  if (mods.discards) state.discardsRemaining = Math.max(0, state.discardsRemaining + mods.discards);
  if (mods.handSize) state.handSize = Math.max(5, state.handSize + mods.handSize);
}

export function rewardForBlind(state) {
  const blind = getBlind(state);
  const base = blind.baseReward || 3;
  const hands = Math.max(0, state.handsRemaining || 0);
  const interest = Math.min(5, Math.floor(Math.max(0, state.money || 0) / 5));
  return {
    base,
    hands,
    interest,
    total: base + hands + interest
  };
}

export function resolveBlind(state) {
  ensureRunState(state);
  if (state.run.roundResolved) return state.run.lastReward;

  state.run.roundResolved = true;
  const blind = getBlind(state);

  if (state.status === "lost") {
    state.run.phase = "run-over";
    state.run.history.push({
      ante: state.run.ante,
      blindIndex: state.run.blindIndex,
      blind: blind.name,
      target: state.target,
      score: state.score,
      won: false,
      money: state.money,
      at: Date.now()
    });
    return null;
  }

  if (state.status !== "won") return null;

  const reward = rewardForBlind(state);
  state.money += reward.total;
  state.run.totalRewards += reward.total;
  state.run.blindsWon += 1;
  state.run.lastReward = reward;

  state.run.history.push({
    ante: state.run.ante,
    blindIndex: state.run.blindIndex,
    blind: blind.name,
    target: state.target,
    score: state.score,
    won: true,
    reward: reward.total,
    money: state.money,
    at: Date.now()
  });

  if (blind.isBoss && state.run.ante >= state.run.maxAnte) {
    state.run.phase = "run-won";
  } else {
    state.run.phase = "blind-complete";
  }

  return reward;
}

export function advanceAfterBlind(state) {
  ensureRunState(state);
  if (state.run.phase !== "blind-complete") return state.run.phase;

  const blind = getBlind(state);

  if (blind.isBoss) {
    state.run.ante += 1;
    state.run.blindIndex = 0;
    state.run.bossDisabled = false;
    startCurrentBlind(state);
    return "blind";
  }

  state.run.phase = "shop";
  state.run.shop = null;
  return "shop";
}

export function leaveShop(state) {
  ensureRunState(state);
  if (state.run.phase !== "shop") return false;
  if (state.run.shop?.pendingBooster) return false;

  state.run.blindIndex = Math.min(2, state.run.blindIndex + 1);
  state.run.shop = null;
  startCurrentBlind(state);
  return true;
}

export function runSummary(state) {
  ensureRunState(state);
  return {
    ante: state.run.ante,
    maxAnte: state.run.maxAnte,
    blind: getBlind(state),
    blindsWon: state.run.blindsWon,
    totalRewards: state.run.totalRewards,
    money: state.money,
    jokers: state.jokers?.length || 0,
    history: state.run.history || []
  };
}
