import { JOKERS, JOKER_MAP } from "../data/jokers-data.js";
import { HANDS, drawToHand, clonePlayingCard, randomPlayingCard, evaluateHand } from "./poker-engine.js";
import { grantRandomConsumable } from "./deck-engine.js";
import { sellValue } from "./economy-engine.js";

const MAX_JOKERS = 5;
const SUITS = ["spades", "hearts", "diamonds", "clubs"];
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

export { JOKERS, JOKER_MAP, MAX_JOKERS };

export function ensureJokerState(state) {
  state.jokers ??= [];
  state.jokerState ??= {};
  state.money ??= 4;
  state.handLevels ??= {};
  state.runHandCounts ??= {};
  state.runHandsPlayed ??= 0;
  state.roundHandCounts ??= {};
  state.roundsCompleted ??= 0;
  state.startingDeckSize ??= 52;
  state.cardsAdded ??= 0;
  state.cardsDestroyed ??= 0;
  state.discardedCardCount ??= 0;
  state.blindsSkipped ??= 0;
  state.planetsUsed ??= 0;
  state.tarotsUsed ??= 0;
  state.boostersSkipped ??= 0;
  state.shopRerolls ??= 0;
  state.inventory ??= { arcanes: [], constellations: [], presages: [] };
  state.globalSellBonus ??= 0;
  state.targetHand ??= randomChoice(["pair","two-pair","three-kind","straight","flush"]);
  state.targetRank ??= randomChoice(RANKS);
  state.targetSuit ??= randomChoice(SUITS);
  state.idolRank ??= randomChoice(RANKS);
  state.idolSuit ??= randomChoice(SUITS);
  state.ancientSuit ??= randomChoice(SUITS);
  state.castleSuit ??= randomChoice(SUITS);

  for (const id of state.jokers) getState(state,id);
  return state;
}

function randomChoice(arr, random=Math.random) { return arr[Math.floor(random()*arr.length)]; }
function chance(state, numerator, denominator, random=Math.random) {
  const doubled = hasJoker(state,"oops-all-sixes") ? 2 : 1;
  return random() < Math.min(1, (numerator*doubled)/denominator);
}
function hasJoker(state,id) { return state.jokers?.includes(id); }
function getState(state,id) { return state.jokerState[id] ??= {}; }
function isFace(card,state) { return hasJoker(state,"pareidolia") || ["J","Q","K"].includes(card.rank); }
function allCards(state) { return [...state.hand,...state.drawPile,...state.played,...state.discarded]; }
function cardsInFullDeck(state) { return allCards(state); }
function activeDefs(state) { return (state.jokers||[]).map(id=>JOKER_MAP.get(id)).filter(Boolean); }

function effectiveJokerId(state,index,seen=new Set()) {
  const id=state.jokers[index];
  if (!id || seen.has(index)) return null;
  seen.add(index);
  if (id === "blueprint") return effectiveJokerId(state,index+1,seen);
  if (id === "brainstorm") return effectiveJokerId(state,0,seen);
  return id;
}

function forEachEffective(state, callback) {
  for (let i=0;i<(state.jokers||[]).length;i++) {
    const sourceId=effectiveJokerId(state,i);
    if (!sourceId) continue;
    callback(sourceId, i, state.jokers[i]);
  }
}

export function getEvaluationOptions(state) {
  ensureJokerState(state);
  return {
    fourFingers: hasJoker(state,"four-fingers"),
    shortcut: hasJoker(state,"shortcut"),
    smeared: hasJoker(state,"smeared-joker"),
    splash: hasJoker(state,"splash")
  };
}

export function equipJoker(state,id) {
  ensureJokerState(state);
  if (!JOKER_MAP.has(id)) return false;
  if (state.jokers.includes(id)) return false;
  if (state.jokers.length >= MAX_JOKERS) return false;
  state.jokers.push(id);
  getState(state,id);
  return true;
}

export function removeJoker(state,id) {
  const index=state.jokers.indexOf(id);
  if (index<0) return false;
  state.jokers.splice(index,1);
  if (state.jokerState) delete state.jokerState[id];
  return true;
}

export function moveJoker(state,id,direction) {
  const index=state.jokers.indexOf(id);
  const to=index+direction;
  if (index<0 || to<0 || to>=state.jokers.length) return false;
  [state.jokers[index],state.jokers[to]]=[state.jokers[to],state.jokers[index]];
  return true;
}

export function fillRandomJokers(state,count=5) {
  ensureJokerState(state);
  const pool=JOKERS.filter(j=>j.status==="live" && !state.jokers.includes(j.id));
  while (state.jokers.length < Math.min(MAX_JOKERS,count) && pool.length) {
    const i=Math.floor(Math.random()*pool.length);
    equipJoker(state,pool.splice(i,1)[0].id);
  }
}

export function prepareRound(state) {
  ensureJokerState(state);
  state.status="playing";
  state.roundSettled=false;
  state.roundHandsPlayed=0;
  state.roundDiscardsUsed=0;
  state.roundHandCounts={};
  state.targetHand=randomChoice(["pair","two-pair","three-kind","straight","flush"]);
  state.targetRank=randomChoice(RANKS);
  state.targetSuit=randomChoice(SUITS);
  state.idolRank=randomChoice(RANKS);
  state.idolSuit=randomChoice(SUITS);
  state.ancientSuit=randomChoice(SUITS);
  state.castleSuit=randomChoice(SUITS);

  state.handSize=state.baseHandSize ?? 8;
  state.handsRemaining=state.baseHands ?? 4;
  state.discardsRemaining=state.baseDiscards ?? 3;

  // Structural effects.
  if (hasJoker(state,"juggler")) state.handSize += 1;
  if (hasJoker(state,"turtle-bean")) {
    const js=getState(state,"turtle-bean");
    js.bonus ??= 5;
    state.handSize += Math.max(0,js.bonus);
  }
  if (hasJoker(state,"troubadour")) { state.handSize += 2; state.handsRemaining=Math.max(1,state.handsRemaining-1); }
  if (hasJoker(state,"merry-andy")) { state.handSize=Math.max(1,state.handSize-1); state.discardsRemaining += 3; }
  if (hasJoker(state,"stuntman")) state.handSize=Math.max(1,state.handSize-2);
  if (hasJoker(state,"drunkard")) state.discardsRemaining += 1;
  if (hasJoker(state,"burglar")) { state.handsRemaining += 3; state.discardsRemaining=0; }

  // Blind-select-like effects supported by current prototype.
  if (hasJoker(state,"marble-joker")) {
    const card=randomPlayingCard();
    card.enhancement="stone"; card.chips=50;
    state.drawPile.push(card); state.cardsAdded += 1;
    onCardAdded(state);
  }
  if (hasJoker(state,"certificate")) {
    const card=randomPlayingCard();
    card.seal=randomChoice(["blood","astral","merchant","occult"]);
    state.hand.push(card); state.cardsAdded += 1;
    onCardAdded(state);
  }
  if (hasJoker(state,"cartomancer")) grantRandomConsumable(state, "arcanes");
  if (hasJoker(state,"madness") && state.jokers.length>1) {
    const js=getState(state,"madness"); js.xmult=(js.xmult ?? 1)+0.5;
    const candidates=state.jokers.filter(id=>id!=="madness");
    if (candidates.length) removeJoker(state,randomChoice(candidates));
  }
  if (hasJoker(state,"riff-raff")) {
    const commons=JOKERS.filter(j=>j.rarity==="common" && j.status==="live" && !state.jokers.includes(j.id));
    for (let n=0;n<2 && state.jokers.length<MAX_JOKERS && commons.length;n++) {
      const i=Math.floor(Math.random()*commons.length); equipJoker(state,commons.splice(i,1)[0].id);
    }
  }

  drawToHand(state);
  return state;
}

function onCardAdded(state) {
  if (hasJoker(state,"hologram")) {
    const js=getState(state,"hologram"); js.xmult=(js.xmult ?? 1)+0.25;
  }
}

function handLevelBonus(state,key) {
  const level=Math.max(1, state.handLevels?.[key] ?? 1);
  if (level<=1) return { chips:0,mult:0,level };
  // Generic progression for prototype; exact planet curves can replace this later.
  return { chips:(level-1)*10, mult:(level-1), level };
}

export function scoreWithJokers({ state, cards, baseResult, preview=false }) {
  ensureJokerState(state);
  const rng=preview ? (()=>0.499999) : Math.random;
  const scoringIds=new Set(baseResult.scoringCardIds);
  const scoringCards=cards.filter(c=>scoringIds.has(c.id));
  const held=state.hand;
  const lvl=handLevelBonus(state,baseResult.key);
  let chips=baseResult.baseChips+lvl.chips;
  let mult=baseResult.baseMult+lvl.mult;
  let xmult=1;
  let moneyGain=0;
  const effects=[];
  const usedJokers = new Set();
  const markUsed = (id) => { if (!preview) usedJokers.add(id); };

  const addEffect=(name,text)=>{ if(!preview) effects.push({name,text}); };
  const contains=(tag)=>baseResult.tags.includes(tag);

  function cardTrigger(card, repeated=false) {
    chips += Number(card.chips||0) + Number(card.bonusChips||0);
    if (card.enhancement === "stone") chips += 50;
    if (card.enhancement === "gold" && hasJoker(state,"golden-ticket")) {
      moneyGain += 4;
      markUsed("golden-ticket");
    }
    if (card.edition === "gilded") chips += 15;
    if (card.edition === "runic") mult += 2;
    if (card.edition === "prismatic") xmult *= 1.25;
    if (card.seal === "astral") mult += 1;
    if (card.seal === "merchant" && !preview) moneyGain += 1;

    forEachEffective(state,(id,slot,originalId)=>{
      const before = { chips, mult, xmult, moneyGain };
      switch(id) {
        case "greedy-joker": if(card.suit==="diamonds") mult+=3; break;
        case "lusty-joker": if(card.suit==="hearts") mult+=3; break;
        case "wrathful-joker": if(card.suit==="spades") mult+=3; break;
        case "gluttonous-joker": if(card.suit==="clubs") mult+=3; break;
        case "fibonacci": if(["A","2","3","5","8"].includes(card.rank)) mult+=8; break;
        case "eight-ball":
          if (!preview && card.rank==="8" && chance(state,1,4,rng) && grantRandomConsumable(state,"arcanes",rng)) markUsed(originalId);
          break;
        case "scary-face": if(isFace(card,state)) chips+=30; break;
        case "even-steven": if([2,4,6,8,10].includes(card.rankOrder)) mult+=4; break;
        case "odd-todd": if([14,9,7,5,3].includes(card.rankOrder)) chips+=31; break;
        case "scholar": if(card.rank==="A"){ chips+=20; mult+=4; } break;
        case "business-card": if(!preview && isFace(card,state) && chance(state,1,2,rng)) moneyGain+=2; break;
        case "walkie-talkie": if(["10","4"].includes(card.rank)){ chips+=10; mult+=4; } break;
        case "smiley-face": if(isFace(card,state)) mult+=5; break;
        case "rough-gem": if(card.suit==="diamonds") moneyGain+=1; break;
        case "bloodstone": if(card.suit==="hearts" && chance(state,1,2,rng)) xmult*=1.5; break;
        case "arrowhead": if(card.suit==="spades") chips+=50; break;
        case "onyx-agate": if(card.suit==="clubs") mult+=7; break;
        case "triboulet": if(["K","Q"].includes(card.rank)) xmult*=2; break;
        case "photograph": {
          const js=getState(state,"photograph");
          if(isFace(card,state) && !js._usedThisHand){ xmult*=2; js._usedThisHand=true; }
          break;
        }
        case "ancient-joker": if(card.suit===state.ancientSuit) xmult*=1.5; break;
        case "the-idol": if(card.suit===state.idolSuit && card.rank===state.idolRank) xmult*=2; break;
        case "wee-joker": if(card.rank==="2") chips += Number(getState(state,"wee-joker").chips||0); break;
      }
      if (chips !== before.chips || mult !== before.mult || xmult !== before.xmult || moneyGain !== before.moneyGain) {
        markUsed(originalId);
      }
    });
  }

  // Clear per-hand flags.
  getState(state,"photograph")._usedThisHand=false;

  for (let index=0; index<scoringCards.length; index++) {
    const card=scoringCards[index];
    let triggers=1;
    if (hasJoker(state,"hack") && ["2","3","4","5"].includes(card.rank)) { triggers++; markUsed("hack"); }
    if (hasJoker(state,"sock-and-buskin") && isFace(card,state)) { triggers++; markUsed("sock-and-buskin"); }
    if (hasJoker(state,"dusk") && state.handsRemaining===1) { triggers++; markUsed("dusk"); }
    if (hasJoker(state,"seltzer") && (getState(state,"seltzer").handsLeft ?? 10)>0) { triggers++; markUsed("seltzer"); }
    if (hasJoker(state,"hanging-chad") && index===0) { triggers+=2; markUsed("hanging-chad"); }
    if (card.seal === "blood") triggers += 1;
    for(let t=0;t<triggers;t++) cardTrigger(card,t>0);
  }

  // Independent / hand-level effects.
  forEachEffective(state,(id,slot,originalId)=>{
    const before = { chips, mult, xmult, moneyGain };
    const js=getState(state,id);
    switch(id) {
      case "joker": mult+=4; break;
      case "jolly-joker": if(contains("pair")) mult+=8; break;
      case "zany-joker": if(contains("three-kind")) mult+=12; break;
      case "mad-joker": if(contains("two-pair")) mult+=10; break;
      case "crazy-joker": if(contains("straight")) mult+=12; break;
      case "droll-joker": if(contains("flush")) mult+=10; break;
      case "sly-joker": if(contains("pair")) chips+=50; break;
      case "wily-joker": if(contains("three-kind")) chips+=100; break;
      case "clever-joker": if(contains("two-pair")) chips+=80; break;
      case "devious-joker": if(contains("straight")) chips+=100; break;
      case "crafty-joker": if(contains("flush")) chips+=80; break;
      case "half-joker": if(cards.length<=3) mult+=20; break;
      case "joker-stencil": xmult*=Math.max(1,MAX_JOKERS-state.jokers.length+1); break;
      case "banner": chips+=30*state.discardsRemaining; break;
      case "mystic-summit": if(state.discardsRemaining===0) mult+=15; break;
      case "loyalty-card": if(((state.runHandsPlayed||0)+1)%6===0) xmult*=4; break;
      case "misprint": mult+=preview ? 12 : Math.floor(rng()*24); break;
      case "raised-fist": if(held.length) mult+=2*Math.min(...held.map(c=>c.rankOrder)); break;
      case "steel-joker": xmult*=1+0.2*cardsInFullDeck(state).filter(c=>c.enhancement==="steel").length; break;
      case "abstract-joker": mult+=3*state.jokers.length; break;
      case "supernova": mult+=(state.runHandCounts[baseResult.key]||0)+1; break;
      case "ride-the-bus": mult+=Number(js.mult||0); break;
      case "blackboard": if(held.length && held.every(c=>["spades","clubs"].includes(c.suit))) xmult*=3; break;
      case "runner": chips+=Number(js.chips||0); break;
      case "ice-cream": chips+=Math.max(0, js.chips ?? 100); break;
      case "blue-joker": chips+=2*state.drawPile.length; break;
      case "green-joker": mult+=Math.max(0,Number(js.mult||0)); break;
      case "flash-card": mult+=Math.max(0,Number(js.mult||0)); break;
      case "campfire": xmult*=Math.max(1,Number(js.xmult||1)); break;
      case "cavendish": xmult*=3; break;
      case "card-sharp": if((state.roundHandCounts[baseResult.key]||0)>0) xmult*=3; break;
      case "madness": xmult*=Number(js.xmult||1); break;
      case "square-joker": chips+=Number(js.chips||0); break;
      case "vampire": xmult*=Number(js.xmult||1); break;
      case "hologram": xmult*=Number(js.xmult||1); break;
      case "baron": held.filter(c=>c.rank==="K").forEach(()=>xmult*=1.5); break;
      case "obelisk": xmult*=Number(js.xmult||1); break;
      case "erosion": mult+=4*Math.max(0,(state.startingDeckSize||52)-cardsInFullDeck(state).length); break;
      case "stone-joker": chips+=25*cardsInFullDeck(state).filter(c=>c.enhancement==="stone").length; break;
      case "baseball-card": {
        const count=activeDefs(state).filter(j=>j.rarity==="uncommon").length;
        for(let i=0;i<count;i++) xmult*=1.5;
        break;
      }
      case "bull": chips+=2*Math.max(0,state.money||0); break;
      case "popcorn": mult+=Math.max(0,js.mult ?? 20); break;
      case "spare-trousers": mult+=Number(js.mult||0); break;
      case "ramen": xmult*=Math.max(1,js.xmult ?? 2); break;
      case "castle": chips+=Number(js.chips||0); break;
      case "flower-pot": if(new Set(cards.map(c=>c.suit)).size===4) xmult*=3; break;
      case "the-duo": if(contains("pair")) xmult*=2; break;
      case "the-trio": if(contains("three-kind")) xmult*=3; break;
      case "the-family": if(contains("four-kind")) xmult*=4; break;
      case "the-order": if(contains("straight")) xmult*=3; break;
      case "the-tribe": if(contains("flush")) xmult*=2; break;
      case "stuntman": chips+=250; break;
      case "shoot-the-moon": held.filter(c=>c.rank==="Q").forEach(()=>mult+=13); break;
      case "drivers-license": if(cardsInFullDeck(state).filter(c=>c.enhancement).length>=16) xmult*=3; break;
      case "bootstraps": mult+=2*Math.floor(Math.max(0,state.money||0)/5); break;
      case "yorick": xmult*=Number(js.xmult||1); break;
      case "acrobat": if(state.handsRemaining===1) xmult*=3; break;
      case "swashbuckler": {
        const others=state.jokers.filter((_id,index)=>index!==slot);
        mult+=others.reduce((sum,jokerId)=>sum+sellValue(state,jokerId),0);
        break;
      }
      case "seeing-double": {
        const suits=new Set(scoringCards.map(c=>c.suit));
        if(suits.has("clubs") && [...suits].some(s=>s!=="clubs")) xmult*=2;
        break;
      }
      case "hit-the-road": xmult*=Number(js.xmult||1); break;
    }
    if (chips !== before.chips || mult !== before.mult || xmult !== before.xmult || moneyGain !== before.moneyGain) {
      markUsed(originalId);
    }
  });

  // Held-card money effects; Mime doubles held triggers.
  const heldRepeats=hasJoker(state,"mime") ? 2 : 1;
  for(let pass=0;pass<heldRepeats;pass++) {
    if(hasJoker(state,"reserved-parking") && !preview) {
      const beforeMoney = moneyGain;
      for(const card of held) if(isFace(card,state) && chance(state,1,2,rng)) moneyGain+=1;
      if (moneyGain > beforeMoney) {
        markUsed("reserved-parking");
        if (pass > 0 && hasJoker(state,"mime")) markUsed("mime");
      }
    }
  }

  const score=Math.max(0,Math.floor(chips*Math.max(0,mult)*xmult));
  if (!preview) state.money += moneyGain;

  return {
    ...baseResult,
    chips: Math.floor(chips),
    mult: Number(mult.toFixed(2)),
    xMult: Number(xmult.toFixed(4)),
    score,
    moneyGain,
    effects,
    handLevel:lvl.level,
    usedJokers: [...usedJokers]
  };
}

export function afterPlay({state,cards,result,baseResult}) {
  ensureJokerState(state);
  state.runHandsPlayed += 1;
  state.runHandCounts[baseResult.key]=(state.runHandCounts[baseResult.key]||0)+1;
  state.roundHandCounts[baseResult.key]=(state.roundHandCounts[baseResult.key]||0)+1;
  const markUsed = id => {
    result.usedJokers ??= [];
    if (!result.usedJokers.includes(id)) result.usedJokers.push(id);
  };

  const scored = cards.filter(c=>result.scoringCardIds.includes(c.id));
  const scoringFace=scored.some(c=>isFace(c,state));
  const bus=getState(state,"ride-the-bus");
  if(hasJoker(state,"ride-the-bus")) {
    const before=Number(bus.mult||0);
    bus.mult=scoringFace ? 0 : before+1;
    if (bus.mult !== before) markUsed("ride-the-bus");
  }

  if(hasJoker(state,"runner") && baseResult.tags.includes("straight")) {
    const js=getState(state,"runner"); js.chips=(js.chips||0)+15; markUsed("runner");
  }
  if(hasJoker(state,"green-joker")) {
    const js=getState(state,"green-joker"); js.mult=(js.mult||0)+1; markUsed("green-joker");
  }
  if(hasJoker(state,"square-joker") && cards.length===4) {
    const js=getState(state,"square-joker"); js.chips=(js.chips||0)+4; markUsed("square-joker");
  }
  if(hasJoker(state,"spare-trousers") && baseResult.tags.includes("two-pair")) {
    const js=getState(state,"spare-trousers"); js.mult=(js.mult||0)+2; markUsed("spare-trousers");
  }
  if(hasJoker(state,"space-joker") && chance(state,1,4)) {
    state.handLevels[baseResult.key]=(state.handLevels[baseResult.key]||1)+1;
    markUsed("space-joker");
  }
  if(hasJoker(state,"hiker") && scored.length) {
    for(const card of scored) card.bonusChips=(card.bonusChips||0)+5;
    markUsed("hiker");
  }
  if(hasJoker(state,"wee-joker") && scored.some(c=>c.rank==="2")) {
    const count=scored.filter(c=>c.rank==="2").length;
    const js=getState(state,"wee-joker"); js.chips=(js.chips||0)+8*count; markUsed("wee-joker");
  }
  if(hasJoker(state,"dna") && state.roundHandsPlayed===1 && cards.length===1) {
    const copy=clonePlayingCard(cards[0],`${Date.now()}-dna`); state.drawPile.unshift(copy); state.cardsAdded+=1; onCardAdded(state); markUsed("dna");
  }
  if(hasJoker(state,"sixth-sense") && state.roundHandsPlayed===1 && cards.length===1 && cards[0].rank==="6") {
    // Remove original from played pile: it is destroyed instead.
    state.played=state.played.filter(c=>c.id!==cards[0].id);
    state.cardsDestroyed+=1;
    grantRandomConsumable(state,"presages");
    markUsed("sixth-sense");
  }
  if(hasJoker(state,"superposition") && baseResult.tags.includes("straight") && cards.some(c=>c.rank==="A")) {
    if (grantRandomConsumable(state,"arcanes")) markUsed("superposition");
  }
  if(hasJoker(state,"seance") && baseResult.key==="straight-flush") {
    if (grantRandomConsumable(state,"presages")) markUsed("seance");
  }
  if(hasJoker(state,"vagabond") && state.money<=4) {
    if (grantRandomConsumable(state,"arcanes")) markUsed("vagabond");
  }
  if(hasJoker(state,"to-do-list") && baseResult.key===state.targetHand) { state.money+=4; markUsed("to-do-list"); }
  if(hasJoker(state,"midas-mask")) {
    const faces=scored.filter(c=>isFace(c,state));
    if (faces.length) {
      for(const card of faces) card.enhancement="gold";
      markUsed("midas-mask");
    }
  }
  if(hasJoker(state,"vampire")) {
    const enhanced=scored.filter(c=>c.enhancement);
    if(enhanced.length) {
      const js=getState(state,"vampire"); js.xmult=(js.xmult||1)+0.1*enhanced.length;
      enhanced.forEach(c=>c.enhancement=null);
      markUsed("vampire");
    }
  }
  if(hasJoker(state,"lucky-cat")) {
    const lucky=scored.filter(c=>c.enhancement==="lucky" && chance(state,1,5));
    if(lucky.length){ const js=getState(state,"lucky-cat"); js.xmult=(js.xmult||1)+0.25*lucky.length; markUsed("lucky-cat"); }
  }
  if(hasJoker(state,"seltzer")) {
    const js=getState(state,"seltzer"); js.handsLeft=Math.max(0,(js.handsLeft ?? 10)-1); markUsed("seltzer");
  }
}

export function onDiscard({state,cards}) {
  ensureJokerState(state);
  state.discardedCardCount += cards.length;
  if(hasJoker(state,"faceless-joker") && cards.filter(c=>isFace(c,state)).length>=3) state.money+=5;
  if(hasJoker(state,"green-joker")) {
    const js=getState(state,"green-joker"); js.mult=Math.max(0,(js.mult||0)-1);
  }
  if(hasJoker(state,"trading-card") && state.roundDiscardsUsed===1 && cards.length===1) {
    state.discarded=state.discarded.filter(c=>c.id!==cards[0].id); state.cardsDestroyed+=1; state.money+=3;
  }
  if(hasJoker(state,"mail-in-rebate")) state.money+=5*cards.filter(c=>c.rank===state.targetRank).length;
  if(hasJoker(state,"ramen")) {
    const js=getState(state,"ramen"); js.xmult=Math.max(1,(js.xmult ?? 2)-0.01*cards.length);
  }
  if(hasJoker(state,"castle")) {
    const count=cards.filter(c=>c.suit===state.castleSuit).length;
    if(count){ const js=getState(state,"castle"); js.chips=(js.chips||0)+3*count; }
  }
  if(hasJoker(state,"hit-the-road")) {
    const count=cards.filter(c=>c.rank==="J").length;
    if(count){ const js=getState(state,"hit-the-road"); js.xmult=(js.xmult||1)+0.5*count; }
  }
  if(hasJoker(state,"yorick")) {
    const js=getState(state,"yorick"); js.discarded=(js.discarded||0)+cards.length;
    while(js.discarded>=23){ js.discarded-=23; js.xmult=(js.xmult||1)+1; }
  }
  for (const card of cards) {
    if (card.seal === "occult" && Math.random() < 0.35) {
      state.inventory ??= { arcanes: [], constellations: [], presages: [] };
      if ((state.inventory.arcanes.length + state.inventory.constellations.length + state.inventory.presages.length) < 6) {
        state.inventory.presages.push("sceau-astral");
      }
    }
  }

  if(hasJoker(state,"burnt-joker") && state.roundDiscardsUsed===1) {
    try {
      const result=evaluateHand(cards,getEvaluationOptions(state));
      state.handLevels[result.key]=(state.handLevels[result.key]||1)+1;
    } catch(_e) {}
  }
}

export function preventLoss(state) {
  if(!hasJoker(state,"mr-bones")) return false;
  if(state.score < state.target*0.25) return false;
  removeJoker(state,"mr-bones");
  return true;
}

export function settleRound(state) {
  ensureJokerState(state);
  if(state.roundSettled) return;
  state.roundSettled=true;
  state.roundsCompleted += 1;

  if(hasJoker(state,"delayed-gratification") && state.roundDiscardsUsed===0) state.money += 2*state.discardsRemaining;
  if(hasJoker(state,"cloud-nine")) state.money += cardsInFullDeck(state).filter(c=>c.rank==="9").length;
  if(hasJoker(state,"rocket")) {
    const js=getState(state,"rocket");
    js.payout ??= 1;
    state.money += js.payout;
    if(state.run?.blindIndex===2 && state.status==="won") js.payout += 2;
  }
  if(hasJoker(state,"egg")) {
    const js=getState(state,"egg");
    js.sellBonus=(js.sellBonus||0)+3;
  }
  if(hasJoker(state,"gift-card")) state.globalSellBonus=(state.globalSellBonus||0)+1;
  if(hasJoker(state,"campfire") && state.run?.blindIndex===2 && state.status==="won") {
    getState(state,"campfire").xmult=1;
  }
  if(hasJoker(state,"to-the-moon")) state.money += Math.floor(Math.max(0,state.money)/5);
  if(hasJoker(state,"golden-joker")) state.money += 4;
  if(hasJoker(state,"gros-michel") && chance(state,1,6)) removeJoker(state,"gros-michel");
  if(hasJoker(state,"cavendish") && chance(state,1,1000)) removeJoker(state,"cavendish");
  if(hasJoker(state,"popcorn")) {
    const js=getState(state,"popcorn"); js.mult=Math.max(0,(js.mult ?? 20)-4);
    if(js.mult<=0) removeJoker(state,"popcorn");
  }
  if(hasJoker(state,"turtle-bean")) {
    const js=getState(state,"turtle-bean"); js.bonus=Math.max(0,(js.bonus ?? 5)-1);
    if(js.bonus<=0) removeJoker(state,"turtle-bean");
  }
}

export function previewWithJokers(state,cards) {
  if(!cards.length) return null;
  const base=evaluateHand(cards,getEvaluationOptions(state));
  // Clone enough state so preview never mutates live joker flags/counters.
  const clone=structuredClone(state);
  ensureJokerState(clone);
  return scoreWithJokers({state:clone,cards:structuredClone(cards),baseResult:base,preview:true});
}
