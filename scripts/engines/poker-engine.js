
export const SUITS = [
  { id: "spades", symbol: "♠", color: "black" },
  { id: "hearts", symbol: "♥", color: "red" },
  { id: "diamonds", symbol: "♦", color: "red" },
  { id: "clubs", symbol: "♣", color: "black" }
];

export const RANKS = [
  { id: "2", label: "2", order: 2, chips: 2 },
  { id: "3", label: "3", order: 3, chips: 3 },
  { id: "4", label: "4", order: 4, chips: 4 },
  { id: "5", label: "5", order: 5, chips: 5 },
  { id: "6", label: "6", order: 6, chips: 6 },
  { id: "7", label: "7", order: 7, chips: 7 },
  { id: "8", label: "8", order: 8, chips: 8 },
  { id: "9", label: "9", order: 9, chips: 9 },
  { id: "10", label: "10", order: 10, chips: 10 },
  { id: "J", label: "J", order: 11, chips: 10 },
  { id: "Q", label: "Q", order: 12, chips: 10 },
  { id: "K", label: "K", order: 13, chips: 10 },
  { id: "A", label: "A", order: 14, chips: 11 }
];

export const STATE_SCHEMA_VERSION = 2;

export const HANDS = {
  "high-card":      { name: "Carte haute",     chips: 5,   mult: 1 },
  "pair":           { name: "Paire",           chips: 10,  mult: 2 },
  "two-pair":       { name: "Double paire",    chips: 20,  mult: 2 },
  "three-kind":     { name: "Brelan",          chips: 30,  mult: 3 },
  "straight":       { name: "Suite",           chips: 30,  mult: 4 },
  "flush":          { name: "Couleur",         chips: 35,  mult: 4 },
  "full-house":     { name: "Full",            chips: 40,  mult: 4 },
  "four-kind":      { name: "Carré",           chips: 60,  mult: 7 },
  "straight-flush": { name: "Quinte flush",    chips: 100, mult: 8 },
  "five-kind":      { name: "Cinq identiques", chips: 120, mult: 12 },
  "flush-house":    { name: "Full couleur",    chips: 140, mult: 14 },
  "flush-five":     { name: "Cinq couleur",    chips: 160, mult: 16 }
};

function baseCard(rank, suit, id) {
  return {
    id,
    baseId: `${rank.id}-${suit.id}`,
    rank: rank.id,
    rankLabel: rank.label,
    rankOrder: rank.order,
    chips: rank.chips,
    bonusChips: 0,
    suit: suit.id,
    suitSymbol: suit.symbol,
    color: suit.color,
    enhancement: null,
    seal: null,
    edition: null
  };
}

export function createDeck() {
  const deck = [];
  let serial = 0;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(baseCard(rank, suit, `${rank.id}-${suit.id}-${serial++}`));
    }
  }
  return deck;
}

export function clonePlayingCard(card, suffix = Date.now().toString(36)) {
  return { ...structuredClone(card), id: `${card.baseId ?? card.id}-copy-${suffix}` };
}

export function randomPlayingCard(random = Math.random) {
  const suit = SUITS[Math.floor(random() * SUITS.length)];
  const rank = RANKS[Math.floor(random() * RANKS.length)];
  return baseCard(rank, suit, `${rank.id}-${suit.id}-bonus-${Date.now().toString(36)}-${Math.floor(random()*1e6)}`);
}

export function shuffle(cards, random = Math.random) {
  const deck = cards.map(card => ({ ...card }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function rankGroups(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.rankOrder)) groups.set(card.rankOrder, []);
    groups.get(card.rankOrder).push(card);
  }
  return [...groups.entries()].map(([rank, group]) => ({ rank, cards: group })).sort((a, b) => b.rank - a.rank);
}

function combinations(values, size) {
  const result = [];
  const walk = (start, picked) => {
    if (picked.length === size) {
      result.push([...picked]);
      return;
    }
    for (let i = start; i <= values.length - (size - picked.length); i++) {
      picked.push(values[i]);
      walk(i + 1, picked);
      picked.pop();
    }
  };
  walk(0, []);
  return result;
}

function straightRankSequence(values, needed, shortcut) {
  if (values.length < needed) return null;
  const sorted = [...new Set(values)].sort((a,b)=>a-b);
  const variants = [sorted];
  if (sorted.includes(14)) variants.push([1, ...sorted.filter(v=>v!==14)]);
  const maxGap = shortcut ? 2 : 1;

  for (let size = Math.min(5, sorted.length); size >= needed; size--) {
    for (const vals of variants) {
      for (const chunk of combinations(vals, size)) {
        let ok = true;
        for (let i = 1; i < chunk.length; i++) {
          const gap = chunk[i] - chunk[i - 1];
          if (gap < 1 || gap > maxGap) {
            ok = false;
            break;
          }
        }
        if (ok) return chunk.map(value => value === 1 ? 14 : value);
      }
    }
  }
  return null;
}

function findStraightCards(cards, needed, shortcut) {
  const sequence = straightRankSequence(cards.map(card => card.rankOrder), needed, shortcut);
  if (!sequence) return [];
  const remaining = [...cards];
  const picked = [];
  for (const rank of sequence) {
    const index = remaining.findIndex(card => card.rankOrder === rank);
    if (index < 0) return [];
    picked.push(remaining.splice(index, 1)[0]);
  }
  return picked;
}

function suitGroup(card, smeared) {
  if (!smeared) return card.suit;
  return ["hearts","diamonds"].includes(card.suit) ? "red" : "black";
}

function suitGroups(cards, smeared) {
  const groups = new Map();
  for (const card of cards) {
    const key = suitGroup(card, smeared);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card);
  }
  return groups;
}

function findFlushCards(cards, needed, smeared) {
  return [...suitGroups(cards, smeared).values()]
    .filter(group => group.length >= needed)
    .sort((a,b) => b.length - a.length || Math.max(...b.map(c => c.rankOrder)) - Math.max(...a.map(c => c.rankOrder)))[0] || [];
}

function findStraightFlushCards(cards, needed, shortcut, smeared) {
  let best = [];
  for (const group of suitGroups(cards, smeared).values()) {
    if (group.length < needed) continue;
    const straight = findStraightCards(group, needed, shortcut);
    if (straight.length > best.length) best = straight;
  }
  return best;
}

export function evaluateHand(cards, options = {}) {
  if (!Array.isArray(cards) || cards.length < 1 || cards.length > 5) {
    throw new Error("Une main doit contenir entre 1 et 5 cartes.");
  }

  const needed = options.fourFingers ? 4 : 5;
  const groups = rankGroups(cards);
  const counts = groups.map(g => g.cards.length).sort((a, b) => b - a);
  const straightCards = findStraightCards(cards, needed, Boolean(options.shortcut));
  const flushCards = findFlushCards(cards, needed, Boolean(options.smeared));
  const straightFlushCards = findStraightFlushCards(cards, needed, Boolean(options.shortcut), Boolean(options.smeared));
  const straight = straightCards.length >= needed;
  const flush = flushCards.length >= needed;
  const five = counts[0] >= 5;
  const four = counts[0] >= 4;
  const three = counts[0] >= 3;
  const pairs = counts.filter(c=>c>=2).length;
  const full = three && counts.some(c=>c===2);

  let key = "high-card";
  let scoringCards = [];

  if (five && cards.length === 5 && flushCards.length === 5) {
    key = "flush-five";
    scoringCards = [...cards];
  } else if (full && cards.length === 5 && flushCards.length === 5) {
    key = "flush-house";
    scoringCards = [...cards];
  } else if (five) {
    key = "five-kind";
    scoringCards = groups.find(g => g.cards.length >= 5).cards.slice(0,5);
  } else if (straightFlushCards.length >= needed) {
    key = "straight-flush";
    scoringCards = straightFlushCards;
  } else if (four) {
    key = "four-kind";
    scoringCards = groups.find(g => g.cards.length >= 4).cards.slice(0,4);
  } else if (full) {
    key = "full-house";
    scoringCards = [...cards];
  } else if (flush) {
    key = "flush";
    scoringCards = flushCards;
  } else if (straight) {
    key = "straight";
    scoringCards = straightCards;
  } else if (three) {
    key = "three-kind";
    scoringCards = groups.find(g => g.cards.length >= 3).cards.slice(0,3);
  } else if (pairs >= 2) {
    key = "two-pair";
    scoringCards = groups.filter(g => g.cards.length >= 2).slice(0,2).flatMap(g => g.cards.slice(0,2));
  } else if (pairs >= 1) {
    key = "pair";
    scoringCards = groups.find(g => g.cards.length >= 2).cards.slice(0,2);
  } else {
    scoringCards = [[...cards].sort((a, b) => b.rankOrder - a.rankOrder)[0]];
  }

  if (options.splash) scoringCards = [...cards];

  const tags = new Set([key]);
  if (pairs >= 1) tags.add("pair");
  if (pairs >= 2) tags.add("two-pair");
  if (three) tags.add("three-kind");
  if (four) tags.add("four-kind");
  if (five) tags.add("five-kind");
  if (straight) tags.add("straight");
  if (flush) tags.add("flush");

  const hand = HANDS[key];
  const baseCardChips = scoringCards.reduce((sum, card) => sum + Number(card.chips || 0) + Number(card.bonusChips || 0), 0);

  return {
    key,
    name: hand.name,
    baseChips: hand.chips,
    baseMult: hand.mult,
    cardChips: baseCardChips,
    chips: hand.chips + baseCardChips,
    mult: hand.mult,
    score: (hand.chips + baseCardChips) * hand.mult,
    scoringCardIds: scoringCards.map(c => c.id),
    tags: [...tags],
    straight,
    flush
  };
}

export function createRound({ target = 300, hands = 4, discards = 3, handSize = 8, random = Math.random, initialDraw = true } = {}) {
  const drawPile = shuffle(createDeck(), random);
  const state = {
    schemaVersion: STATE_SCHEMA_VERSION,
    status: "playing",
    target,
    score: 0,
    handsRemaining: hands,
    baseHands: hands,
    discardsRemaining: discards,
    baseDiscards: discards,
    handSize,
    baseHandSize: handSize,
    hand: [],
    drawPile,
    played: [],
    discarded: [],
    selected: [],
    lastResult: null,
    roundHandsPlayed: 0,
    roundDiscardsUsed: 0,
    roundSettled: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  if (initialDraw) drawToHand(state);
  return state;
}

export function drawToHand(state) {
  while (state.hand.length < state.handSize && state.drawPile.length > 0) {
    state.hand.push(state.drawPile.shift());
  }
  while (state.hand.length > state.handSize) state.drawPile.unshift(state.hand.pop());
  sortHand(state.hand);
  state.updatedAt = Date.now();
  return state;
}

export function sortHand(hand) {
  hand.sort((a, b) => {
    if (a.suit !== b.suit) {
      const suitOrder = ["spades", "hearts", "clubs", "diamonds"];
      return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    }
    return b.rankOrder - a.rankOrder;
  });
}

export function toggleCard(state, cardId, maxSelected = 5) {
  const selected = new Set(state.selected);
  if (selected.has(cardId)) selected.delete(cardId);
  else if (selected.size < maxSelected) selected.add(cardId);
  state.selected = [...selected];
  return state;
}

function takeSelected(state) {
  const selected = new Set(state.selected);
  const taken = state.hand.filter(card => selected.has(card.id));
  state.hand = state.hand.filter(card => !selected.has(card.id));
  state.selected = [];
  return taken;
}

export function playSelected(state, options = {}) {
  if (state.status !== "playing") throw new Error("La manche est terminée.");
  if (!state.selected.length) throw new Error("Sélectionnez au moins une carte.");
  if (state.handsRemaining <= 0) throw new Error("Vous n’avez plus de mains.");

  const cards = takeSelected(state);
  const baseResult = evaluateHand(cards, options.evaluateOptions || {});
  const result = options.scoreHand ? options.scoreHand({ state, cards, baseResult }) : baseResult;

  state.played.push(...cards);
  state.score += Number(result.score || 0);
  state.handsRemaining -= 1;
  state.roundHandsPlayed += 1;
  state.lastResult = { ...result, cards: cards.map(c => ({ ...c })) };

  options.afterPlay?.({ state, cards, result, baseResult });

  if (state.score >= state.target) state.status = "won";
  else if (state.handsRemaining <= 0) state.status = "lost";
  else drawToHand(state);

  if (state.status === "lost" && options.preventLoss?.(state)) state.status = "won";

  state.updatedAt = Date.now();
  return result;
}

export function discardSelected(state, options = {}) {
  if (state.status !== "playing") throw new Error("La manche est terminée.");
  if (!state.selected.length) throw new Error("Sélectionnez au moins une carte.");
  if (state.discardsRemaining <= 0) throw new Error("Vous n’avez plus de défausses.");

  const cards = takeSelected(state);
  state.discarded.push(...cards);
  state.discardsRemaining -= 1;
  state.roundDiscardsUsed += 1;

  options.onDiscard?.({ state, cards });
  drawToHand(state);
  state.lastResult = null;
  state.updatedAt = Date.now();
  return cards;
}

export function sanitizeState(state) {
  if (!state || typeof state !== "object") return null;
  const requiredArrays = ["hand", "drawPile", "played", "discarded", "selected"];
  if (!requiredArrays.every(key => Array.isArray(state[key]))) return null;
  if (!["playing", "won", "lost"].includes(state.status)) return null;
  return state;
}
