import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDeck,
  createRound,
  evaluateHand
} from "../scripts/engines/poker-engine.js";

import {
  ensureJokerState,
  prepareRound,
  scoreWithJokers
} from "../scripts/engines/joker-engine.js";

import {
  ensureDeckState,
  inventoryCount
} from "../scripts/engines/deck-engine.js";

import {
  initializeFreshRun,
  leaveShop,
  bossForAnte
} from "../scripts/engines/run-engine.js";

import {
  ensureShop,
  rerollShop
} from "../scripts/engines/shop-engine.js";

import {
  sellValue
} from "../scripts/engines/economy-engine.js";

import {
  JOKERS as JS_JOKERS
} from "../scripts/data/jokers-data.js";

import {
  runRandom
} from "../scripts/core/random.js";

import {
  createSaveBundle,
  readSaveBundle
} from "../scripts/persistence/save-store.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => fs.readFileSync(path.join(ROOT, relative), "utf8");

function card(rank, suit) {
  const found = createDeck().find(entry => entry.rank === rank && entry.suit === suit);
  assert.ok(found, `Carte introuvable: ${rank} ${suit}`);
  return structuredClone(found);
}

function freshState(jokers = []) {
  const state = createRound({ initialDraw: false });
  ensureJokerState(state);
  ensureDeckState(state);
  state.jokers = [...jokers];
  state.jokerState = {};
  state.hand = [];
  state.played = [];
  state.discarded = [];
  state.selected = [];
  return state;
}

function testPokerSubsets() {
  const falseStraightFlush = [
    card("2", "hearts"),
    card("3", "hearts"),
    card("4", "hearts"),
    card("8", "hearts"),
    card("5", "spades")
  ];

  const falseResult = evaluateHand(falseStraightFlush, { fourFingers: true });
  assert.equal(falseResult.key, "flush", "Four Fingers ne doit pas fusionner une suite et une couleur provenant de cartes différentes.");
  assert.equal(falseResult.scoringCardIds.length, 4, "La Couleur Four Fingers ne doit scorer que ses quatre cartes valides.");
  assert.ok(!falseResult.scoringCardIds.includes(falseStraightFlush[4].id), "La carte hors couleur ne doit pas scorer.");

  const trueStraightFlush = [
    card("2", "hearts"),
    card("3", "hearts"),
    card("4", "hearts"),
    card("5", "hearts"),
    card("9", "spades")
  ];

  const trueResult = evaluateHand(trueStraightFlush, { fourFingers: true });
  assert.equal(trueResult.key, "straight-flush");
  assert.equal(trueResult.scoringCardIds.length, 4);
  assert.ok(!trueResult.scoringCardIds.includes(trueStraightFlush[4].id));
}

function testLegacyConsumableMigration() {
  const state = {
    inventory: { arcanes: [], constellations: [], presages: [] },
    consumables: { tarot: 1, spectral: 1, planet: 1 }
  };

  ensureDeckState(state);

  assert.equal("consumables" in state, false, "L'ancien conteneur consumables doit disparaître après migration.");
  assert.equal(inventoryCount(state), 3);
  assert.deepEqual(state.inventory.arcanes, ["forge-doree"]);
  assert.deepEqual(state.inventory.presages, ["sceau-astral"]);
  assert.deepEqual(state.inventory.constellations, ["atlas-des-mains"]);
}

function testEightBallAndTriggerTracking() {
  const eightState = freshState(["eight-ball"]);

  let winningCounter = null;
  for (let counter = 0; counter < 256; counter++) {
    const probe = structuredClone(eightState);
    probe.run.rngCounter = counter;
    if (runRandom(probe) < 0.25) {
      winningCounter = counter;
      break;
    }
  }
  assert.notEqual(winningCounter, null, "La seed de test doit contenir un tirage Eight Ball gagnant.");
  eightState.run.rngCounter = winningCounter;

  const eight = card("8", "hearts");
  const eightResult = scoreWithJokers({
    state: eightState,
    cards: [eight],
    baseResult: evaluateHand([eight])
  });

  assert.equal(inventoryCount(eightState), 1, "Eight Ball doit pouvoir créer un consommable.");
  assert.ok(eightResult.usedJokers.includes("eight-ball"), "Eight Ball doit être enregistré comme déclenché lorsqu'il crée une récompense.");

  const idleGreedyState = freshState(["greedy-joker"]);
  const heart = card("7", "hearts");
  const idleResult = scoreWithJokers({
    state: idleGreedyState,
    cards: [heart],
    baseResult: evaluateHand([heart])
  });
  assert.ok(!idleResult.usedJokers.includes("greedy-joker"), "Un Atout sans effet sur la main ne doit pas être marqué comme déclenché.");

  const activeGreedyState = freshState(["greedy-joker"]);
  const diamond = card("7", "diamonds");
  const activeResult = scoreWithJokers({
    state: activeGreedyState,
    cards: [diamond],
    baseResult: evaluateHand([diamond])
  });
  assert.ok(activeResult.usedJokers.includes("greedy-joker"), "Un Atout réellement appliqué doit être marqué comme déclenché.");
}

function testCertificateSeals() {
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    const state = createRound({ initialDraw: false });
    ensureJokerState(state);
    ensureDeckState(state);
    state.jokers = ["certificate"];
    state.jokerState = {};
    prepareRound(state);

    const certificateCard = state.hand.find(entry => String(entry.id).includes("-bonus-"));
    assert.ok(certificateCard, "Certificate doit créer une carte bonus.");
    assert.ok(
      ["blood", "astral", "merchant", "occult"].includes(certificateCard.seal),
      `Sceau Certificate non pris en charge: ${certificateCard.seal}`
    );
  } finally {
    Math.random = originalRandom;
  }
}

function testSwashbucklerUsesRealSellValues() {
  const state = freshState(["swashbuckler", "egg", "credit-card"]);
  state.globalSellBonus = 1;
  state.jokerState.egg = { sellBonus: 3 };

  const played = card("2", "spades");
  const baseResult = evaluateHand([played]);
  const result = scoreWithJokers({ state, cards: [played], baseResult });

  const expectedBonus = sellValue(state, "egg") + sellValue(state, "credit-card");
  assert.equal(result.mult, baseResult.mult + expectedBonus, "Swashbuckler doit utiliser les vraies valeurs de revente.");
  assert.ok(result.usedJokers.includes("swashbuckler"));
}

function testPendingBoosterGuards() {
  const state = createRound({ initialDraw: false });
  ensureJokerState(state);
  ensureDeckState(state);
  initializeFreshRun(state);
  state.run.phase = "shop";
  const shop = ensureShop(state, true);
  shop.pendingBooster = {
    name: "Booster test",
    choices: [{ type: "gold", amount: 8, label: "Test" }]
  };

  const blindBefore = state.run.blindIndex;
  assert.equal(leaveShop(state), false, "Impossible de quitter la boutique avec un booster non résolu.");
  assert.equal(state.run.blindIndex, blindBefore);

  const reroll = rerollShop(state);
  assert.equal(reroll.ok, false, "Impossible de relancer la boutique avec un booster non résolu.");
}

function testDataParityAndLiveCoverage() {
  const jsonJokers = JSON.parse(read("data/jokers.json"));
  assert.deepEqual(JS_JOKERS, jsonJokers, "Les deux représentations du catalogue des Atouts doivent rester identiques.");

  const sourcePaths = [
    "scripts/engines/joker-engine.js",
    "scripts/engines/shop-engine.js",
    "scripts/engines/run-engine.js",
    "scripts/engines/deck-engine.js",
    "scripts/engines/economy-engine.js",
    "scripts/engines/profile-engine.js",
    "scripts/main.js"
  ];
  const source = sourcePaths.map(read).join("\n");
  const missing = JS_JOKERS
    .filter(joker => joker.status === "live")
    .filter(joker => !source.includes(`"${joker.id}"`) && !source.includes(`'${joker.id}'`))
    .map(joker => joker.id);

  assert.deepEqual(missing, [], `Atouts marqués live sans implémentation détectable: ${missing.join(", ")}`);
}

function testSeededRunRandomness() {
  const first = { run: { seed: "DRAGON060", rngCounter: 0 } };
  const second = { run: { seed: "DRAGON060", rngCounter: 0 } };
  const a = Array.from({ length: 12 }, () => runRandom(first));
  const b = Array.from({ length: 12 }, () => runRandom(second));
  assert.deepEqual(a, b, "Une même seed doit reproduire exactement la même séquence aléatoire.");

  const stateA = createRound({ initialDraw: false });
  const stateB = createRound({ initialDraw: false });
  initializeFreshRun(stateA, { seed: "BOSSORDER060" });
  initializeFreshRun(stateB, { seed: "BOSSORDER060" });
  const bossesA = Array.from({ length: 8 }, (_, index) => bossForAnte(index + 1, stateA).id);
  const bossesB = Array.from({ length: 8 }, (_, index) => bossForAnte(index + 1, stateB).id);
  assert.deepEqual(bossesA, bossesB, "L'ordre des Boss doit être reproductible avec une même seed.");
  assert.equal(new Set(bossesA).size, 8, "Les huit Boss doivent apparaître une fois avant répétition.");
  assert.deepEqual(
    stateA.hand.map(card => card.baseId),
    stateB.hand.map(card => card.baseId),
    "Une même seed doit produire la même main d'ouverture."
  );
  assert.deepEqual(
    stateA.drawPile.map(card => card.baseId),
    stateB.drawPile.map(card => card.baseId),
    "Une même seed doit conserver le même ordre de pioche."
  );

  const stateC = createRound({ initialDraw: false });
  initializeFreshRun(stateC, { seed: "AUTRESEED060" });
  assert.notDeepEqual(
    stateA.hand.map(card => card.baseId),
    stateC.hand.map(card => card.baseId),
    "Deux seeds différentes doivent pouvoir produire des mains d'ouverture différentes."
  );
}

function testAtomicSaveBundle() {
  const state = { score: 123, run: { seed: "SAVE060", rngCounter: 4 } };
  const profile = { stats: { handsPlayed: 9 } };
  const bundle = createSaveBundle(state, profile);

  state.score = 999;
  profile.stats.handsPlayed = 99;

  assert.equal(bundle.state.score, 123, "Le bundle doit capturer un snapshot de la run.");
  assert.equal(bundle.profile.stats.handsPlayed, 9, "Le bundle doit capturer un snapshot des Chroniques.");

  const restored = readSaveBundle(bundle);
  assert.equal(restored.state.run.seed, "SAVE060");
  assert.equal(restored.profile.stats.handsPlayed, 9);

  const legacy = readSaveBundle({}, { fallbackState: { score: 7 }, fallbackProfile: { stats: {} } });
  assert.equal(legacy.migratedFromLegacy, true);
  assert.equal(legacy.state.score, 7);
}

function testVersionAndLegacyGuards() {
  const manifest = JSON.parse(read("module.json"));
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(
    manifest.download,
    `https://github.com/Saurusius/dragons-ante/releases/download/v${manifest.version}/dragons-ante-v${manifest.version}.zip`
  );

  const assets = read("scripts/core/assets.js");
  assert.ok(
    !/MODULE_VERSION\s*=\s*["']\d+\.\d+\.\d+["']/.test(assets),
    "La version runtime ne doit plus être codée en dur dans assets.js."
  );

  const installScript = read("install-local.ps1");
  assert.ok(!/Dragon's Ante v\d+\.\d+\.\d+ installe/.test(installScript), "Le script local doit lire la version depuis module.json.");

  for (const relative of ["scripts/main.js", "scripts/engines/joker-engine.js", "scripts/engines/run-engine.js"]) {
    assert.ok(!read(relative).includes("state.consumables"), `${relative} utilise encore l'ancien système de consommables.`);
  }
}

testPokerSubsets();
testLegacyConsumableMigration();
testEightBallAndTriggerTracking();
testCertificateSeals();
testSwashbucklerUsesRealSellValues();
testPendingBoosterGuards();
testDataParityAndLiveCoverage();
testSeededRunRandomness();
testAtomicSaveBundle();
testVersionAndLegacyGuards();

console.log("Dragon's Ante — stabilization tests OK");
