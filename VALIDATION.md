# Validation du 13 octobre 2026

Validation du parcours en trois onglets, du thème bleu canard, de la nutrition Ciqual 2025 et du catalogue enrichi d’ingrédients. Les vérifications sont réalisées sur les sources locales et sur le build statique de production. Aucune publication sur le VPS n’a été réalisée.

| Vérification exécutée                                             | Résultat                                                               |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `npm test`                                                        | **98 tests réussis**, 6 fichiers, Vitest 5.0.4                         |
| `npm run typecheck`                                               | **Réussi**, TypeScript strict                                          |
| `npm run build`                                                   | **Réussi**, Vite 7.3.7, base `/repas/`                                 |
| `npm run test:e2e`                                                | **36 tests réussis** dans Chrome sur le build de production            |
| Contrôle complémentaire après ajustement de la hauteur des cartes | Parcours de swipe et contrôles +/− des portions, sur les trois formats |

Environnement : Windows, Node.js 24.18.0, npm 12.2.0, Chrome installé, Playwright 1.64.0. Un seul processus de test est utilisé pour limiter la mémoire. Les tests créent des contextes isolés et n’altèrent pas les données personnelles du navigateur de l’utilisateur.

## Calculs et persistance

- Calculs pour 3, 5 et 10 portions à partir d’une recette de 2 portions et exemple carbonara à 6 portions.
- Indépendance du nombre de repas et des portions, limite de l’objectif, selections répétées et modification sans changer l’ordre des lignes.
- Regroupement exact des noms avec différences de casse ou d’espaces, conversions kg/g et L/ml, séparation des unités incompatibles, précision décimale et absence d’arrondis cumulés.
- Permutations sur vingt cycles, refus de toutes les recettes, reprise après sérialisation, ajout, modification, suppression et cas d’une seule recette.
- Sauvegarde des recettes, photos Blob, sélection, cycle, liste et coches dans IndexedDB ; transactions annulées en cas d’erreur, écritures concurrentes et récupération des enregistrements valides.
- Demande de l’objectif avant le swipe, génération automatique après le dernier choix, impossibilité de recommencer ou de générer tant qu’une liste existe.
- Toutes les coches ne terminent pas automatiquement les courses. La fin explicite supprime la liste, les coches et la sélection, conserve les recettes et ramène à la première étape.
- Refus d’une action obsolète sur une liste ; reprise des données de l’ancienne version sans écraser la liste existante.
- Jeu d’essai facultatif, chargement sans doublons ni écrasement des recettes personnelles et identifiants fonctionnels sans `crypto.randomUUID` sur HTTP local.

## Parcours navigateur

Les huit scénarios de courses ci-dessous, le scénario de navigation fixe et trois scénarios nutrition/autocomplétion sont exécutés pour chacun des trois formats : ordinateur 1 280 × 720, Pixel 7 et petit écran 320 × 568, soit 36 tests.

1. Trois liens dans la navigation, arrivée directe sur « Faites vos courses ! », question du nombre de repas et option nutrition facultative, initialement désactivée.
2. Photo persistante, carte sans boutons oui/non ni informations secondaires, quantités indépendantes, swipe réel, génération automatique, coche/décoche, fermeture de la page puis réouverture dans le même navigateur, blocage du swipe, fin explicite et nouvelle liste avec coches vierges.
3. Modification puis suppression d’une recette pendant les courses : la liste actuelle reste inchangée.
4. Huit refus sur deux cycles sans doublon interne, rechargements intermédiaires et conservation de la carte courante.
5. Réglage des portions, reprise de la sélection après rechargement, modification et retrait dans le récapitulatif, puis calcul correct de la liste.
6. Geste horizontal court et geste vertical sans sélection accidentelle, défilement vertical et accès à la carte au clavier.
7. Photo remplacée puis supprimée, rechargement, quantité négative refusée, ingrédients supplémentaires et décimales.
8. Jeu d’essai sans doublons, conservation d’une recette personnelle et création de sélection avec l’API `randomUUID` volontairement indisponible.

Les gestes horizontaux sont testés à la souris sur ordinateur et par événements tactiles sur mobile. Les captures `objectif.png`, `swipe.png` et `courses.png` se trouvent dans les sous-dossiers correspondants de `test-results/`. Le thème a été inspecté visuellement. L’espace de défilement et les marges des contrôles évitent que la navigation flottante masque les boutons sur petit écran.

Le contrôle complémentaire vérifie explicitement les boutons de portions : trois repas donnent six portions par défaut ; + donne sept portions ; − revient à six ; une saisie de dix portions calcule ensuite les ingrédients pour dix. Le réglage des repas ne peut pas dépasser le nombre restant.

## Correction de la navigation

La navigation forme un arc d’ovale fixé au bord inférieur de l’écran, avec des icônes immobiles et l’onglet central légèrement plus haut. Elle est montée directement sous `document.body` pour rester indépendante du conteneur de l’application. La zone de sécurité inférieure du téléphone est prise en compte.

Après cette correction, TypeScript et le build de production passent. Neuf tests navigateur ciblés passent sur les trois formats : navigation, parcours complet avec swipe et formulaire. Le nouveau contrôle vérifie les positions pendant le défilement, après changement d’onglet et après réduction de la hauteur du viewport. La capture `navbar-arc.png` a été inspectée sur petit écran.

## Limites

Les appareils mobiles sont émulés dans Chromium ; Safari natif et un téléphone physique n’ont pas été testés. Le clavier virtuel natif n’est pas émulé. L’hébergement Nginx réel n’a pas été modifié ; voir `DEPLOYMENT.md`. La persistance dépend de la conservation des données et des quotas du navigateur. Les conversions de masse non fournies par Ciqual restent à renseigner par l’utilisateur. Les présentations génériques utilisent explicitement leur profil de référence ; elles ne constituent pas une analyse nutritionnelle spécifique au produit.

## Nutrition et catalogue enrichi

Les tests unitaires valident les 3 484 codes distincts et les quatre nutriments du fichier réel, les schémas invalides, la recherche par code, familles et synonymes, les accents, la casse, les tirets, apostrophes et ligatures. Ils vérifient les variantes crues/cuites des pâtes, les trois états des pois chiches (20516, 20532, 20507), les premiers choix du riz (9100, 9104), le filtrage des plats préparés et leur disponibilité pour les anciennes associations. Les options de présentation restent rattachées à un code officiel et portent leur référence générique.

Les calculs sont contrôlés pour la recette entière, une portion et 3/5/10 portions sélectionnées, avec plusieurs ingrédients et des décimales. Les tests couvrent g/kg, ml/L, unités, cuillères et pincées ; aucun volume ou nombre d’unités ne devient une masse sans facteur explicite. Les données absentes, codes inconnus, quantités invalides, traces, seuils, sommes d’une valeur et d’un seuil, et quantités nulles sont vérifiés séparément. Les exemples réels donnent 364 kcal pour 100 g de pâtes sèches (9810), 350 kcal pour 100 g de pois chiches secs (20516), et 165,416 kcal pour 20 ml d’huile d’olive (17270) avec une conversion explicitement renseignée de 0,92 g/ml.

Les tests IndexedDB vérifient la conservation des recettes anciennes, des calories manuelles, des codes, des conversions, des options génériques et des préférences d’affichage. Les métadonnées nutritionnelles facultatives corrompues n’entraînent pas la suppression d’une recette valide. La base et la version d’état restent en version 1.

Le fichier JSON fourni n’a pas été modifié. Son SHA-256 avant/après intégration est `4B2C94DC729FB11EFB423F5CC2F30531FA3AB510457145827FDC8F51E86E75DB`. Le README de l’archive `SerranoTool-Repas-Ciqual-ingredients.zip` a été lu ; seules les sources applicatives, les tests et la documentation du projet ont été adaptés.

Les trois nouveaux scénarios navigateur contrôlent la recherche hors réseau, une association explicite avec conversion ml/g, la recette entière et les portions sélectionnées, les traces/seuils/valeurs absentes, la conservation des calories manuelles et la préférence d’affichage après rechargement. L’autocomplétion vérifie l’absence d’association par simple saisie ou Entrée sans choix, la sélection aux flèches puis Entrée, les familles pâtes/pois chiches, la sélection tactile sur mobile, les profils génériques après sauvegarde/relecture, le retrait et la réassociation, Échap et l’annulation sans modification de la recette sauvegardée. Les scénarios produisent `autocomplete-families.png`, `autocomplete-generic.png` et `nutrition-swipe.png` dans `test-results/`. Les positions de la famille proposée sont contrôlées dans le viewport ; la liste s’ouvre en superposition pour éviter les déplacements des contrôles au clic.

Après les 36 tests réussis, le scénario d’autocomplétion a été relancé sur les trois formats avec des captures limitées au viewport (3 tests complémentaires réussis). Le rendu a été inspecté sur ordinateur, Pixel 7 et petit écran 320 × 568. Ce dernier lancement remplace les anciens résultats dans `test-results/` et conserve les captures d’autocomplétion.

TypeScript et le build final passent. Le catalogue est importé comme texte embarqué puis validé à l’exécution, pour éviter une inférence de types littéraux volumineuse. Le bundle complet représente environ 280 ko gzip pour JavaScript et 10 ko gzip pour CSS. Les tests unitaires et navigateur sont lancés séparément et avec un seul processus concurrent pour limiter la mémoire.

## Affichage limité aux cartes de swipe

Les valeurs nutritionnelles et le champ de calories ont été retirés de l’éditeur et du détail des recettes. Le composant n’est utilisé que dans `SwipeCard`, conditionné par l’option d’affichage. Il présente quatre blocs à coins arrondis, de couleurs distinctes, pour une portion de référence (`total / referencePortions`). Les quantités sélectionnées pour les courses ne modifient pas ces chiffres. Les traces, valeurs indisponibles et résultats partiels restent indiqués à l’intérieur des blocs, ainsi que la mention de profil générique lorsqu’elle s’applique.

Les anciennes calories manuelles sont conservées à la sauvegarde, même si le champ n’est plus visible. Le test navigateur simule une ancienne valeur de 540 kcal, modifie puis sauvegarde la recette et vérifie sa conservation dans IndexedDB. Il contrôle aussi l’absence de valeurs dans les écrans de recettes, les quatre couleurs, les traces, la valeur par portion de 82,71 kcal pour l’exemple d’huile, et son invariance lorsque les portions choisies passent de trois à cinq.

Sur cette correction, 33 scénarios de la suite complète ont passé ; les trois contrôles restants ont été relancés avec succès après correction de la comparaison entre texte rendu et texte DOM dans le test. TypeScript et le build passent. Le rendu des blocs a été inspecté sur petit écran ; les trois contrôles ciblés passent sur ordinateur et les deux formats mobiles émulés.

## Formulaire simplifié et arrondis nutritionnels

La section Ciqual et ses boutons ont été supprimés. La sélection d’une variante reste dans l’autocomplétion du nom ; le champ de conversion de masse ne s’affiche que pour les unités et volumes. Les blocs de nutrition n’affichent plus « par portion ». Le formatage des blocs arrondit à l’entier supérieur et préfixe les valeurs approximatives par `~` (profil générique, conversion de masse, seuil ou contribution connue avec traces). Les valeurs absentes, calculs incomplets et traces seules affichent `—`. Les données et calculs précis sont conservés.

Après cette correction : 98 tests unitaires réussis ; TypeScript et build réussis ; 12 tests navigateur ciblés réussis sur ordinateur, Pixel 7 et 320 × 568. Les contrôles couvrent l’autocomplétion sans section supplémentaire, les conversions persistantes et leur réinitialisation, le fonctionnement sans réseau, les états cru/cuit, les seuils et valeurs absentes, les arrondis, l’absence de sous-titre, les portions sélectionnées indépendantes et le formulaire avec ses photos. Le rendu `nutrition-rounded.png` a été inspecté sur petit écran.
