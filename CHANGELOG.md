# Changelog

## 0.5.5 — Stabilisation

- Correction de l’évaluation des Suites, Couleurs et Quintes Flush avec **Four Fingers** : les combinaisons utilisent désormais le vrai sous-ensemble de cartes qui score.
- Correction de **Eight Ball**, auparavant marqué fonctionnel sans effet runtime.
- Migration automatique de l’ancien système `tarot / spectral / planet` vers l’inventaire `arcanes / constellations / presages`, sans perte des récompenses en attente.
- **Certificate** génère désormais uniquement des sceaux réellement pris en charge par le moteur.
- Les Atouts ne sont plus tous enregistrés comme déclenchés à chaque main : animations et statistiques reposent maintenant sur des effets effectivement appliqués.
- Les effets post-jeu importants alimentent également le suivi des Atouts réellement déclenchés.
- **Swashbuckler** calcule maintenant son bonus à partir de la vraie valeur de revente des autres Atouts.
- Extraction des règles d’économie dans `economy-engine.js`.
- Les boosters ouverts doivent désormais être résolus avant de relancer ou quitter la boutique ; un booster en attente est restauré après rechargement.
- Navigation Accueil / Jeu rendue explicite pour éviter les changements d’écran involontaires à la fermeture des overlays.
- Version runtime dérivée du manifeste Foundry ; suppression des références internes codées en dur à 0.5.3.
- Version du schéma de sauvegarde découplée de la version du module.
- `install-local.ps1` lit désormais la version directement depuis `module.json`.
- Ajout d’une suite de tests Node couvrant les principales régressions de stabilisation.
- Les workflows Dev, promotion et publication exécutent désormais les tests avant validation.


## 0.5.3 — UI Polish & Atout Cards

- Boutique réorganisée : relance, statistiques de boutique et accès à la prochaine Mise déplacés dans la barre latérale.
- Suppression du bouton « Affronter… » en bas de la boutique ; la prochaine Mise devient une carte-action latérale claire et toujours au même endroit.
- Launcher illustré supprimé au profit d’une simple carte à jouer rendue en CSS.
- Atouts uniformisés au ratio **5:7** de carte à jouer dans la run, la boutique, le catalogue et les Chroniques.
- Ajout d’un cadre d’illustration commun pour les Atouts avec fallback automatique tant que l’image n’existe pas.
- Branchement anticipé des 150 illustrations via `images/jokers/{rareté}/{numéro}-{id}.webp`.
- Nouvelle passe de lisibilité : textes de boutique, catalogue, barre latérale, consommables et aides agrandis.
- Numéros de version internes et visibles synchronisés sur 0.5.3.

## 0.5.1 — Juice Update

- Ajout de 15 SFX originaux fantasy/casino en OGG.
- Remplacement des anciens bips Web Audio par une banque sonore dédiée.
- Animation de sélection, jeu et défausse des cartes.
- Animation des nouvelles cartes depuis la pioche après jeu/défausse et au début d’une Mise.
- Déclenchement visuel et sonore séquentiel des Atouts réellement utilisés.
- Ajout d’un burst de score temporaire et d’un comptage animé du résultat.
- Effets renforcés pour les gros scores / gros multiplicateurs.
- Entrées animées de la boutique, des boosters, des Boss et des écrans de victoire/défaite.
- Ajout du réglage Foundry **Vitesse des animations** : Normales, Rapides ou Désactivées.
- Respect automatique de `prefers-reduced-motion`.
- Interface principale et dimensions de jeu laissées intactes.

## 0.5.0 — Chroniques du Dragon

- Ajout d’un profil persistant par utilisateur Foundry.
- Ajout de l’écran **Chroniques du Dragon**.
- Statistiques : runs, victoires, mises, mains, défausses, économie, meilleur score et multiplicateur maximal.
- Collection persistante des Atouts découverts.
- Historique des 20 dernières runs terminées.
- 15 Épreuves permanentes avec 15 Atouts bonus réellement verrouillés puis ajoutés au pool de boutique après déblocage.
- Suivi de l’Atout le plus déclenché et de la main la plus jouée.
- Migration des sauvegardes de run vers le schéma 0.5.0.
- Interface principale conservée telle quelle hors accès aux Chroniques.

## 0.4.12 — Correctif visibilité des actions

- Réajustement de la grille principale du playfield pour redonner de la place à la zone basse.
- Correction de la hauteur de la section main / actions pour que les boutons du bas restent visibles.
- Table centrale rendue scrollable en dernier recours plutôt que de couper les actions.
- Ajustements responsive pour éviter la disparition des boutons sur les résolutions plus basses.

## 0.4.11 — STABLE / Cleanup

- Consolidation du CSS : suppression de l’empilement des correctifs 0.4.2 à 0.4.10 au profit d’une couche stable unique.
- Extraction du launcher dans `scripts/launcher.js`.
- Icône Foundry rendue par une image directe avec cache-busting.
- Migration automatique des sauvegardes 0.4.x.
- Harmonisation des numéros de version visibles dans le module.
- Synchronisation stricte du catalogue des 150 Atouts depuis la source JSON canonique.
- Terminologie fantasy corrigée sur les 15 Atouts encore planifiés pour une version future.
- Tests automatisés : défausse, jeu de main, boutique, consommables, booster et run complète sur 8 Antes.

## 0.4.10 — Correctif icône du launcher

- Remplacement du rendu CSS de l’icône par un élément image direct pour garantir l’affichage.
- Réimport de l’asset d’icône fourni par l’utilisateur.
- Ajustement du bouton du launcher pour forcer le centrage et la visibilité de l’icône.

## 0.4.9 — Lisibilité et interface fine-tunée

- Correction de l’alignement des pièces d’or dans les cartes et boutons.
- Rééquilibrage des tailles de police : moins d’excès sur les gros textes, meilleure lisibilité sur les petits éléments.
- Boutons et libellés importants agrandis dans la boutique et le panneau latéral.
- Effets visuels ajoutés sur la fenêtre de prévisualisation pour les multiplicateurs élevés.
- Correction de l’icône du module et mise à jour du texte d’aide du launcher.

## 0.4.8 — Lisibilité renforcée et nouvelle icône

- Augmentation de la taille du texte dans l’ensemble du module pour une meilleure lisibilité.
- Remplacement de l’icône cliquable Foundry par le nouvel asset fourni par l’utilisateur.
- Ajustement de la taille du bouton du module pour rester cohérent avec les autres modules.

## 0.4.7 — Refonte visuelle de l’interface

- Menus et panneaux aérés avec davantage de padding, de gap et de lisibilité.
- Pièces d’or remplacées par le nouvel asset fourni, avec une présence visuelle renforcée.
- Nouvelle icône Foundry : carte à jouer avec silhouette de dragon rouge.
- Correction de la sélection des cartes pour éviter qu’elles débordent dans les zones voisines.
- Style des cartes retravaillé vers un rendu plus médiéval-fantasy.

## 0.4.6 — Plein écran Foundry

- Le module occupe désormais tout l’écran Foundry.
- Suppression du cadre extérieur et des marges inutiles.
- Réorganisation du playfield pour éviter le scroll principal.
- Les scrolls restent uniquement sur les zones qui en ont besoin : boutique, catalogue et barre latérale.

## 0.4.5 — Lisibilité, jouabilité et atouts en format carte

- Redimensionnement du logo d’accueil pour qu’il soit visible en entier.
- Ajustement du shell et du playfield pour réafficher correctement la zone de main et les boutons Jouer / Défausser.
- Refonte visuelle des Atouts en vrai format carte, dans la barre d’atouts, le catalogue et la boutique.
- Nouvelle palette de rareté : commun blanc, peu commun orange, rare bleu, unique violet.
- Augmentation générale des tailles de police et des éléments d’interface.

## 0.4.4 — Nouveau titre et nouveau fond d’accueil

- Intégration du nouveau visuel de titre fourni par l'utilisateur sur l'écran d'accueil.
- Remplacement de l'illustration de fond d'accueil par la nouvelle version sans titre.
- Mise à jour des références de version et cache-busting des assets d'accueil.

## 0.4.3 — FX, jokers et confort visuel

- Correction renforcée des cartes écrasées dans la main avec dimensions verrouillées et zone de main agrandie.
- Ajout de petits bruitages synthétiques pour la sélection, la pose, la défausse, les achats et autres interactions.
- Animation des Atouts/Jokers lors des calculs de score.
- Remplacement visuel des montants en PO par une icône de pièce d'or au dragon.
- Lanceur du module désormais fixe, avec l'illustration intérieure animée.

## 0.4.2 — Confort visuel et audio

- Ajout d'un réglage de volume directement dans la barre supérieure du module.
- Réintégration de la nouvelle illustration d'accueil fournie par l'utilisateur, avec chargement forcé pour éviter le cache.
- Correction des cartes écrasées : dimensions verrouillées, ratio fixe, zéro rétrécissement dans la main et sur la table.

## 0.4.1 — Nouvelle illustration d’accueil

- Remplacement de l’illustration de l’écran d’accueil par la nouvelle version fournie.
- Harmonisation du visuel du bouton/carte du module avec le nouveau fond d’accueil.

## 0.4.0 — Atelier du deck

- Ajout des consommables : Arcanes, Constellations, Présages.
- Ajout des modifications permanentes du deck.
- Ajout des éditions Dorée, Runique et Prismatique.
- Ajout des Sceaux de Sang, Astral, du Marchand et Occulte.
- Ajout d’un booster à ouvrir dans chaque boutique.
- Ajout d’une offre de consommable dans chaque boutique.
- Remplacement des dollars par des pièces d’or.
- Intégration de l’illustration de fond à l’accueil.
- Intégration de deux pistes audio (accueil et partie).
- Refonte du lanceur du module avec animation et carte à silhouette de dragon.
- Ajout de notifications et de popups internes au style du module.

## 0.3.0 — La boucle roguelike

- Runs complètes en 8 Antes.
- Boss et boutiques.
- Atouts et économie.

## 0.5.2 — Asset Architecture
- Réorganisation des illustrations dans `assets/images/` par usage.
- Réorganisation des musiques et SFX dans `assets/audio/` par famille.
- Ajout de `assets/animations/` pour les futurs médias animés.
- Centralisation des chemins runtime dans `scripts/core/assets.js`.
- Regroupement des moteurs dans `scripts/engines/`, du launcher dans `scripts/ui/` et du juice dans `scripts/fx/`.
- Ajout de `styles/fx.css` pour isoler le polish visuel futur.
- Aucun changement volontaire des règles ou de l'équilibrage.
