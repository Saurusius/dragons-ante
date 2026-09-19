import { ASSETS } from "../core/assets.js";

const SFX = {
  select: ASSETS.audio.sfx.select,
  deal: ASSETS.audio.sfx.deal,
  play: ASSETS.audio.sfx.play,
  discard: ASSETS.audio.sfx.discard,
  coin: ASSETS.audio.sfx.coin,
  joker: ASSETS.audio.sfx.joker,
  score: ASSETS.audio.sfx.score,
  scoreBig: ASSETS.audio.sfx.scoreBig,
  booster: ASSETS.audio.sfx.booster,
  boss: ASSETS.audio.sfx.boss,
  unlock: ASSETS.audio.sfx.unlock,
  blindWin: ASSETS.audio.sfx.blindWin,
  defeat: ASSETS.audio.sfx.defeat,
  shop: ASSETS.audio.sfx.shop,
  magic: ASSETS.audio.sfx.magic
};

const SFX_GAINS = {
  select: 0.6,
  deal: 0.56,
  play: 0.75,
  discard: 0.72,
  coin: 0.7,
  joker: 0.66,
  score: 0.52,
  scoreBig: 0.82,
  booster: 0.78,
  boss: 0.9,
  unlock: 0.82,
  blindWin: 0.8,
  defeat: 0.78,
  shop: 0.62,
  magic: 0.7
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function safeCss(value) {
  if (globalThis.CSS?.escape) return CSS.escape(String(value));
  return String(value).replace(/["\\]/g, "\\$&");
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(Number(value || 0)));
}

export function createJuiceController({
  moduleId,
  getSoundEnabled,
  getVolume,
  getAnimationMode
}) {
  const activeAudio = new Set();

  function mode() {
    const requested = getAnimationMode?.() || "normal";
    if (requested === "off") return "off";
    if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return "off";
    return requested === "fast" ? "fast" : "normal";
  }

  function scale() {
    if (mode() === "off") return 0;
    return mode() === "fast" ? 0.48 : 1;
  }

  function duration(ms) {
    return Math.max(1, Math.round(ms * scale()));
  }

  function stagger(ms) {
    return Math.max(0, Math.round(ms * scale()));
  }

  function stopAll() {
    for (const voice of activeAudio) {
      try { voice.pause(); voice.currentTime = 0; } catch (_) {}
    }
    activeAudio.clear();
  }

  function play(name, options = {}) {
    if (!getSoundEnabled?.()) return null;
    const file = SFX[name];
    if (!file) return null;

    const voice = new Audio(file);
    const gain = Number(options.gain ?? 1) * (SFX_GAINS[name] ?? 0.7);
    voice.volume = clamp(Number(getVolume?.() ?? 0.35) * gain, 0, 1);
    voice.playbackRate = clamp(Number(options.rate ?? 1), 0.65, 1.6);
    activeAudio.add(voice);
    const clean = () => activeAudio.delete(voice);
    voice.addEventListener("ended", clean, { once: true });
    voice.addEventListener("error", clean, { once: true });
    voice.play().catch(clean);
    return voice;
  }

  async function animate(el, keyframes, options = {}) {
    if (!el || scale() === 0 || typeof el.animate !== "function") return;
    const ms = duration(options.duration ?? 180);
    const delay = stagger(options.delay ?? 0);
    const animation = el.animate(keyframes, {
      duration: ms,
      delay,
      easing: options.easing || "cubic-bezier(.2,.78,.25,1)",
      fill: options.fill || "none",
      iterations: options.iterations || 1
    });
    try { await animation.finished; } catch (_) {}
  }

  async function animateCardSelection(cardId, selected) {
    const el = document.querySelector(`.da-card[data-card-id="${safeCss(cardId)}"]`);
    if (!el) return;
    await animate(el, selected ? [
      { transform: "translateY(-2px) scale(.98)", offset: 0 },
      { transform: "translateY(-13px) scale(1.045)", offset: .55 },
      { transform: "translateY(-9px) scale(1)", offset: 1 }
    ] : [
      { transform: "translateY(-9px) scale(1)", offset: 0 },
      { transform: "translateY(2px) scale(.98)", offset: .55 },
      { transform: "translateY(0) scale(1)", offset: 1 }
    ], { duration: 165 });
  }

  async function animateCardCommit(kind = "play") {
    if (scale() === 0) return;
    const nodes = [...document.querySelectorAll(".da-hand-row .da-card.is-selected")];
    if (!nodes.length) return;

    const jobs = nodes.map((node, index) => {
      const center = (nodes.length - 1) / 2;
      const spread = index - center;
      const keyframes = kind === "discard" ? [
        { transform: "translateY(-9px) rotate(0deg) scale(1)", opacity: 1 },
        { transform: `translate(${spread * 16}px, 18px) rotate(${spread * 4}deg) scale(.97)`, opacity: .9, offset: .35 },
        { transform: `translate(${spread * 42}px, 105px) rotate(${spread * 14}deg) scale(.8)`, opacity: 0 }
      ] : [
        { transform: "translateY(-9px) rotate(0deg) scale(1)", opacity: 1 },
        { transform: `translate(${spread * 8}px, -35px) rotate(${spread * 2.2}deg) scale(1.035)`, opacity: 1, offset: .45 },
        { transform: `translate(${spread * 14}px, -105px) rotate(${spread * 4}deg) scale(.88)`, opacity: 0 }
      ];
      return animate(node, keyframes, { duration: kind === "discard" ? 210 : 185, delay: index * 24 });
    });
    await Promise.all(jobs);
  }

  async function animateIncomingCards(cardIds = []) {
    if (scale() === 0 || !cardIds.length) return;
    const ids = [...new Set(cardIds)];
    const nodes = ids.map(id => document.querySelector(`.da-card[data-card-id="${safeCss(id)}"]`)).filter(Boolean);
    if (!nodes.length) return;

    const deck = document.querySelector(".da-deck-stack");
    const deckRect = deck?.getBoundingClientRect?.();
    const jobs = nodes.map((node, index) => {
      const rect = node.getBoundingClientRect();
      const dx = deckRect ? (deckRect.left + deckRect.width / 2) - (rect.left + rect.width / 2) : 110;
      const dy = deckRect ? (deckRect.top + deckRect.height / 2) - (rect.top + rect.height / 2) : -10;
      if (index % 2 === 0) setTimeout(() => play("deal", { rate: 0.96 + index * 0.012, gain: .9 }), stagger(index * 28));
      return animate(node, [
        { transform: `translate(${dx}px, ${dy}px) rotate(8deg) scale(.72)`, opacity: 0 },
        { transform: "translate(-3px, -5px) rotate(-1deg) scale(1.02)", opacity: 1, offset: .78 },
        { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1 }
      ], { duration: 230, delay: index * 34 });
    });
    await Promise.all(jobs);
  }

  async function animatePlayedCards() {
    if (scale() === 0) return;
    const nodes = [...document.querySelectorAll(".da-played-cards .da-card")];
    await Promise.all(nodes.map((node, index) => animate(node, [
      { transform: "translateY(30px) scale(.82) rotate(-4deg)", opacity: 0 },
      { transform: "translateY(-5px) scale(1.035) rotate(1deg)", opacity: 1, offset: .76 },
      { transform: "translateY(0) scale(1) rotate(0deg)", opacity: 1 }
    ], { duration: 220, delay: index * 38 })));
  }

  async function animateJoker(node) {
    if (!node) return;
    play("joker");
    node.classList.remove("is-triggered");
    void node.offsetWidth;
    node.classList.add("is-triggered");
    await animate(node, [
      { transform: "translateY(0) rotate(0deg) scale(1)", filter: "brightness(1)" },
      { transform: "translateY(-8px) rotate(-2deg) scale(1.07)", filter: "brightness(1.22)", offset: .45 },
      { transform: "translateY(-2px) rotate(1deg) scale(1.025)", filter: "brightness(1.08)", offset: .75 },
      { transform: "translateY(0) rotate(0deg) scale(1)", filter: "brightness(1)" }
    ], { duration: 235 });
  }

  async function countScore(span, target, ms) {
    if (!span) return;
    if (scale() === 0) {
      span.textContent = `+${formatNumber(target)} pts`;
      return;
    }
    const total = duration(ms);
    const start = performance.now();
    await new Promise(resolve => {
      const tick = now => {
        const p = clamp((now - start) / total, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        span.textContent = `+${formatNumber(target * eased)} pts`;
        if (p < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }


  async function animateScoreBurst(result = {}) {
    const zone = document.querySelector(".da-table-zone");
    if (!zone || scale() === 0) return;
    const totalMult = Number(result.mult || 0) * Number(result.xMult || 1);
    const big = Number(result.score || 0) >= 5000 || totalMult >= 20;
    const burst = document.createElement("div");
    burst.className = `da-score-burst ${big ? "is-big" : ""}`;
    burst.innerHTML = `<small>${String(result.name || "Main")}</small><strong>+${formatNumber(result.score || 0)}</strong><span>${formatNumber(result.chips || 0)} × ${formatNumber(result.mult || 0)}${Number(result.xMult || 1) !== 1 ? ` × X${Number(result.xMult || 1)}` : ""}</span>`;
    zone.appendChild(burst);
    play(big ? "scoreBig" : "score", { gain: big ? 1 : .9 });
    await animate(burst, [
      { transform: "translate(-50%, -38%) scale(.72)", opacity: 0, filter: "blur(4px)" },
      { transform: "translate(-50%, -52%) scale(1.08)", opacity: 1, filter: "blur(0px)", offset: .48 },
      { transform: "translate(-50%, -56%) scale(1)", opacity: 1, filter: "blur(0px)", offset: .74 },
      { transform: "translate(-50%, -66%) scale(.96)", opacity: 0, filter: "blur(1px)" }
    ], { duration: big ? 430 : 320, easing: "cubic-bezier(.16,.9,.24,1)" });
    burst.remove();
  }

  async function animateScoreResult(result = {}) {
    const title = document.querySelector(".da-table-result-title");
    const scoreSpan = title?.querySelector("span");
    const scoreCard = document.querySelector(".da-score-card");
    const totalMult = Number(result.mult || 0) * Number(result.xMult || 1);
    const big = Number(result.score || 0) >= 5000 || totalMult >= 20;

    await animatePlayedCards();
    if (title) await animate(title, [
      { transform: "translateY(10px) scale(.96)", opacity: 0 },
      { transform: "translateY(-2px) scale(1.02)", opacity: 1, offset: .72 },
      { transform: "translateY(0) scale(1)", opacity: 1 }
    ], { duration: 200 });

    await countScore(scoreSpan, Number(result.score || 0), big ? 560 : 360);
    await animate(scoreCard, big ? [
      { transform: "scale(1)", filter: "brightness(1)" },
      { transform: "scale(1.055)", filter: "brightness(1.25)", offset: .45 },
      { transform: "scale(1)", filter: "brightness(1)" }
    ] : [
      { transform: "scale(1)" },
      { transform: "scale(1.025)", offset: .5 },
      { transform: "scale(1)" }
    ], { duration: big ? 320 : 190 });
  }

  async function animateBossReveal() {
    play("boss");
    const card = document.querySelector(".da-blind-card.is-boss");
    const field = document.querySelector(".da-playfield");
    const empty = document.querySelector(".da-empty-table");
    await Promise.all([
      animate(card, [
        { transform: "translateX(-18px) scale(.95)", opacity: .2, filter: "brightness(.7)" },
        { transform: "translateX(4px) scale(1.045)", opacity: 1, filter: "brightness(1.28)", offset: .65 },
        { transform: "translateX(0) scale(1)", opacity: 1, filter: "brightness(1)" }
      ], { duration: 520 }),
      animate(field, [
        { filter: "brightness(.78) saturate(.8)" },
        { filter: "brightness(1.14) saturate(1.22)", offset: .55 },
        { filter: "brightness(1) saturate(1)" }
      ], { duration: 620 }),
      animate(empty, [
        { transform: "scale(.93)", opacity: .25 },
        { transform: "scale(1.025)", opacity: 1, offset: .7 },
        { transform: "scale(1)", opacity: 1 }
      ], { duration: 560 })
    ]);
  }

  async function animateShopEnter() {
    play("shop");
    const nodes = [...document.querySelectorAll(".da-shop-offer, .da-shop-suboffer")];
    await Promise.all(nodes.map((node, index) => animate(node, [
      { transform: "translateY(18px) scale(.975)", opacity: 0 },
      { transform: "translateY(-2px) scale(1.008)", opacity: 1, offset: .78 },
      { transform: "translateY(0) scale(1)", opacity: 1 }
    ], { duration: 225, delay: index * 32 })));
  }

  async function animateBoosterOpen() {
    play("booster");
    const modal = document.querySelector(".da-booster-modal");
    const choices = [...document.querySelectorAll(".da-booster-choice")];
    await animate(modal, [
      { transform: "scale(.9) rotateX(8deg)", opacity: 0 },
      { transform: "scale(1.02) rotateX(0deg)", opacity: 1, offset: .72 },
      { transform: "scale(1)", opacity: 1 }
    ], { duration: 310 });
    await Promise.all(choices.map((node, index) => animate(node, [
      { transform: "rotateY(82deg) scale(.92)", opacity: .1 },
      { transform: "rotateY(-5deg) scale(1.02)", opacity: 1, offset: .72 },
      { transform: "rotateY(0deg) scale(1)", opacity: 1 }
    ], { duration: 300, delay: index * 90 })));
  }

  async function animateBoosterChoice(node) {
    if (!node) return;
    await animate(node, [
      { transform: "scale(1) rotate(0deg)", filter: "brightness(1)" },
      { transform: "scale(1.08) rotate(-1deg)", filter: "brightness(1.28)", offset: .55 },
      { transform: "scale(.92) rotate(1deg)", filter: "brightness(.9)" }
    ], { duration: 180 });
  }

  async function animateEndState(status = "won") {
    const card = document.querySelector(".da-end-card");
    if (!card) return;
    play(status === "lost" ? "defeat" : "blindWin");
    await animate(card, [
      { transform: "translateY(22px) scale(.93)", opacity: 0 },
      { transform: "translateY(-4px) scale(1.025)", opacity: 1, offset: .72 },
      { transform: "translateY(0) scale(1)", opacity: 1 }
    ], { duration: status === "lost" ? 420 : 340 });
  }

  async function animateNotice() {
    const nodes = [...document.querySelectorAll(".da-notice")];
    const node = nodes[nodes.length - 1];
    if (!node) return;
    await animate(node, [
      { transform: "translateX(18px) scale(.98)", opacity: 0 },
      { transform: "translateX(-2px) scale(1.01)", opacity: 1, offset: .72 },
      { transform: "translateX(0) scale(1)", opacity: 1 }
    ], { duration: 210 });
  }

  async function animateMagicTarget() {
    play("magic");
    const card = document.querySelector(".da-modal-card");
    await animate(card, [
      { transform: "scale(1)", filter: "brightness(1)" },
      { transform: "scale(1.025)", filter: "brightness(1.28)", offset: .5 },
      { transform: "scale(1)", filter: "brightness(1)" }
    ], { duration: 260 });
  }

  return {
    play,
    stopAll,
    mode,
    animateCardSelection,
    animateCardCommit,
    animateIncomingCards,
    animateJoker,
    animateScoreBurst,
    animateScoreResult,
    animateBossReveal,
    animateShopEnter,
    animateBoosterOpen,
    animateBoosterChoice,
    animateEndState,
    animateNotice,
    animateMagicTarget,
    wait: ms => sleep(duration(ms))
  };
}
