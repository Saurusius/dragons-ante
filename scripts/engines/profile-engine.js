
import { JOKERS, JOKER_MAP } from "../data/jokers-data.js";

export const PROFILE_VERSION = 1;
export const PROFILE_HISTORY_LIMIT = 20;

export const UNLOCK_RULES = [
  { achievement: "collector-25", jokerId: "blueprint" },
  { achievement: "score-5000", jokerId: "wee-joker" },
  { achievement: "ante-4", jokerId: "hit-the-road" },
  { achievement: "pairs-25", jokerId: "the-duo" },
  { achievement: "first-trio", jokerId: "the-trio" },
  { achievement: "first-full", jokerId: "the-family" },
  { achievement: "straights-10", jokerId: "the-order" },
  { achievement: "flushes-10", jokerId: "the-tribe" },
  { achievement: "mult-50", jokerId: "stuntman" },
  { achievement: "collector-75", jokerId: "brainstorm" },
  { achievement: "runs-3", jokerId: "drivers-license" },
  { achievement: "discard-25", jokerId: "burnt-joker" },
  { achievement: "first-win", jokerId: "triboulet" },
  { achievement: "hands-100", jokerId: "yorick" },
  { achievement: "bosses-8", jokerId: "chicot" }
];

export const LOCKED_JOKER_IDS = UNLOCK_RULES.map(rule => rule.jokerId);

export const ACHIEVEMENTS = [
  { id: "collector-25", name: "Premier grimoire", description: "Découvrir 25 Atouts.", reward: "Débloque Le Plan de l’Artificier." },
  { id: "score-5000", name: "Ça commence à piquer", description: "Marquer 5 000 points avec une seule main.", reward: "Débloque Le Petit Bouffon." },
  { id: "ante-4", name: "Mi-chemin", description: "Atteindre l’Ante 4.", reward: "Débloque La Longue Marche." },
  { id: "pairs-25", name: "À deux, c’est mieux", description: "Jouer 25 Paires au total.", reward: "Débloque Le Duo." },
  { id: "first-trio", name: "Trois font la paire", description: "Jouer un Brelan.", reward: "Débloque Le Trio." },
  { id: "first-full", name: "Maison pleine", description: "Jouer un Full.", reward: "Débloque La Famille." },
  { id: "straights-10", name: "Sur des rails", description: "Jouer 10 Suites au total.", reward: "Débloque L’Ordre." },
  { id: "flushes-10", name: "Même blason", description: "Jouer 10 Couleurs au total.", reward: "Débloque La Tribu." },
  { id: "mult-50", name: "Le multiplicateur s’énerve", description: "Atteindre un multiplicateur effectif de ×50.", reward: "Débloque Le Trompe-la-Mort." },
  { id: "collector-75", name: "Cabinet des curiosités", description: "Découvrir 75 Atouts.", reward: "Débloque Le Conseil des Arcanes." },
  { id: "runs-3", name: "Habitué de la table", description: "Terminer 3 runs.", reward: "Débloque La Licence de Caravanier." },
  { id: "discard-25", name: "On recommence", description: "Défausser 25 cartes au total.", reward: "Débloque Le Bouffon Cendré." },
  { id: "first-win", name: "Le Dragon plie", description: "Remporter une run complète.", reward: "Débloque Le Fou du Dragon." },
  { id: "hands-100", name: "Cent mains plus tard", description: "Jouer 100 mains au total.", reward: "Débloque Le Crâne Rieur." },
  { id: "bosses-8", name: "Chasseur de Boss", description: "Vaincre 8 Boss.", reward: "Débloque Le Bouffon Noir." }
];

function baseStats() {
  return {
    runsStarted: 0,
    runsCompleted: 0,
    runsWon: 0,
    blindsWon: 0,
    bossesDefeated: 0,
    handsPlayed: 0,
    discardActions: 0,
    cardsDiscarded: 0,
    goldEarned: 0,
    goldSpent: 0,
    jokersPurchased: 0,
    boostersOpened: 0,
    rerolls: 0,
    consumablesUsed: 0,
    bestAnte: 1,
    bestSingleHand: 0,
    biggestMultiplier: 0,
    bestRunScore: 0,
    maxGoldHeld: 4,
    handsByType: {},
    jokerTriggers: {}
  };
}

export function createProfile() {
  return {
    version: PROFILE_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stats: baseStats(),
    collection: { jokers: [], consumables: [] },
    achievements: [],
    unlocks: { jokers: [] },
    history: []
  };
}

function uniqueStrings(value) {
  return [...new Set(Array.isArray(value) ? value.filter(v => typeof v === "string") : [])];
}

export function ensureProfile(raw) {
  const profile = raw && typeof raw === "object" && Object.keys(raw).length ? structuredClone(raw) : createProfile();
  profile.version = PROFILE_VERSION;
  profile.createdAt ??= Date.now();
  profile.updatedAt ??= Date.now();
  profile.stats = { ...baseStats(), ...(profile.stats || {}) };
  profile.stats.handsByType = { ...(profile.stats.handsByType || {}) };
  profile.stats.jokerTriggers = { ...(profile.stats.jokerTriggers || {}) };
  profile.collection ??= {};
  profile.collection.jokers = uniqueStrings(profile.collection.jokers);
  profile.collection.consumables = uniqueStrings(profile.collection.consumables);
  profile.achievements = uniqueStrings(profile.achievements);
  profile.unlocks ??= {};
  profile.unlocks.jokers = uniqueStrings(profile.unlocks.jokers).filter(id => LOCKED_JOKER_IDS.includes(id));
  profile.history = Array.isArray(profile.history) ? profile.history.slice(0, PROFILE_HISTORY_LIMIT) : [];
  evaluateAchievements(profile);
  return profile;
}

export function applyProfileToRun(profile, state) {
  if (!state) return state;
  const unlocked = new Set(profile?.unlocks?.jokers || []);
  state.metaLockedJokers = LOCKED_JOKER_IDS.filter(id => !unlocked.has(id));
  state.metaProfileVersion = PROFILE_VERSION;
  state.run ??= {};
  state.run.meta ??= {
    bestHandScore: 0,
    biggestMultiplier: 0,
    favoriteHand: null,
    handsByType: {},
    recorded: false
  };
  state.run.meta.handsByType ??= {};
  state.run.meta.recorded ??= false;
  return state;
}

export function discoverJoker(profile, jokerId) {
  if (!JOKER_MAP.has(jokerId)) return [];
  if (!profile.collection.jokers.includes(jokerId)) profile.collection.jokers.push(jokerId);
  return touchAndEvaluate(profile);
}

export function discoverConsumable(profile, id) {
  if (id && !profile.collection.consumables.includes(id)) profile.collection.consumables.push(id);
  return touchAndEvaluate(profile);
}

export function recordRunStarted(profile, state) {
  profile.stats.runsStarted += 1;
  profile.stats.bestAnte = Math.max(profile.stats.bestAnte, Number(state?.run?.ante || 1));
  return touchAndEvaluate(profile);
}

export function recordHandPlayed(profile, state, result) {
  const key = result?.key || "high-card";
  const score = Number(result?.score || 0);
  const effectiveMult = Number(result?.mult || 0) * Number(result?.xMult || 1);

  profile.stats.handsPlayed += 1;
  profile.stats.bestSingleHand = Math.max(profile.stats.bestSingleHand, score);
  profile.stats.biggestMultiplier = Math.max(profile.stats.biggestMultiplier, effectiveMult);
  profile.stats.bestAnte = Math.max(profile.stats.bestAnte, Number(state?.run?.ante || 1));
  profile.stats.handsByType[key] = (profile.stats.handsByType[key] || 0) + 1;
  profile.stats.goldEarned += Math.max(0, Number(result?.moneyGain || 0));
  profile.stats.maxGoldHeld = Math.max(profile.stats.maxGoldHeld, Number(state?.money || 0));

  for (const id of result?.usedJokers || []) {
    profile.stats.jokerTriggers[id] = (profile.stats.jokerTriggers[id] || 0) + 1;
  }

  if (state?.run) {
    state.run.meta ??= {};
    state.run.meta.bestHandScore = Math.max(Number(state.run.meta.bestHandScore || 0), score);
    state.run.meta.biggestMultiplier = Math.max(Number(state.run.meta.biggestMultiplier || 0), effectiveMult);
    state.run.meta.handsByType ??= {};
    state.run.meta.handsByType[key] = (state.run.meta.handsByType[key] || 0) + 1;
  }

  return touchAndEvaluate(profile);
}

export function recordDiscard(profile, count = 0) {
  profile.stats.discardActions += 1;
  profile.stats.cardsDiscarded += Math.max(0, Number(count || 0));
  return touchAndEvaluate(profile);
}

export function recordPurchase(profile, { gold = 0, jokerId = null, consumableId = null, booster = false } = {}) {
  profile.stats.goldSpent += Math.max(0, Number(gold || 0));
  if (jokerId) {
    profile.stats.jokersPurchased += 1;
    if (!profile.collection.jokers.includes(jokerId)) profile.collection.jokers.push(jokerId);
  }
  if (consumableId && !profile.collection.consumables.includes(consumableId)) profile.collection.consumables.push(consumableId);
  if (booster) profile.stats.boostersOpened += 1;
  return touchAndEvaluate(profile);
}

export function recordReroll(profile, cost = 0) {
  profile.stats.rerolls += 1;
  profile.stats.goldSpent += Math.max(0, Number(cost || 0));
  return touchAndEvaluate(profile);
}

export function recordConsumableUse(profile, id = null) {
  profile.stats.consumablesUsed += 1;
  if (id && !profile.collection.consumables.includes(id)) profile.collection.consumables.push(id);
  return touchAndEvaluate(profile);
}

export function recordBlindResolved(profile, state, blind, reward) {
  profile.stats.bestAnte = Math.max(profile.stats.bestAnte, Number(state?.run?.ante || 1));
  profile.stats.maxGoldHeld = Math.max(profile.stats.maxGoldHeld, Number(state?.money || 0));
  if (state?.status === "won") {
    profile.stats.blindsWon += 1;
    if (blind?.isBoss) profile.stats.bossesDefeated += 1;
    profile.stats.goldEarned += Math.max(0, Number(reward?.total || 0));
  }
  return touchAndEvaluate(profile);
}

export function finalizeRun(profile, state) {
  if (!state?.run || state.run.meta?.recorded) return [];
  state.run.meta ??= {};
  state.run.meta.recorded = true;

  const won = state.run.phase === "run-won";
  profile.stats.runsCompleted += 1;
  if (won) profile.stats.runsWon += 1;
  profile.stats.bestAnte = Math.max(profile.stats.bestAnte, Number(state.run.ante || 1));
  const runScore = Math.max(0, ...(state.run.history || []).map(entry => Number(entry.score || 0)), Number(state.score || 0));
  profile.stats.bestRunScore = Math.max(profile.stats.bestRunScore, runScore);
  profile.stats.maxGoldHeld = Math.max(profile.stats.maxGoldHeld, Number(state.money || 0));

  const hands = state.run.meta.handsByType || {};
  const favoriteHand = Object.entries(hands).sort((a,b) => b[1] - a[1])[0]?.[0] || null;
  const favoriteJoker = Object.entries(profile.stats.jokerTriggers || {}).sort((a,b) => b[1] - a[1])[0]?.[0] || null;

  profile.history.unshift({
    id: `${state.run.startedAt || Date.now()}-${Date.now()}`,
    startedAt: state.run.startedAt || null,
    endedAt: Date.now(),
    won,
    ante: Number(state.run.ante || 1),
    blindsWon: Number(state.run.blindsWon || 0),
    money: Number(state.money || 0),
    bestHandScore: Number(state.run.meta.bestHandScore || 0),
    biggestMultiplier: Number(state.run.meta.biggestMultiplier || 0),
    favoriteHand,
    favoriteJoker,
    jokers: [...(state.jokers || [])]
  });
  profile.history = profile.history.slice(0, PROFILE_HISTORY_LIMIT);

  return touchAndEvaluate(profile);
}

function achievementCondition(id, profile) {
  const s = profile.stats;
  const c = profile.collection;
  switch (id) {
    case "collector-25": return c.jokers.length >= 25;
    case "score-5000": return s.bestSingleHand >= 5000;
    case "ante-4": return s.bestAnte >= 4;
    case "pairs-25": return (s.handsByType?.pair || 0) >= 25;
    case "first-trio": return (s.handsByType?.["three-kind"] || 0) >= 1;
    case "first-full": return (s.handsByType?.["full-house"] || 0) >= 1;
    case "straights-10": return (s.handsByType?.straight || 0) >= 10;
    case "flushes-10": return (s.handsByType?.flush || 0) >= 10;
    case "mult-50": return s.biggestMultiplier >= 50;
    case "collector-75": return c.jokers.length >= 75;
    case "runs-3": return s.runsCompleted >= 3;
    case "discard-25": return s.cardsDiscarded >= 25;
    case "first-win": return s.runsWon >= 1;
    case "hands-100": return s.handsPlayed >= 100;
    case "bosses-8": return s.bossesDefeated >= 8;
    default: return false;
  }
}

export function evaluateAchievements(profile) {
  const newUnlocks = [];
  for (const achievement of ACHIEVEMENTS) {
    if (profile.achievements.includes(achievement.id)) continue;
    if (!achievementCondition(achievement.id, profile)) continue;
    profile.achievements.push(achievement.id);
    const rule = UNLOCK_RULES.find(entry => entry.achievement === achievement.id);
    if (rule && !profile.unlocks.jokers.includes(rule.jokerId)) {
      profile.unlocks.jokers.push(rule.jokerId);
      newUnlocks.push({ achievement, joker: JOKER_MAP.get(rule.jokerId) || null });
    }
  }
  profile.updatedAt = Date.now();
  return newUnlocks;
}

function touchAndEvaluate(profile) {
  profile.updatedAt = Date.now();
  return evaluateAchievements(profile);
}

export function profileSnapshot(profile) {
  const live = JOKERS.filter(joker => joker.status === "live");
  const discoveredLive = live.filter(joker => profile.collection.jokers.includes(joker.id));
  const favoriteJokerId = Object.entries(profile.stats.jokerTriggers || {}).sort((a,b) => b[1] - a[1])[0]?.[0] || null;
  const favoriteHand = Object.entries(profile.stats.handsByType || {}).sort((a,b) => b[1] - a[1])[0]?.[0] || null;
  return {
    liveCount: live.length,
    discoveredCount: discoveredLive.length,
    achievementCount: profile.achievements.length,
    achievementTotal: ACHIEVEMENTS.length,
    unlockedBonusCount: profile.unlocks.jokers.length,
    unlockedBonusTotal: LOCKED_JOKER_IDS.length,
    favoriteJokerId,
    favoriteHand,
    stats: profile.stats
  };
}
