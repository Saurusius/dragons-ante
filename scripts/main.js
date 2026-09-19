
import {
  createRound,
  toggleCard,
  playSelected,
  discardSelected,
  sanitizeState,
  HANDS
} from "./engines/poker-engine.js";

import {
  JOKERS,
  JOKER_MAP,
  MAX_JOKERS,
  ensureJokerState,
  moveJoker,
  getEvaluationOptions,
  scoreWithJokers,
  previewWithJokers,
  afterPlay,
  onDiscard,
  preventLoss,
  settleRound
} from "./engines/joker-engine.js";

import {
  ensureRunState,
  initializeFreshRun,
  getBlind,
  getNextBlind,
  resolveBlind,
  advanceAfterBlind,
  leaveShop,
  runSummary,
  MAX_ANTE
} from "./engines/run-engine.js";

import {
  ensureShop,
  buyOffer,
  buyConsumableOffer,
  buyBoosterOffer,
  chooseBoosterReward,
  rerollShop,
  sellJoker,
  sellValue,
  canSpend,
  spendingFloor
} from "./engines/shop-engine.js";

import { createLauncherController } from "./ui/launcher.js";
import { createJuiceController } from "./fx/juice-engine.js";

import {
  ACHIEVEMENTS,
  LOCKED_JOKER_IDS,
  ensureProfile,
  applyProfileToRun,
  recordRunStarted,
  recordHandPlayed,
  recordDiscard,
  recordPurchase,
  recordReroll,
  recordConsumableUse,
  recordBlindResolved,
  finalizeRun,
  profileSnapshot
} from "./engines/profile-engine.js";

import {
  CONSUMABLES,
  CONSUMABLE_MAP,
  ensureDeckState,
  inventoryCount,
  INVENTORY_LIMIT,
  allCards,
  useConsumable,
  getConsumable
} from "./engines/deck-engine.js";

import { ASSETS, MODULE_ID, MODULE_VERSION, jokerArtUrl } from "./core/assets.js";

const SAVE_KEY = "roundState";
const LAUNCHER_POS_KEY = "launcherPosition";
const SOUND_KEY = "soundEnabled";
const VOLUME_KEY = "soundVolume";
const PROFILE_KEY = "playerProfile";
const ANIMATION_KEY = "animationMode";
const APP_ID = "dragons-ante-app";
const LAUNCHER_ID = "dragons-ante-launcher";
const HOME_TRACK = ASSETS.audio.music.home;
const GAME_TRACK = ASSETS.audio.music.game;
const HOME_BG = ASSETS.images.backgrounds.home;
const HOME_LOGO = ASSETS.images.branding.title;
const COIN_ICON = ASSETS.images.ui.coin;

let state = null;
let catalogOpen = false;
let catalogQuery = "";
let catalogRarity = "all";
let notices = [];
let overlay = null;
let soundEnabled = true;
let soundVolume = 0.35;
let animationMode = "normal";
let launcherController = null;
let profile = null;
let juice = null;
const audio = new Audio();
audio.loop = true;
audio.volume = soundVolume;

audio.addEventListener("error", () => {
  pushNotice("Impossible de lire la musique du module.", "warn");
});

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SAVE_KEY, {
    name: "Dragon's Ante — Sauvegarde",
    scope: "user",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, LAUNCHER_POS_KEY, {
    name: "Dragon's Ante — Position du bouton",
    scope: "user",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, SOUND_KEY, {
    name: "Dragon's Ante — Audio activé",
    scope: "user",
    config: false,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, VOLUME_KEY, {
    name: "Dragon's Ante — Volume",
    scope: "user",
    config: false,
    type: Number,
    default: 0.35
  });

  game.settings.register(MODULE_ID, ANIMATION_KEY, {
    name: "Dragon's Ante — Vitesse des animations",
    hint: "Règle le rythme des animations de cartes et de score de Dragon's Ante.",
    scope: "user",
    config: true,
    type: String,
    choices: {
      normal: "Normales",
      fast: "Rapides",
      off: "Désactivées"
    },
    default: "normal",
    onChange: value => { animationMode = value || "normal"; }
  });

  game.settings.register(MODULE_ID, PROFILE_KEY, {
    name: "Dragon's Ante — Chroniques du Dragon",
    scope: "user",
    config: false,
    type: Object,
    default: {}
  });

  console.log(`Dragon's Ante | v${MODULE_VERSION} initialisé`);
});

Hooks.once("ready", async () => {
  state = sanitizeState(game.settings.get(MODULE_ID, SAVE_KEY));
  soundEnabled = game.settings.get(MODULE_ID, SOUND_KEY);
  soundVolume = Number(game.settings.get(MODULE_ID, VOLUME_KEY) ?? 0.35);
  animationMode = game.settings.get(MODULE_ID, ANIMATION_KEY) || "normal";
  audio.volume = clamp(soundVolume, 0, 1);
  profile = ensureProfile(game.settings.get(MODULE_ID, PROFILE_KEY));
  juice = createJuiceController({
    moduleId: MODULE_ID,
    getSoundEnabled: () => soundEnabled,
    getVolume: () => soundVolume,
    getAnimationMode: () => animationMode
  });

  if (state) {
    ensureJokerState(state);
    ensureRunState(state);
    ensureDeckState(state);
    const migrated = migrateStableState(state);
    applyProfileToRun(profile, state);
    for (const id of state.jokers || []) { if (!profile.collection.jokers.includes(id)) profile.collection.jokers.push(id); }

    if (state.status !== "playing" && state.run.phase === "blind" && !state.run.roundResolved) {
      settleRound(state);
      resolveBlind(state);
      await saveState();
    } else if (migrated) {
      await saveState();
    }
  }

  await saveProfile();

  launcherController = createLauncherController({
    moduleId: MODULE_ID,
    launcherId: LAUNCHER_ID,
    positionSettingKey: LAUNCHER_POS_KEY,
    onToggle: toggleGame
  });
  launcherController.install();

  game.dragonsAnte = {
    open: openGame,
    close: closeGame,
    toggle: toggleGame,
    newRun: async () => { await requestNewRun(true); },
    newRound: async () => { await requestNewRun(true); },
    resetLauncher: () => launcherController?.reset(),
    getState: () => state ? structuredClone(state) : null,
    getProfile: () => structuredClone(profile)
  };
});

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function playUiSound(type = "select", options = {}) {
  juice?.play(type, options);
}

async function animateJokerUsage(ids = []) {
  if (!ids.length) return;
  const seen = [...new Set(ids)];
  for (const id of seen) {
    const node = document.querySelector(`.da-joker-slot[data-joker-id="${id}"]`);
    if (!node) continue;
    await juice?.animateJoker(node);
  }
}

function toggleGame() {
  const app = document.getElementById(APP_ID);
  if (app?.classList.contains("da-visible")) closeGame();
  else openGame();
}

function openGame() {
  const old = document.getElementById(APP_ID);
  if (old) {
    old.classList.add("da-visible");
    document.getElementById(LAUNCHER_ID)?.classList.add("is-active");
    render();
    syncMusic();
    return;
  }

  const app = document.createElement("section");
  app.id = APP_ID;
  app.className = "da-overlay da-visible";
  app.setAttribute("role", "dialog");
  app.setAttribute("aria-modal", "true");
  app.setAttribute("aria-label", "Dragon's Ante");

  document.body.appendChild(app);
  document.getElementById(LAUNCHER_ID)?.classList.add("is-active");

  app.addEventListener("click", handleClick);
  app.addEventListener("input", handleInput);
  app.addEventListener("change", handleInput);

  render();
  syncMusic();
}

function closeGame() {
  document.getElementById(APP_ID)?.classList.remove("da-visible");
  document.getElementById(LAUNCHER_ID)?.classList.remove("is-active");
  audio.pause();
  juice?.stopAll();
}

async function requestNewRun(force = false) {
  if (state && !force) {
    overlay = { type: "confirm-new-run" };
    render();
    return;
  }
  await startNewRun(true);
  catalogOpen = false;
  overlay = null;
  openGame();
  renderGame();
  if (state?.hand?.length) await juice?.animateIncomingCards(state.hand.map(card => card.id));
}

async function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  try {
    if (action === "close") return closeGame();
    if (action === "toggle-sound") return toggleSound();
    if (action === "home") { catalogOpen = false; overlay = null; return renderHome(); }
    if (action === "catalog") { catalogOpen = true; return renderGame(); }
    if (action === "chronicles") { overlay = { type: "chronicles" }; return render(); }
    if (action === "close-catalog") { catalogOpen = false; return renderGame(); }
    if (action === "close-overlay") { overlay = null; return render(); }
    if (action === "confirm-new-run") return confirmNewRun();
    if (action === "cancel-new-run") { overlay = null; return render(); }
    if (action === "new-run") return requestNewRun(false);
    if (action === "continue") return renderGame();

    if (action === "toggle-card") {
      if (state.run?.phase !== "blind" || state.status !== "playing") return;
      const cardId = target.dataset.cardId;
      toggleCard(state, cardId);
      const selected = state.selected.includes(cardId);
      playUiSound("select");
      renderGame();
      await juice?.animateCardSelection(cardId, selected);
      return;
    }

    if (action === "play") {
      if (state.run?.phase !== "blind") return;
      const beforeHandIds = new Set((state.hand || []).map(card => card.id));
      await juice?.animateCardCommit("play");
      playUiSound("play");

      const playResult = playSelected(state, { evaluateOptions: getEvaluationOptions(state), scoreHand: scoreWithJokers, afterPlay, preventLoss });
      await animateJokerUsage(playResult.usedJokers || []);
      await juice?.animateScoreBurst(playResult);

      let unlocks = recordHandPlayed(profile, state, playResult);
      let roundOutcome = "playing";
      if (state.status !== "playing") {
        roundOutcome = state.status;
        settleRound(state);
        const blind = getBlind(state);
        const reward = resolveBlind(state);
        unlocks = unlocks.concat(recordBlindResolved(profile, state, blind, reward));
        if (["run-over", "run-won"].includes(state.run.phase)) unlocks = unlocks.concat(finalizeRun(profile, state));
      }

      await commitProfile(unlocks);
      await saveState();
      const incoming = (state.hand || []).filter(card => !beforeHandIds.has(card.id)).map(card => card.id);
      renderGame();
      if (roundOutcome === "playing") {
        await juice?.animateScoreResult(playResult);
        if (incoming.length) await juice?.animateIncomingCards(incoming);
      } else {
        await juice?.animateEndState(roundOutcome);
      }
      return;
    }

    if (action === "discard") {
      if (state.run?.phase !== "blind") return;
      const beforeHandIds = new Set((state.hand || []).map(card => card.id));
      await juice?.animateCardCommit("discard");
      playUiSound("discard");
      const discardedCards = discardSelected(state, { onDiscard });
      await commitProfile(recordDiscard(profile, discardedCards.length));
      await saveState();
      const incoming = (state.hand || []).filter(card => !beforeHandIds.has(card.id)).map(card => card.id);
      renderGame();
      if (incoming.length) await juice?.animateIncomingCards(incoming);
      return;
    }

    if (action === "advance-after-blind") {
      advanceAfterBlind(state);
      if (state.run.phase === "shop") ensureShop(state);
      await saveState();
      renderGame();
      if (state.run.phase === "shop") await juice?.animateShopEnter();
      else if (state.run.phase === "blind" && state.hand?.length) await juice?.animateIncomingCards(state.hand.map(card => card.id));
      return;
    }

    if (action === "leave-shop") {
      leaveShop(state);
      await saveState();
      renderGame();
      const blind = getBlind(state);
      if (blind?.isBoss) await juice?.animateBossReveal();
      if (state.hand?.length) await juice?.animateIncomingCards(state.hand.map(card => card.id));
      return;
    }

    if (action === "buy-shop-offer") {
      const result = buyOffer(state, Number(target.dataset.offerIndex));
      if (!result.ok) pushNotice(result.reason, "warn");
      else { pushNotice(`Atout acheté pour ${formatCoins(result.price)}.`, "success"); playUiSound("coin"); await commitProfile(recordPurchase(profile, { gold: result.price, jokerId: result.id })); }
      await saveState();
      return renderGame();
    }

    if (action === "buy-consumable-offer") {
      const result = buyConsumableOffer(state);
      if (!result.ok) pushNotice(result.reason, "warn");
      else { pushNotice(`${getConsumable(result.id)?.name || "Consommable"} acheté pour ${formatCoins(result.price)}.`, "success"); playUiSound("coin"); await commitProfile(recordPurchase(profile, { gold: result.price, consumableId: result.id })); }
      await saveState();
      return renderGame();
    }

    if (action === "buy-booster-offer") {
      const result = buyBoosterOffer(state);
      if (!result.ok) pushNotice(result.reason, "warn");
      else { overlay = { type: "booster" }; playUiSound("coin"); await commitProfile(recordPurchase(profile, { gold: result.price, booster: true })); }
      await saveState();
      renderGame();
      if (result.ok) await juice?.animateBoosterOpen();
      return;
    }

    if (action === "choose-booster") {
      await juice?.animateBoosterChoice(target);
      const result = chooseBoosterReward(state, Number(target.dataset.choiceIndex));
      if (!result.ok) pushNotice(result.reason, "warn");
      else { overlay = null; pushNotice(result.message, "success"); playUiSound("magic"); }
      await saveState();
      renderGame();
      return;
    }

    if (action === "reroll-shop") {
      const result = rerollShop(state);
      if (!result.ok) pushNotice(result.reason, "warn");
      else { pushNotice(result.cost ? `Boutique relancée pour ${formatCoins(result.cost)}.` : "Relance gratuite !", "info"); playUiSound("coin"); await commitProfile(recordReroll(profile, result.cost || 0)); }
      await saveState();
      renderGame();
      if (result.ok) await juice?.animateShopEnter();
      return;
    }

    if (action === "sell-joker") {
      const def = JOKER_MAP.get(target.dataset.jokerId);
      const result = sellJoker(state, target.dataset.jokerId);
      if (!result.ok) pushNotice(result.reason, "warn");
      else { pushNotice(`${def?.name || "Atout"} vendu pour ${formatCoins(result.value)}.`, "success"); playUiSound("coin"); }
      await saveState();
      return renderGame();
    }

    if (action === "move-joker") {
      moveJoker(state, target.dataset.jokerId, Number(target.dataset.direction));
      await saveState();
      return renderGame();
    }

    if (action === "open-consumable") {
      overlay = { type: "use-consumable", category: target.dataset.category, index: Number(target.dataset.index) };
      return render();
    }

    if (action === "use-consumable-card") {
      const usedId = state.inventory?.[target.dataset.category]?.[Number(target.dataset.index)] || null;
      const result = useConsumable(state, target.dataset.category, Number(target.dataset.index), { cardId: target.dataset.cardId });
      if (!result.ok) pushNotice(result.reason, "warn");
      else { overlay = null; pushNotice(result.message, "success"); playUiSound("magic"); await commitProfile(recordConsumableUse(profile, usedId)); }
      await saveState();
      return render();
    }

    if (action === "use-consumable-hand") {
      const usedId = state.inventory?.[target.dataset.category]?.[Number(target.dataset.index)] || null;
      const result = useConsumable(state, target.dataset.category, Number(target.dataset.index), { handKey: target.dataset.handKey });
      if (!result.ok) pushNotice(result.reason, "warn");
      else { overlay = null; pushNotice(result.message, "success"); playUiSound("magic"); await commitProfile(recordConsumableUse(profile, usedId)); }
      await saveState();
      return render();
    }
  } catch (error) {
    console.error("Dragon's Ante |", error);
    pushNotice(error.message ?? "Une erreur est survenue.", "warn");
  }
}

function handleInput(event) {
  const target = event.target;
  if (target.matches("[data-volume-slider]")) {
    setVolume(Number(target.value || 35) / 100);
    return;
  }
  if (target.matches("[data-joker-search]")) {
    catalogQuery = target.value;
    renderCatalogGridOnly();
  }
  if (target.matches("[data-joker-rarity]")) {
    catalogRarity = target.value;
    renderCatalogGridOnly();
  }
}

function renderCatalogGridOnly() {
  const grid = document.querySelector(".da-joker-grid");
  if (grid) grid.innerHTML = jokerCatalogCards();
  const count = document.querySelector(".da-catalog-count");
  if (count) count.textContent = `${filteredJokers().length} / ${JOKERS.length}`;
}

async function confirmNewRun() {
  overlay = null;
  await startNewRun(true);
  catalogOpen = false;
  renderGame();
}


function migrateStableState(current) {
  if (!current) return false;
  let changed = false;

  if (current.version !== MODULE_VERSION) {
    current.version = MODULE_VERSION;
    changed = true;
  }

  current.money = Number.isFinite(Number(current.money)) ? Number(current.money) : 4;
  current.shopRerolls = Math.max(0, Number(current.shopRerolls || 0));
  current.globalSellBonus = Math.max(0, Number(current.globalSellBonus || 0));
  current.handLevels ??= {};
  current.runHandCounts ??= {};
  current.consumables ??= { tarot: 0, spectral: 0, planet: 0 };
  current.inventory ??= { arcanes: [], constellations: [], presages: [] };
  current.inventory.arcanes ??= [];
  current.inventory.constellations ??= [];
  current.inventory.presages ??= [];

  const handIds = new Set((current.hand || []).map(card => card.id));
  const selected = (current.selected || []).filter(id => handIds.has(id)).slice(0, 5);
  if (selected.length !== (current.selected || []).length) {
    current.selected = selected;
    changed = true;
  }

  if (current.run) {
    current.run.schemaVersion = 2;
    current.run.maxAnte ??= MAX_ANTE;
    current.run.history ??= [];
  }

  return changed;
}

async function startNewRun(save = true) {
  state = createRound({ target: 300, hands: 4, discards: 3, handSize: 8, initialDraw: false });
  ensureJokerState(state);
  ensureDeckState(state);
  initializeFreshRun(state);
  applyProfileToRun(profile, state);
  await commitProfile(recordRunStarted(profile, state));
  if (save) await saveState();
}

async function saveState() {
  if (!state) return;
  try {
    await game.settings.set(MODULE_ID, SAVE_KEY, state);
  } catch (error) {
    console.error("Dragon's Ante | Échec de sauvegarde", error);
    pushNotice("La run fonctionne, mais la sauvegarde n’a pas pu être enregistrée.", "warn");
  }
}

async function saveProfile() {
  if (!profile) return;
  try {
    await game.settings.set(MODULE_ID, PROFILE_KEY, profile);
  } catch (error) {
    console.error("Dragon's Ante | Échec de sauvegarde des Chroniques", error);
  }
}

async function commitProfile(unlocks = []) {
  applyProfileToRun(profile, state);
  await saveProfile();
  const validUnlocks = (unlocks || []).filter(entry => entry?.joker);
  if (validUnlocks.length) playUiSound("unlock");
  for (const entry of validUnlocks) {
    pushNotice(`Déblocage : ${entry.joker.name} — ${entry.achievement.name}`, "success");
  }
}

function pushNotice(message, type = "info") {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  notices.push({ id, message, type });
  if (document.getElementById(APP_ID)?.classList.contains("da-visible")) {
    render();
    requestAnimationFrame(() => juice?.animateNotice());
  }
  setTimeout(() => {
    notices = notices.filter(entry => entry.id !== id);
    if (document.getElementById(APP_ID)?.classList.contains("da-visible")) render();
  }, 3600);
}

async function toggleSound() {
  soundEnabled = !soundEnabled;
  await game.settings.set(MODULE_ID, SOUND_KEY, soundEnabled);
  if (!soundEnabled) { audio.pause(); juice?.stopAll(); }
  else syncMusic(true);
  render();
}

async function setVolume(value) {
  soundVolume = clamp(Number.isFinite(value) ? value : 0.35, 0, 1);
  audio.volume = soundVolume;
  await game.settings.set(MODULE_ID, VOLUME_KEY, soundVolume);
  const label = document.querySelector(".da-volume-value");
  if (label) label.textContent = `${Math.round(soundVolume * 100)}%`;
}

function syncMusic(force = false) {
  if (!soundEnabled) { audio.pause(); return; }
  const appVisible = document.getElementById(APP_ID)?.classList.contains("da-visible");
  if (!appVisible) return;
  const desired = !state ? HOME_TRACK : (state.run?.phase === "blind" || state.run?.phase === "shop" || state.run?.phase === "blind-complete" || state.run?.phase === "run-over" || state.run?.phase === "run-won") ? GAME_TRACK : HOME_TRACK;
  const current = audio.getAttribute("data-track") || "";
  const route = current !== desired || force;
  if (route) {
    audio.src = desired;
    audio.setAttribute("data-track", desired);
    audio.volume = soundVolume;
  }
  audio.play().catch(() => {});
}

function render() {
  state ? renderGame() : renderHome();
  syncMusic();
}

function renderHome() {
  const app = document.getElementById(APP_ID);
  if (!app) return;
  const hasSave = Boolean(state);
  const summary = state ? runSummary(state) : null;

  app.innerHTML = shell(`
    <main class="da-home" style="${homeBackgroundStyle()}">
      <div class="da-home-hero">
        <div class="da-home-copy">
          <p class="da-kicker">POKER ROGUELIKE FANTASY</p>
          <img class="da-home-logo" src="${HOME_LOGO}?v=${MODULE_VERSION}" alt="Dragon's Ante">
          <p class="da-subtitle">Huit Antes. Une table. Beaucoup trop de décisions cupides et franchement excellentes.</p>
          <div class="da-home-art-tag">${MODULE_VERSION} · UI Polish</div>

          <div class="da-home-actions">
            ${hasSave ? `<button class="da-button da-button-main" data-action="continue">Continuer la run</button>` : ""}
            <button class="da-button ${hasSave ? "da-button-quiet" : "da-button-main"}" data-action="new-run">Nouvelle run</button>
            <button class="da-button da-button-quiet" data-action="chronicles">Chroniques du Dragon</button>
          </div>

          ${hasSave ? saveSummary(summary) : `<div class="da-save-summary"><small>NOUVELLE ÈRE</small><strong>Dragon's Ante v${MODULE_VERSION}</strong><span>Collection · statistiques · succès · déblocages</span></div>`}
        </div>
      </div>
      <div class="da-version">v${MODULE_VERSION} · UI Polish · Chroniques du Dragon · 150 Atouts</div>
    </main>
  `);
  if (overlay) document.querySelector(".da-shell")?.insertAdjacentHTML("beforeend", renderOverlay());
}

function renderGame() {
  const app = document.getElementById(APP_ID);
  if (!app || !state) return;
  ensureJokerState(state);
  ensureRunState(state);
  ensureDeckState(state);

  const main = state.run.phase === "shop" ? renderShop() : renderBlind();
  app.innerHTML = shell(main);

  if (catalogOpen) document.querySelector(".da-shell")?.insertAdjacentHTML("beforeend", jokerCatalog());
  if (overlay) document.querySelector(".da-shell")?.insertAdjacentHTML("beforeend", renderOverlay());
}

function renderBlind() {
  const blind = getBlind(state);
  const selectedCards = state.hand.filter(card => state.selected.includes(card.id));
  const selectedCount = selectedCards.length;
  const preview = selectedCount ? previewWithJokers(state, selectedCards) : null;
  const gameOver = state.status !== "playing";

  return `
    <main class="da-game-layout">
      ${blindSidebar(blind, preview)}

      <section class="da-playfield">
        <div class="da-playfield-top">
          <div class="da-slot-title"><span>ANTE ${state.run.ante}/${MAX_ANTE}</span><small>${escapeHtml(blind.name)}</small></div>
          ${blindProgress()}
          <div class="da-version-pill">${MODULE_VERSION}</div>
        </div>

        ${jokerBar()}
        ${inventoryBar()}

        <section class="da-table-zone">
          ${state.lastResult ? `
            <div class="da-table-result-title"><small>MAIN JOUÉE</small><strong>${state.lastResult.name}</strong><span>+${formatNumber(state.lastResult.score)} pts</span></div>
            <div class="da-played-cards">${state.lastResult.cards.map(card => playedCardHtml(card)).join("")}</div>
          ` : `
            <div class="da-empty-table">
              <span class="da-watermark">${blind.isBoss ? blind.icon : "♠"}</span>
              <strong>${blind.isBoss ? escapeHtml(blind.name) : "La table vous attend"}</strong>
              <small>${escapeHtml(blind.description)}</small>
            </div>
          `}
        </section>

        <section class="da-hand-section">
          <div class="da-hand-heading">
            <div><small>VOTRE MAIN</small><strong>${selectedCount}/5 sélectionnée${selectedCount > 1 ? "s" : ""}</strong></div>
            <div class="da-hand-hint">${blind.isBoss && blind.disabled ? "Capacité du Boss neutralisée" : "Cliquez sur une carte pour la sélectionner"}</div>
          </div>

          <div class="da-hand-row">
            ${state.hand.map(card => cardHtml(card, state.selected.includes(card.id))).join("")}
            ${deckHtml()}
          </div>

          <div class="da-action-row">
            <button class="da-action-button da-discard-action" data-action="discard" ${gameOver || !selectedCount || state.discardsRemaining <= 0 ? "disabled" : ""}>
              <span>Défausser</span><small>${state.discardsRemaining} restante${state.discardsRemaining > 1 ? "s" : ""}</small>
            </button>
            <button class="da-action-button da-play-action" data-action="play" ${gameOver || !selectedCount || state.handsRemaining <= 0 ? "disabled" : ""}>
              <span>Jouer la main</span><small>${preview ? `${preview.name} · ${formatNumber(preview.score)} pts` : "Choisissez vos cartes"}</small>
            </button>
          </div>
        </section>
      </section>

      ${gameOver ? endPanel() : ""}
    </main>
  `;
}

function previewEffectClass(preview) {
  if (!preview) return "";
  const totalMult = Number(preview.mult || 0) * Number(preview.xMult || 1);
  if (totalMult >= 100) return "is-arcane";
  if (totalMult >= 40) return "is-ember";
  if (totalMult >= 20) return "is-glow";
  return "";
}

function blindSidebar(blind, preview) {
  return `
    <aside class="da-sidebar">
      <section class="da-run-card">
        <div><small>ANTE</small><strong>${state.run.ante}</strong><span>/ ${MAX_ANTE}</span></div>
        <div class="da-run-mini-progress">${[0,1,2].map(index => {
          const cls = index < state.run.blindIndex ? "is-done" : index === state.run.blindIndex ? "is-current" : "";
          return `<i class="${cls}">${index === 2 ? "♛" : "◆"}</i>`;
        }).join("")}</div>
      </section>

      <section class="da-blind-card ${blind.isBoss ? "is-boss" : ""}">
        <div class="da-blind-symbol">${blind.icon}</div>
        <div class="da-blind-copy"><small>${blind.isBoss ? "BOSS" : blind.name.toUpperCase()}</small><strong>${formatNumber(blind.target)}</strong><span>${escapeHtml(blind.description)}</span></div>
      </section>

      <section class="da-score-card">
        <small>SCORE</small><strong>${formatNumber(state.score)}</strong>
        <div class="da-score-progress"><i style="width:${Math.min(100, Math.round(state.score / state.target * 100))}%"></i></div>
      </section>

      <section class="da-hand-preview ${preview ? "has-preview" : ""} ${previewEffectClass(preview)}">
        <div class="da-preview-name"><small>MAIN</small><strong>${preview ? preview.name : "—"}</strong></div>
        <div class="da-preview-math"><span class="da-chip-box">${preview ? preview.chips : 0}</span><b>×</b><span class="da-mult-box">${preview ? preview.mult : 0}</span></div>
        <div class="da-preview-total">${preview ? `${preview.xMult !== 1 ? `X${preview.xMult} · ` : ""}${formatNumber(preview.score)} pts` : "Sélectionnez des cartes"}</div>
      </section>

      <section class="da-resource-grid"><div><strong>${state.handsRemaining}</strong><span>Mains</span></div><div><strong>${state.discardsRemaining}</strong><span>Défausses</span></div></section>
      <section class="da-money-card"><small>BOURSE</small><strong class="${state.money < 0 ? "is-debt" : ""}">${coinHtml(state.money)}</strong><span>${state.money < 0 ? `Dette autorisée jusqu’à ${coinHtml(spendingFloor(state))}` : "À dépenser dans la prochaine boutique"}</span></section>
      <button class="da-side-button da-side-button-jokers" data-action="catalog">Catalogue · ${state.jokers.length}/${MAX_JOKERS}</button>
      <button class="da-side-button da-side-button-jokers" data-action="chronicles">Chroniques</button>
      <button class="da-side-button da-side-button-muted" data-action="home">Accueil</button>
    </aside>
  `;
}

function renderShop() {
  const shop = ensureShop(state);
  const next = getNextBlind(state);
  return `
    <main class="da-game-layout da-shop-layout">
      <aside class="da-sidebar da-shop-sidebar">
        <section class="da-run-card">
          <div><small>ANTE</small><strong>${state.run.ante}</strong><span>/ ${MAX_ANTE}</span></div>
          <div class="da-run-mini-progress">${[0,1,2].map(index => {
            const cls = index <= state.run.blindIndex ? "is-done" : index === state.run.blindIndex + 1 ? "is-current" : "";
            return `<i class="${cls}">${index === 2 ? "♛" : "◆"}</i>`;
          }).join("")}</div>
        </section>

        <section class="da-shop-money"><small>VOTRE BOURSE</small><strong class="${state.money < 0 ? "is-debt" : ""}">${coinHtml(state.money)}</strong><span>${spendingFloor(state) < 0 ? `Crédit marchand : ${coinHtml(spendingFloor(state))}` : "Pas de crédit disponible"}</span></section>

        <button class="da-shop-side-reroll" data-action="reroll-shop" ${rerollDisabled(shop) ? "disabled" : ""}>
          <span>↻ Relancer la boutique</span>
          <small>${shop.freeRerolls > 0 ? "Relance gratuite" : `Coût : ${coinHtml(shop.rerollCost)}`}</small>
        </button>

        <section class="da-shop-sidebar-stats">
          <div><small>RELANCES</small><strong>${state.shopRerolls || 0}</strong></div>
          <div><small>RÉCOMPENSES</small><strong>${coinHtml(state.run.totalRewards || 0)}</strong></div>
        </section>

        <button class="da-side-button da-side-button-jokers" data-action="catalog">Catalogue · ${state.jokers.length}/${MAX_JOKERS}</button>
        <button class="da-side-button da-side-button-jokers" data-action="chronicles">Chroniques</button>
        <button class="da-side-button da-side-button-muted" data-action="home">Accueil</button>

        <button class="da-shop-side-continue ${next.isBoss ? "is-boss" : ""}" data-action="leave-shop">
          <small>PROCHAINE MISE</small>
          <strong>${escapeHtml(next.name)}</strong>
          <span class="da-shop-side-target">${formatNumber(next.target)} pts · Affronter →</span>
          <span class="da-shop-side-description">${escapeHtml(next.description)}</span>
        </button>
      </aside>

      <section class="da-shop-playfield">
        <header class="da-shop-header">
          <div><small>ENTRE DEUX MISES</small><h2>Le Marché du Dragon</h2><p>Atouts, consommables, boosters et petites mauvaises idées stratégiques.</p></div>
        </header>

        <section class="da-shop-offers">${shop.offers.map((offer,index)=>shopOfferCard(offer,index)).join("")}</section>
        <section class="da-shop-suboffers">
          ${shopConsumableCard(shop.consumableOffer)}
          ${shopBoosterCard(shop.boosterOffer)}
        </section>
        ${inventoryWorkshop()}

        <section class="da-shop-equipped">
          <div class="da-shop-section-title"><div><small>VOTRE BUILD</small><strong>Atouts équipés</strong></div><span>${state.jokers.length}/${MAX_JOKERS}</span></div>
          <div class="da-shop-owned-list">${state.jokers.length ? state.jokers.map((id,index)=>shopOwnedAtout(id,index)).join("") : `<div class="da-shop-empty">Aucun Atout pour le moment. Une run pauvre, mais ambitieuse.</div>`}</div>
        </section>
      </section>
    </main>
  `;
}

function inventoryWorkshop() {
  return `
    <section class="da-shop-equipped da-workshop-block">
      <div class="da-shop-section-title"><div><small>ATELIER DU DECK</small><strong>Consommables et modifications</strong></div><span>${inventoryCount(state)}/${INVENTORY_LIMIT}</span></div>
      ${inventoryBar(true)}
    </section>
  `;
}

function shopOfferCard(offer, index) {
  const def = JOKER_MAP.get(offer.id);
  if (!def) return "";
  const full = state.jokers.length >= MAX_JOKERS;
  const affordable = canSpend(state, offer.price);
  const disabled = offer.purchased || full || !affordable;
  return `
    <article class="da-shop-offer rarity-${def.rarity} ${offer.purchased ? "is-sold" : ""}">
      ${jokerArtwork(def, "da-shop-offer-art")}
      <small>${rarityLabel(def.rarity)}</small>
      <h3>${escapeHtml(def.name)}</h3>
      <p>${escapeHtml(def.summary)}</p>
      <div class="da-shop-offer-bottom"><strong>${coinHtml(offer.price)}</strong><button data-action="buy-shop-offer" data-offer-index="${index}" ${disabled ? "disabled" : ""}>${offer.purchased ? "Acheté" : full ? "5/5 Atouts" : affordable ? "Acheter" : "Trop cher"}</button></div>
    </article>
  `;
}

function shopConsumableCard(offer) {
  const def = offer ? getConsumable(offer.id) : null;
  if (!offer || !def) return "";
  return `
    <article class="da-shop-suboffer ${offer.purchased ? "is-sold" : ""}">
      <small>${categoryLabel(def.category)}</small>
      <h3>${escapeHtml(def.name)}</h3>
      <p>${escapeHtml(def.description)}</p>
      <div class="da-shop-offer-bottom"><strong>${coinHtml(offer.price)}</strong><button data-action="buy-consumable-offer" ${offer.purchased || !canSpend(state, offer.price) || inventoryCount(state) >= INVENTORY_LIMIT ? "disabled" : ""}>${offer.purchased ? "Acheté" : inventoryCount(state) >= INVENTORY_LIMIT ? "Inventaire plein" : "Acheter"}</button></div>
    </article>
  `;
}

function shopBoosterCard(offer) {
  if (!offer) return "";
  return `
    <article class="da-shop-suboffer booster ${offer.purchased ? "is-sold" : ""}">
      <small>BOOSTER</small>
      <h3>${escapeHtml(offer.name)}</h3>
      <p>Ouvrez un pack et choisissez 1 récompense parmi 3 : consommable, amélioration de main ou trésor.</p>
      <div class="da-shop-offer-bottom"><strong>${coinHtml(offer.price)}</strong><button data-action="buy-booster-offer" ${offer.purchased || !canSpend(state, offer.price) ? "disabled" : ""}>${offer.purchased ? "Ouvert" : "Ouvrir"}</button></div>
    </article>
  `;
}

function shopOwnedAtout(id, index) {
  const def = JOKER_MAP.get(id);
  if (!def) return "";
  const value = sellValue(state, id);
  const bossPrep = state.run.blindIndex === 1 && id === "luchador";
  return `
    <article class="da-shop-owned rarity-${def.rarity}">
      ${jokerArtwork(def, "da-shop-owned-art")}
      <div class="da-shop-owned-copy"><strong>${escapeHtml(def.name)}</strong><small>${escapeHtml(def.summary)}</small>${bossPrep ? `<em>Le vendre maintenant neutralisera le prochain Boss.</em>` : ""}</div>
      <div class="da-shop-owned-order"><button data-action="move-joker" data-joker-id="${id}" data-direction="-1" ${index === 0 ? "disabled" : ""}>←</button><button data-action="move-joker" data-joker-id="${id}" data-direction="1" ${index === state.jokers.length - 1 ? "disabled" : ""}>→</button></div>
      <button class="da-sell-button" data-action="sell-joker" data-joker-id="${id}">Vendre<strong>${coinHtml(value)}</strong></button>
    </article>
  `;
}

function rerollDisabled(shop) { return shop.freeRerolls > 0 ? false : !canSpend(state, shop.rerollCost); }

function blindProgress() {
  return `<div class="da-top-blind-progress">${["Petite","Grande","Boss"].map((label,index)=>{
    const cls = index < state.run.blindIndex ? "is-done" : index === state.run.blindIndex ? "is-current" : "";
    return `<span class="${cls}">${label}</span>`;
  }).join("")}</div>`;
}

function jokerBar() {
  const slots = [];
  for (let i=0;i<MAX_JOKERS;i++) {
    const id = state.jokers[i];
    if (!id) {
      slots.push(`<div class="da-joker-slot is-empty"><span>+</span><small>Atout</small></div>`);
      continue;
    }
    const joker = JOKER_MAP.get(id);
    slots.push(`<div class="da-joker-slot rarity-${joker.rarity}" data-joker-id="${joker.id}" title="${escapeAttr(joker.name)} — ${escapeAttr(joker.summary)}">${jokerArtwork(joker, "da-joker-slot-art")}<strong>${escapeHtml(shortName(joker.name))}</strong><small>${rarityLabel(joker.rarity)}</small></div>`);
  }
  return `<section class="da-joker-bar"><div class="da-joker-bar-label"><span>ATOUTS</span><small>${state.jokers.length}/${MAX_JOKERS}</small></div><div class="da-joker-slots">${slots.join("")}</div></section>`;
}

function inventoryBar(compact = false) {
  ensureDeckState(state);
  const entries = [];
  for (const [category, items] of Object.entries(state.inventory)) {
    items.forEach((id, index) => {
      const def = getConsumable(id);
      if (!def) return;
      entries.push(`
        <button class="da-consumable-chip ${category}" data-action="open-consumable" data-category="${category}" data-index="${index}" title="${escapeAttr(def.description)}">
          <span>${categoryBadge(category)}</span>
          <strong>${escapeHtml(def.name)}</strong>
        </button>
      `);
    });
  }
  return `
    <section class="da-consumable-bar ${compact ? "is-compact" : ""}">
      <div class="da-consumable-label"><span>CONSOMMABLES</span><small>${inventoryCount(state)}/${INVENTORY_LIMIT}</small></div>
      <div class="da-consumable-list">${entries.length ? entries.join("") : `<div class="da-consumable-empty">Aucun consommable pour le moment.</div>`}</div>
    </section>
  `;
}

function jokerCatalog() {
  return `
    <div class="da-catalog-backdrop">
      <section class="da-catalog-panel">
        <header class="da-catalog-header">
          <div><small>DRAGON'S ANTE · v${MODULE_VERSION}</small><h2>Catalogue des Atouts</h2><p>Encyclopédie des 150 Atouts. En run, les Atouts s’obtiennent désormais dans la boutique.</p></div>
          <button class="da-catalog-close" data-action="close-catalog">×</button>
        </header>
        <div class="da-active-jokers-editor"><div class="da-active-editor-title"><strong>Build actuel</strong><span>${state.jokers.length}/${MAX_JOKERS}</span></div><div class="da-active-editor-list">${state.jokers.length ? state.jokers.map((id,index)=>activeJokerEditor(id,index)).join("") : `<span class="da-no-jokers">Aucun Atout équipé.</span>`}</div></div>
        <div class="da-catalog-tools"><input type="search" value="${escapeAttr(catalogQuery)}" placeholder="Rechercher un Atout…" data-joker-search><select data-joker-rarity>${[["all","Toutes raretés"],["common","Commun"],["uncommon","Peu commun"],["rare","Rare"],["legendary","Légendaire"]].map(([value,label])=>`<option value="${value}" ${catalogRarity===value?"selected":""}>${label}</option>`).join("")}</select><span class="da-catalog-count">${filteredJokers().length} / ${JOKERS.length}</span></div>
        <div class="da-joker-grid">${jokerCatalogCards()}</div>
      </section>
    </div>
  `;
}

function filteredJokers() {
  const query = catalogQuery.trim().toLocaleLowerCase("fr");
  return JOKERS.filter(joker => (catalogRarity === "all" || joker.rarity === catalogRarity) && (!query || `${joker.name} ${joker.summary}`.toLocaleLowerCase("fr").includes(query)));
}

function jokerCatalogCards() {
  return filteredJokers().map(joker => {
    const owned = state.jokers.includes(joker.id);
    return `
      <article class="da-catalog-joker rarity-${joker.rarity} ${joker.status === "future" ? "is-future" : ""}">
        ${jokerArtwork(joker, "da-catalog-joker-art")}
        <div class="da-catalog-joker-top"><div><small>#${joker.number} · ${rarityLabel(joker.rarity)}</small><strong>${escapeHtml(joker.name)}</strong></div></div>
        <p>${escapeHtml(joker.summary)}</p>
        <div class="da-catalog-joker-foot"><span class="${joker.status === "live" ? "is-live" : "is-waiting"}">${joker.status === "live" ? "Fonctionnel" : "Système futur"}</span><span class="da-catalog-owned ${owned ? "is-owned" : ""}">${owned ? "Dans votre build" : "Catalogue"}</span></div>
      </article>
    `;
  }).join("");
}

function activeJokerEditor(id, index) {
  const joker = JOKER_MAP.get(id);
  if (!joker) return "";
  return `<div class="da-active-joker-row">${jokerArtwork(joker, "da-active-joker-art")}<strong>${escapeHtml(joker.name)}</strong><div><button data-action="move-joker" data-joker-id="${id}" data-direction="-1" ${index===0?"disabled":""}>←</button><button data-action="move-joker" data-joker-id="${id}" data-direction="1" ${index===state.jokers.length-1?"disabled":""}>→</button></div></div>`;
}

function renderOverlay() {
  if (!overlay) return "";
  if (overlay.type === "chronicles") return renderChronicles();
  if (overlay.type === "confirm-new-run") {
    return `
      <div class="da-modal-backdrop">
        <section class="da-modal-card">
          <small>NOUVELLE RUN</small>
          <h3>Remplacer la progression actuelle ?</h3>
          <p>La run en cours sera écrasée. Les musiques, elles, jugeront silencieusement.</p>
          <div class="da-modal-actions"><button class="da-button da-button-main" data-action="confirm-new-run">Oui, on y va</button><button class="da-button da-button-quiet" data-action="cancel-new-run">Annuler</button></div>
        </section>
      </div>
    `;
  }

  if (overlay.type === "booster") {
    const pending = state.run?.shop?.pendingBooster;
    if (!pending) return "";
    return `
      <div class="da-modal-backdrop">
        <section class="da-modal-card da-booster-modal">
          <small>BOOSTER OUVERT</small>
          <h3>${escapeHtml(pending.name)}</h3>
          <p>Choisissez 1 récompense parmi 3.</p>
          <div class="da-booster-choices">${pending.choices.map((choice,index)=>`<button class="da-booster-choice" data-action="choose-booster" data-choice-index="${index}">${escapeHtml(choice.label || choice.id)}</button>`).join("")}</div>
          <div class="da-modal-actions"><button class="da-button da-button-quiet" data-action="close-overlay">Fermer</button></div>
        </section>
      </div>
    `;
  }

  if (overlay.type === "use-consumable") {
    const category = overlay.category;
    const index = overlay.index;
    const id = state.inventory?.[category]?.[index];
    const def = getConsumable(id);
    if (!def) return "";

    if (def.kind === "hand") {
      return `
        <div class="da-modal-backdrop">
          <section class="da-modal-card da-consumable-modal">
            <small>${categoryLabel(category)}</small>
            <h3>${escapeHtml(def.name)}</h3>
            <p>${escapeHtml(def.description)}</p>
            <div class="da-target-grid">${Object.entries(HANDS).map(([key, hand])=>`<button class="da-target-card" data-action="use-consumable-hand" data-category="${category}" data-index="${index}" data-hand-key="${key}"><strong>${hand.name}</strong><small>Niveau ${state.handLevels?.[key] || 1}</small></button>`).join("")}</div>
            <div class="da-modal-actions"><button class="da-button da-button-quiet" data-action="close-overlay">Annuler</button></div>
          </section>
        </div>
      `;
    }

    const cards = allCards(state);
    return `
      <div class="da-modal-backdrop">
        <section class="da-modal-card da-consumable-modal large">
          <small>${categoryLabel(category)}</small>
          <h3>${escapeHtml(def.name)}</h3>
          <p>${escapeHtml(def.description)}</p>
          <div class="da-target-grid cards">${cards.map(card => `<button class="da-target-card mini" data-action="use-consumable-card" data-category="${category}" data-index="${index}" data-card-id="${card.id}"><strong>${card.rankLabel}${card.suitSymbol}</strong><small>${cardMeta(card)}</small></button>`).join("")}</div>
          <div class="da-modal-actions"><button class="da-button da-button-quiet" data-action="close-overlay">Annuler</button></div>
        </section>
      </div>
    `;
  }

  return "";
}


function renderChronicles() {
  const snap = profileSnapshot(profile);
  const stats = snap.stats;
  const favoriteJoker = snap.favoriteJokerId ? JOKER_MAP.get(snap.favoriteJokerId) : null;
  const liveJokers = JOKERS.filter(joker => joker.status === "live");
  const futureJokers = JOKERS.filter(joker => joker.status !== "live");
  const achievementIds = new Set(profile.achievements || []);
  const unlocked = new Set(profile.unlocks?.jokers || []);
  const discovered = new Set(profile.collection?.jokers || []);

  return `
    <div class="da-modal-backdrop da-chronicles-backdrop">
      <section class="da-chronicles-panel">
        <header class="da-chronicles-header">
          <div><small>MÉTA-PROGRESSION · PROFIL UTILISATEUR</small><h2>Chroniques du Dragon</h2><p>Vos runs passent. Les traces qu’elles laissent, elles, restent.</p></div>
          <button class="da-catalog-close" data-action="close-overlay">×</button>
        </header>

        <div class="da-chronicles-scroll">
          <section class="da-chronicles-stats">
            ${chronStat("Runs", stats.runsCompleted, `${stats.runsWon} victoire${stats.runsWon > 1 ? "s" : ""}`)}
            ${chronStat("Meilleure Ante", stats.bestAnte, `${stats.blindsWon} mises gagnées`)}
            ${chronStat("Meilleure main", formatNumber(stats.bestSingleHand), "points")}
            ${chronStat("Plus gros ×", formatCompactMultiplier(stats.biggestMultiplier), "multiplicateur effectif")}
            ${chronStat("Atouts découverts", `${snap.discoveredCount}/${snap.liveCount}`, `${snap.unlockedBonusCount}/${snap.unlockedBonusTotal} bonus débloqués`)}
            ${chronStat("Or gagné", coinHtml(stats.goldEarned), `${formatNumber(stats.goldSpent)} dépensé`)}
          </section>

          <section class="da-chronicles-section">
            <div class="da-chronicles-section-title"><div><small>PROFIL</small><h3>Habitudes de table</h3></div></div>
            <div class="da-chronicles-facts">
              <span><b>${formatNumber(stats.handsPlayed)}</b>Mains jouées</span>
              <span><b>${formatNumber(stats.cardsDiscarded)}</b>Cartes défaussées</span>
              <span><b>${formatNumber(stats.jokersPurchased)}</b>Atouts achetés</span>
              <span><b>${formatNumber(stats.boostersOpened)}</b>Boosters ouverts</span>
              <span><b>${favoriteJoker ? escapeHtml(favoriteJoker.name) : "—"}</b>Atout le plus déclenché</span>
              <span><b>${snap.favoriteHand ? handName(snap.favoriteHand) : "—"}</b>Main favorite</span>
            </div>
          </section>

          <section class="da-chronicles-section">
            <div class="da-chronicles-section-title"><div><small>DÉBLOCAGES</small><h3>Épreuves du Dragon</h3></div><strong>${snap.achievementCount}/${snap.achievementTotal}</strong></div>
            <div class="da-achievement-grid">
              ${ACHIEVEMENTS.map(achievement => {
                const done = achievementIds.has(achievement.id);
                const rewardId = LOCKED_JOKER_IDS.find(id => profile.unlocks.jokers.includes(id) && unlocked.has(id) && ACHIEVEMENTS.some(a => a.id === achievement.id));
                return `<article class="da-achievement ${done ? "is-complete" : ""}"><span>${done ? "✓" : "◇"}</span><div><strong>${escapeHtml(achievement.name)}</strong><p>${escapeHtml(achievement.description)}</p><small>${escapeHtml(achievement.reward)}</small></div></article>`;
              }).join("")}
            </div>
          </section>

          <section class="da-chronicles-section">
            <div class="da-chronicles-section-title"><div><small>COLLECTION</small><h3>Atouts rencontrés</h3></div><strong>${snap.discoveredCount}/${snap.liveCount}</strong></div>
            <div class="da-chronicle-collection">
              ${liveJokers.map(joker => chronicleJokerCard(joker, discovered.has(joker.id), unlocked.has(joker.id))).join("")}
              ${futureJokers.map(joker => `<article class="da-chron-joker is-future"><span>?</span><strong>À venir</strong><small>0.5.x+</small></article>`).join("")}
            </div>
          </section>

          <section class="da-chronicles-section">
            <div class="da-chronicles-section-title"><div><small>ARCHIVES</small><h3>Dernières runs</h3></div><strong>${profile.history.length}/${20}</strong></div>
            <div class="da-run-history">
              ${profile.history.length ? profile.history.map(runHistoryRow).join("") : `<div class="da-chron-empty">Aucune run terminée enregistrée pour le moment.</div>`}
            </div>
          </section>
        </div>
      </section>
    </div>
  `;
}

function chronStat(label, value, sub) {
  return `<article class="da-chron-stat"><small>${escapeHtml(label)}</small><strong>${value}</strong><span>${escapeHtml(sub)}</span></article>`;
}

function chronicleJokerCard(joker, discovered, unlocked) {
  const isMetaLocked = LOCKED_JOKER_IDS.includes(joker.id) && !unlocked;
  if (!discovered) {
    const hint = isMetaLocked ? "Verrouillé par une Épreuve" : "Non découvert";
    return `<article class="da-chron-joker rarity-${joker.rarity} is-hidden"><span>?</span><strong>???</strong><small>${hint}</small></article>`;
  }
  return `<article class="da-chron-joker rarity-${joker.rarity}">${jokerArtwork(joker, "da-chron-joker-art")}<strong>${escapeHtml(joker.name)}</strong><small>${rarityLabel(joker.rarity)}</small></article>`;
}

function runHistoryRow(entry) {
  const date = entry.endedAt ? new Date(entry.endedAt).toLocaleDateString("fr-FR") : "—";
  return `<article class="da-run-history-row ${entry.won ? "is-win" : ""}"><span>${entry.won ? "🐉" : "☠"}</span><div><strong>${entry.won ? "Victoire" : "Défaite"} · Ante ${entry.ante}</strong><small>${date} · ${entry.blindsWon} mises · meilleure main ${formatNumber(entry.bestHandScore || 0)}</small></div><div><b>${formatCompactMultiplier(entry.biggestMultiplier || 0)}</b><small>${entry.jokers?.length || 0} Atouts</small></div></article>`;
}

function formatCompactMultiplier(value) {
  const n = Number(value || 0);
  if (n >= 1000) return `×${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, notation: "compact" }).format(n)}`;
  return `×${Number(n.toFixed(2))}`;
}

function handName(key) {
  return HANDS[key]?.name || key;
}

function cardHtml(card, selected) {
  const red = card.color === "red";
  return `
    <button type="button" class="da-card ${red ? "is-red" : "is-black"} ${selected ? "is-selected" : ""} ${card.edition ? `edition-${card.edition}` : ""}" data-action="toggle-card" data-card-id="${card.id}" aria-pressed="${selected}" title="${escapeAttr(cardTitle(card))}">
      <span class="da-card-corner da-card-corner-top"><strong>${card.rankLabel}</strong><i>${card.suitSymbol}</i></span>
      <span class="da-card-center">${card.suitSymbol}</span>
      ${card.bonusChips ? `<span class="da-card-bonus">+${card.bonusChips}</span>` : ""}
      ${card.edition ? `<span class="da-card-mark edition">${editionLabel(card.edition)}</span>` : ""}
      ${card.seal ? `<span class="da-card-mark seal">${sealLabel(card.seal)}</span>` : ""}
      <span class="da-card-corner da-card-corner-bottom"><strong>${card.rankLabel}</strong><i>${card.suitSymbol}</i></span>
    </button>
  `;
}

function playedCardHtml(card) {
  const red = card.color === "red";
  return `
    <div class="da-card da-table-card ${red ? "is-red" : "is-black"} ${card.edition ? `edition-${card.edition}` : ""}">
      <span class="da-card-corner da-card-corner-top"><strong>${card.rankLabel}</strong><i>${card.suitSymbol}</i></span>
      <span class="da-card-center">${card.suitSymbol}</span>
      <span class="da-card-corner da-card-corner-bottom"><strong>${card.rankLabel}</strong><i>${card.suitSymbol}</i></span>
    </div>
  `;
}

function cardTitle(card) {
  const parts = [`${card.rankLabel}${card.suitSymbol}`];
  if (card.bonusChips) parts.push(`+${card.bonusChips} Jetons`);
  if (card.edition) parts.push(editionLabel(card.edition));
  if (card.seal) parts.push(sealLabel(card.seal));
  return parts.join(" · ");
}

function cardMeta(card) {
  const parts = [];
  if (card.edition) parts.push(editionLabel(card.edition));
  if (card.seal) parts.push(sealLabel(card.seal));
  if (card.bonusChips) parts.push(`+${card.bonusChips}`);
  return parts.length ? parts.join(" · ") : "Carte simple";
}

function deckHtml() {
  return `<div class="da-deck-stack" title="${state.drawPile.length} cartes dans la pioche"><div class="da-deck-card da-deck-back-3"></div><div class="da-deck-card da-deck-back-2"></div><div class="da-deck-card da-deck-back-1"><span>◆</span><b>♠</b></div><strong>${state.drawPile.length}</strong></div>`;
}

function endPanel() {
  const blind = getBlind(state);
  const runWon = state.run.phase === "run-won";
  const runOver = state.run.phase === "run-over";
  const reward = state.run.lastReward;

  if (runWon) {
    return `<div class="da-end-backdrop"><section class="da-end-card is-win da-run-final"><span class="da-end-icon">🐉</span><small>HUIT ANTES PLUS TARD</small><h2>Le Dragon se couche.</h2><strong>Run victorieuse · ${coinHtml(state.money)}</strong><div class="da-run-final-stats"><span><b>${state.run.blindsWon}</b>Mises gagnées</span><span><b>${state.jokers.length}</b>Atouts</span><span><b>${coinHtml(state.run.totalRewards)}</b>Récompenses</span></div><div class="da-end-actions"><button class="da-button da-button-main" data-action="new-run">Nouvelle run</button><button class="da-button da-button-quiet" data-action="home">Accueil</button></div></section></div>`;
  }
  if (runOver) {
    return `<div class="da-end-backdrop"><section class="da-end-card is-loss da-run-final"><span class="da-end-icon">☠</span><small>ANTE ${state.run.ante} · ${escapeHtml(blind.name)}</small><h2>Le Dragon garde votre mise.</h2><strong>${formatNumber(state.score)} / ${formatNumber(state.target)} pts</strong><div class="da-run-final-stats"><span><b>${state.run.blindsWon}</b>Mises gagnées</span><span><b>${state.jokers.length}</b>Atouts</span><span><b>${coinHtml(state.money)}</b>Bourse finale</span></div><div class="da-end-actions"><button class="da-button da-button-main" data-action="new-run">Recommencer</button><button class="da-button da-button-quiet" data-action="home">Accueil</button></div></section></div>`;
  }
  return `<div class="da-end-backdrop"><section class="da-end-card is-win"><span class="da-end-icon">${blind.isBoss ? "♛" : "★"}</span><small>${blind.isBoss ? "BOSS VAINCU" : "MISE REMPORTÉE"}</small><h2>${escapeHtml(blind.name)}</h2><strong>${formatNumber(state.score)} / ${formatNumber(state.target)} pts</strong>${reward ? `<div class="da-reward-breakdown"><span>Récompense <b>${coinHtml(reward.base)}</b></span><span>Mains restantes <b>+${coinHtml(reward.hands)}</b></span><span>Intérêts <b>+${coinHtml(reward.interest)}</b></span><strong>Total +${coinHtml(reward.total)}</strong></div>` : ""}<div class="da-end-actions"><button class="da-button da-button-main" data-action="advance-after-blind">${blind.isBoss ? "Ante suivante" : "Entrer dans la boutique"}</button><button class="da-button da-button-quiet" data-action="home">Accueil</button></div></section></div>`;
}

function homeBackgroundStyle() {
  return `background-image: linear-gradient(180deg, rgba(10,8,8,.18), rgba(10,8,8,.74)), url('${HOME_BG}?v=${MODULE_VERSION}'); background-position: center top; background-size: cover;`;
}

function saveSummary(summary) {
  const phaseLabels = { blind: summary.blind.name, "blind-complete": `${summary.blind.name} remportée`, shop: "Boutique", "run-over": "Run terminée", "run-won": "Run victorieuse" };
  return `<div class="da-save-summary"><small>RUN ENREGISTRÉE</small><strong>Ante ${summary.ante}/${summary.maxAnte}</strong><span>${phaseLabels[state.run.phase] || summary.blind.name} · ${coinHtml(summary.money)} · ${summary.jokers} Atout${summary.jokers > 1 ? "s" : ""}</span></div>`;
}

function shell(content) {
  return `
    <div class="da-shell">
      <header class="da-topbar">
        <div class="da-brand"><span class="da-brand-mark">♠</span><div><strong>DRAGON'S ANTE</strong><small>Fantasy Poker Roguelike</small></div></div>
        <div class="da-topbar-actions"><label class="da-volume-control" title="Régler le volume"><span>${soundEnabled ? "♫" : "🔇"}</span><input type="range" min="0" max="100" step="1" value="${Math.round(soundVolume * 100)}" data-volume-slider><small class="da-volume-value">${Math.round(soundVolume * 100)}%</small></label><button class="da-audio-toggle" data-action="toggle-sound" title="${soundEnabled ? "Couper" : "Activer"} l’audio">${soundEnabled ? "♫" : "🔇"}</button><button class="da-close" data-action="close" title="Fermer Dragon's Ante">×</button></div>
      </header>
      ${content}
      ${renderNotices()}
    </div>
  `;
}

function renderNotices() {
  if (!notices.length) return "";
  return `<div class="da-notice-stack">${notices.map(notice => `<div class="da-notice ${notice.type}">${escapeHtml(notice.message)}</div>`).join("")}</div>`;
}

function categoryLabel(category) {
  return ({ arcanes: "ARCANES", constellations: "CONSTELLATIONS", presages: "PRÉSAGES" })[category] || category;
}
function categoryBadge(category) {
  return ({ arcanes: "✦", constellations: "✧", presages: "☽" })[category] || "•";
}
function rarityLabel(rarity) { return ({ common: "Commun", uncommon: "Peu commun", rare: "Rare", legendary: "Unique" })[rarity] || rarity; }
function jokerArtwork(joker, className = "") {
  return `<span class="da-joker-art ${className}" style="--da-joker-art-image:url('${escapeAttr(jokerArtUrl(joker))}')" aria-hidden="true"><span class="da-joker-art-fallback">${jokerGlyph(joker)}</span></span>`;
}
function jokerGlyph(joker) { if (joker.rarity === "legendary") return "♛"; if (joker.rarity === "rare") return "✦"; if (joker.rarity === "uncommon") return "◆"; return "♠"; }
function shortName(name) { return name.length > 15 ? `${name.slice(0, 13)}…` : name; }
function formatNumber(value) { return new Intl.NumberFormat("fr-FR").format(value); }
function formatCoins(value) { return `${Number(value || 0)} pièces d’or`; }
function coinHtml(value) { return `<span class="da-coin-value">${Number(value || 0)}</span><span class="da-coin-icon" aria-hidden="true" style="background-image:url('${COIN_ICON}')"></span>`; }
function editionLabel(value) { return ({ gilded: "Dorée", runic: "Runique", prismatic: "Prismatique" })[value] || value; }
function sealLabel(value) { return ({ blood: "Sceau de Sang", astral: "Sceau Astral", merchant: "Sceau du Marchand", occult: "Sceau Occulte" })[value] || value; }
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]); }
function escapeAttr(value) { return escapeHtml(value).replace(/'/g, "&#39;"); }
