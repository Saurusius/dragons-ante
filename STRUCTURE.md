# Dragon's Ante — Structure v0.5.5

```text
dragons-ante/
├─ module.json
├─ scripts/
│  ├─ main.js                 # orchestration / rendu principal
│  ├─ core/
│  │  └─ assets.js            # registre central des chemins médias
│  ├─ engines/                # règles, état de jeu et économie
│  ├─ data/                   # définitions JS des contenus
│  ├─ ui/                     # launcher et futurs contrôleurs UI
│  └─ fx/                     # son, animation et juice runtime
├─ styles/
│  ├─ dragons-ante.css        # interface principale
│  └─ fx.css                  # couche dédiée aux effets/animations
├─ assets/
│  ├─ images/
│  │  ├─ backgrounds/
│  │  ├─ branding/
│  │  ├─ ui/
│  │  ├─ cards/
│  │  │  ├─ backs/
│  │  │  ├─ faces/
│  │  │  └─ suits/
│  │  ├─ atouts/{common,uncommon,rare,unique}/
│  │  ├─ jokers/{common,uncommon,rare,unique}/
│  │  ├─ boosters/{classic,rare,premium}/
│  │  ├─ bosses/
│  │  └─ effects/
│  ├─ animations/
│  │  ├─ cards/
│  │  ├─ atouts/
│  │  ├─ boosters/
│  │  ├─ score/
│  │  └─ ui/
│  └─ audio/
│     ├─ music/
│     └─ sfx/{cards,score,gameplay,ui}/
├─ data/
├─ tests/                     # tests de non-régression Node
├─ lang/
└─ install-local.ps1
```

## Convention conseillée
- Images statiques : `.webp` de préférence pour les nouveaux assets, `.png` si transparence/qualité l'exige.
- Animations courtes : `.webm` ou Web Animations API selon l'effet.
- SFX : `.ogg`.
- Musiques : `.mp3` ou `.ogg` selon la source.
- Tous les chemins utilisés depuis JavaScript doivent être ajoutés dans `scripts/core/assets.js` plutôt que dispersés dans les moteurs.

## Règle importante
Les moteurs de gameplay ne devraient pas connaître directement les fichiers médias. Ils exposent l'événement de jeu ; `scripts/fx/juice-engine.js` décide ensuite quel son ou quelle animation jouer. Cela permettra de remplacer facilement un asset sans modifier les règles.


## Convention des illustrations d’Atouts
Le runtime cherche automatiquement l’illustration de chaque Atout dans `assets/images/jokers/` avec le format :

`{rareté}/{numéro sur 3 chiffres}-{id}.webp`

Exemples : `common/001-joker.webp`, `uncommon/017-joker-stencil.webp`, `unique/150-perkeo.webp`.
Tant que le fichier n’existe pas, l’interface affiche automatiquement un glyphe de rareté ; aucun asset manquant ne casse l’affichage.
