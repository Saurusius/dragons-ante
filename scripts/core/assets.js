export const MODULE_ID = "dragons-ante";
export const MODULE_VERSION = "0.5.3";
export const ASSET_ROOT = `modules/${MODULE_ID}/assets`;

export function assetUrl(relativePath) {
  return `${ASSET_ROOT}/${String(relativePath).replace(/^\/+/, "")}`;
}


export function jokerArtUrl(joker) {
  const rarityFolder = joker?.rarity === "legendary" ? "unique" : (joker?.rarity || "common");
  const number = String(Number(joker?.number || 0)).padStart(3, "0");
  const id = String(joker?.id || "joker").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `${assetUrl(`images/jokers/${rarityFolder}/${number}-${id}.webp`)}?v=${MODULE_VERSION}`;
}

export const ASSETS = Object.freeze({
  images: Object.freeze({
    backgrounds: Object.freeze({
      home: assetUrl("images/backgrounds/home-bg.png")
    }),
    branding: Object.freeze({
      title: assetUrl("images/branding/home-title.png")
    }),
    ui: Object.freeze({
      coin: assetUrl("images/ui/currency/coin-dragon.png")
    }),
    suits: Object.freeze({
      spade: assetUrl("images/cards/suits/spade-icon.png")
    })
  }),
  audio: Object.freeze({
    music: Object.freeze({
      home: assetUrl("audio/music/theme-home.mp3"),
      game: assetUrl("audio/music/theme-game.mp3")
    }),
    sfx: Object.freeze({
      select: assetUrl("audio/sfx/cards/card-select.ogg"),
      deal: assetUrl("audio/sfx/cards/card-deal.ogg"),
      play: assetUrl("audio/sfx/cards/card-play.ogg"),
      discard: assetUrl("audio/sfx/cards/card-discard.ogg"),
      score: assetUrl("audio/sfx/score/score-tick.ogg"),
      scoreBig: assetUrl("audio/sfx/score/score-big.ogg"),
      blindWin: assetUrl("audio/sfx/gameplay/blind-win.ogg"),
      boss: assetUrl("audio/sfx/gameplay/boss-reveal.ogg"),
      defeat: assetUrl("audio/sfx/gameplay/defeat.ogg"),
      joker: assetUrl("audio/sfx/gameplay/joker-trigger.ogg"),
      magic: assetUrl("audio/sfx/gameplay/magic.ogg"),
      unlock: assetUrl("audio/sfx/gameplay/unlock.ogg"),
      booster: assetUrl("audio/sfx/ui/booster-open.ogg"),
      coin: assetUrl("audio/sfx/ui/coin.ogg"),
      shop: assetUrl("audio/sfx/ui/shop-enter.ogg")
    })
  })
});
