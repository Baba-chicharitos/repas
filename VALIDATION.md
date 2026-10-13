# Validation du 13 octobre 2026

La validation finale porte sur les sources du dossier `repas` et sur le build statique produit par Vite. Aucune publication sur le VPS n’a été réalisée.

| Vérification exécutée | Résultat |
| --- | --- |
| `npm test` | **35 tests réussis**, 2 fichiers, Vitest 5.0.4 |
| `npm run typecheck` | **Réussi**, TypeScript strict, aucune erreur |
| `npm run build` | **Réussi**, Vite 7.3.7, chemin de base `/repas/` |
| `npm run test:e2e` | **21 tests réussis**, Playwright dans Chrome, sur le build de production |
| `npm audit --json` | **0 vulnérabilité signalée** dans les dépendances installées |

Environnement : Windows, Node.js 24.18.0, npm 12.2.0, Chrome local, Playwright 1.64.0. Les tests navigateur utilisent un seul processus pour respecter la mémoire disponible.

## Calculs et stockage

Les tests couvrent le calcul pour 3, 5 et 10 portions à partir d’une recette de 2 portions, l’exemple carbonara à 6 portions, l’indépendance repas/portions, la limite de l’objectif, les sélections répétées, la préservation de l’ordre lors d’une modification, les conversions kg/g et L/ml, les noms avec casse et espaces différents, la séparation des unités incompatibles et la précision décimale.

Les permutations sont vérifiées sur vingt cycles, avec refus de toutes les recettes, sérialisation et reprise, ajout, modification et suppression en cours de cycle. Le cas d’une seule recette fonctionne également.

Les tests IndexedDB vérifient la persistance des recettes, du Blob d’image, du cycle, de la sélection, du réglage, de la liste et des coches. Ils vérifient aussi le remplacement intégral de la liste, la conservation de l’instantané après modification/suppression d’une recette, l’annulation d’une transaction invalide, les écritures concurrentes et la récupération des enregistrements valides lorsque d’autres données sont incorrectes.

## Parcours dans le navigateur

Sept parcours sont exécutés pour chacun des trois formats : ordinateur 1 280 × 720, téléphone Pixel 7 et petit écran 320 × 568.

1. Premier lancement vide, création avec photo et calories, actualisation, réglage persistant, sélection de 3 repas et 10 portions, génération, coche/décoche persistante, modification de recette sans altérer la liste et régénération avec remise à zéro des coches.
2. Même recette choisie dans plusieurs cycles, modification et retrait dans le récapitulatif, libération de l’objectif et regroupement des quantités.
3. Huit cartes sur deux cycles sans répétition interne, avec rechargements intermédiaires.
4. Suppression confirmée d’une recette sélectionnée, nettoyage de la session et maintien de la liste existante.
5. Swipe à gauche, swipe à droite, annulation du dialogue et défilement vertical sans décision. Les gestes mobiles à gauche et verticaux utilisent des événements tactiles Chrome ; le geste à droite est également vérifié via Pointer Events avec la souris.
6. Quantité négative refusée, lignes d’ingrédients supplémentaires, décimales, remplacement réel d’une photo sauvegardé et vérifié après actualisation, puis suppression de la photo.
7. Navigation des quatre écrans vides, état actif des liens, option calories sauvegardée et absence de débordement horizontal.

Les captures de l’écran Repas se trouvent dans les sous-dossiers du test de cycle dans `test-results/` après exécution. Le serveur de prévisualisation est démarré et arrêté automatiquement par Playwright.

## Corrections issues des vérifications

- Les éléments décoratifs des cases n’interceptent plus le clic sur le contrôle.
- La modification d’une sélection conserve la position de la ligne.
- Le swipe est contenu dans sa zone pour éviter d’élargir le viewport mobile pendant l’animation et de décaler les dialogues.
- Les tests attendent la validation de l’écriture IndexedDB avant de recharger après une coche.
- Les versions des outils de test signalées par npm ont été remplacées par une version corrigée.

## Limites de cette validation

Les formats mobiles sont émulés dans Chromium : Safari natif et un téléphone physique n’ont pas été testés. Les zones de sécurité et les mouvements réduits sont pris en compte dans le code. L’hébergement Nginx réel n’a pas été modifié ni testé : les étapes et contrôles de publication sont décrits dans `DEPLOYMENT.md`. La persistance demeure soumise aux quotas et à la conservation des données du navigateur.
