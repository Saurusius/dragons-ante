# 🐉 Dragon's Ante

**Dragon's Ante** est un mini-jeu de cartes pour **Foundry Virtual Tabletop**, inspiré des mécaniques de score, de combos et de progression roguelite de *Balatro*, avec une identité visuelle et des références adaptées à l'univers de **Pathfinder**.

Le principe : construire les meilleures combinaisons possibles, exploiter ses **Atouts**, faire grimper son score et accumuler des **pièces d'or** au fil des parties.

> Projet en développement actif.

---

## ✨ Fonctionnalités

- Interface de jeu plein écran intégrée à Foundry VTT
- Système de mains, combinaisons et multiplicateurs de score
- **Atouts** aux effets variés et aux raretés distinctes
- Atouts inspirés de personnages, créatures et archétypes de Pathfinder
- Économie en **pièces d'or**
- Scoreboard et suivi des performances
- Effets visuels, animations et confettis
- Ambiance sonore et effets audio
- Interface pensée pour être jouée directement depuis une partie Foundry
- Support de plusieurs raretés d'Atouts

Dragon's Ante est encore en évolution : de nouveaux Atouts, mécaniques et raffinements d'interface viendront enrichir le module au fil des versions.

---

## 📦 Installation

### Depuis Foundry VTT

Dans **Add-on Modules → Install Module**, utilisez l'URL du manifeste :

```text
https://github.com/Saurusius/dragons-ante/releases/latest/download/module.json
```

### Installation manuelle

1. Téléchargez l'archive `dragons-ante-vX.Y.Z.zip` depuis la page **Releases** du dépôt.
2. Extrayez le dossier `dragons-ante` dans :

```text
FoundryVTT/Data/modules/
```

3. Redémarrez Foundry VTT.
4. Activez **Dragon's Ante** dans les modules de votre monde.

---

## 🎮 Utilisation

Une fois le module activé, Dragon's Ante ajoute son interface de jeu directement dans Foundry VTT.

L'objectif est simple : exploiter les cartes distribuées, construire des combinaisons efficaces et utiliser les Atouts au bon moment pour pousser le score toujours plus haut.

Certaines mécaniques, valeurs et interfaces peuvent encore évoluer pendant la phase de développement.

---

## 🌿 Branches du dépôt

Le projet utilise une organisation volontairement simple :

| Branche | Rôle |
| --- | --- |
| `dev` | Développement courant et versions en cours de test |
| `master` | Version stable destinée aux releases publiques |

Les changements sont développés et validés sur `dev`, puis promus vers `master` avant publication.

---

## 🚀 Publication des versions

Le dépôt utilise GitHub Actions pour automatiser la validation et la publication :

- **Dev checks** : vérifie automatiquement le manifeste et la syntaxe JavaScript sur `dev`.
- **Promote dev to master** : promeut manuellement une version validée de `dev` vers `master`.
- **Publish Release** : construit l'archive Foundry et publie la release GitHub à partir de `master`.

Le numéro de version publié est lu directement depuis `module.json`.

---

## 🛠️ Développement

Le code du module est maintenu ici :

```text
https://github.com/Saurusius/dragons-ante
```

Pour contribuer ou tester une version en développement :

```bash
git clone https://github.com/Saurusius/dragons-ante.git
cd dragons-ante
git checkout dev
```

---

## 🐲 À propos

Dragon's Ante est un projet communautaire non officiel conçu pour Foundry Virtual Tabletop.

Les références à **Pathfinder** et à son univers appartiennent à leurs ayants droit respectifs.  
**Foundry Virtual Tabletop** est une marque de Foundry Gaming LLC.

Ce projet n'est ni affilié ni officiellement approuvé par Paizo Inc. ou Foundry Gaming LLC.

---

## 📜 Changelog

L'historique détaillé des modifications est disponible dans [CHANGELOG.md](./CHANGELOG.md) lorsque celui-ci est présent dans la branche publiée.
