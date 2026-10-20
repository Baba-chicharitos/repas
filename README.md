# Repas · SerranoTool

Application personnelle React/TypeScript : indiquez un nombre de repas, choisissez vos plats par swipe et retrouvez automatiquement votre liste de courses. L’interface utilise un fond bleu canard foncé et des accents bleus. Aucune recette de démonstration n’est ajoutée automatiquement. Aucun serveur métier, compte, service cloud ou accès à une API n’est nécessaire.

## Lancer le projet

Prérequis : Node.js **24 LTS** et npm. Les versions exactes des dépendances sont conservées dans `package-lock.json`.

```sh
npm ci
npm run dev
```

Ouvrir l’URL indiquée par Vite, suivie de `/repas/` (habituellement `http://127.0.0.1:5173/repas/`).

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

Le build est généré dans `dist/`. Vite utilise explicitement `base: '/repas/'`. La navigation comporte **Recette**, **Faites vos courses !** et **Options** (`#recettes`, `#courses`, `#options`). L’ouverture sans fragment arrive directement sur « Faites vos courses ! ». L’ancien fragment `#repas` ouvre également ce parcours.

## Essayer avec des recettes prêtes à utiliser

Ouvrir **`/repas/?essai=1`**, puis cliquer sur **« Charger les 8 recettes d’essai »**. En local : `http://127.0.0.1:5173/repas/?essai=1`. Sur SerranoTool : `https://serranotool.fr/repas/?essai=1` après déploiement.

Le carnet reçoit : carbonara, poulet au riz, lasagnes, salade de pâtes, curry de pois chiches, saumon et pommes de terre, omelette aux légumes et soupe de légumes. Ce sont de vraies recettes modifiables et persistantes, avec des quantités pour calculer les courses. Les calories sont des valeurs illustratives ; les photos peuvent être ajoutées avec vos propres fichiers. Le chargement conserve vos recettes, vos choix et votre liste existante. Recharger le jeu ne crée pas de doublons et ne remplace pas vos modifications.

Pour tester les exemples du cahier des charges, prévoir 6 repas et choisir carbonara pour 1 repas / 3 portions, poulet au riz pour 3 repas / 10 portions et lasagnes pour 2 repas / 4 portions. La liste doit indiquer 6 repas et 17 portions, dont 1,5 kg de poulet. Les recettes contiennent également des noms avec différences de casse et d’espaces, ainsi que des ingrédients en g/kg et ml/L, pour tester le regroupement.

Les recettes d’essai peuvent être modifiées ou supprimées comme toute autre recette. Sans `?essai=1`, le panneau de chargement est masqué.

## Tests navigateur

```sh
npm run test:e2e
```

Playwright utilise **Chrome installé sur la machine** (`channel: 'chrome'`), construit l’application et lance automatiquement la prévisualisation du build sur le port 4173. Les projets couvrent un ordinateur, un téléphone et un écran de 320 × 568 pixels (émulation Chromium, pas Safari natif). Un seul processus est utilisé pour limiter la mémoire. Si Chrome est absent, installer Chrome pour exécuter ces tests. Les traces des échecs sont conservées dans `test-results/`.

Les tests de calcul, permutation et stockage se trouvent dans `tests/`. Les tests navigateur utilisent des recettes temporaires dans des contextes isolés. Le jeu d’essai facultatif est également testé ; son chargement reste une action explicite.

## Le parcours de courses

1. **Nombre de repas** : répondre à la question, puis appuyer sur « Choisir mes repas ».
2. **Swipe** : glisser à gauche pour passer ou à droite pour sélectionner. La carte contient uniquement l’image et le nom du plat. Sous la carte, les repas et les portions se règlent chacun avec un bouton − à gauche, la quantité au centre et un bouton + à droite. Il n’y a aucun bouton oui/non. Sur ordinateur, on peut glisser à la souris ; pour l’accès au clavier, une carte ayant le focus répond aussi aux flèches gauche/droite.
3. **Liste** : le dernier choix qui complète l’objectif génère automatiquement les ingrédients quantifiés et cochables. La liste est sauvegardée avec ses coches. Elle reste affichée après fermeture et réouverture et bloque toute nouvelle sélection, même depuis un autre onglet.
4. **Fin** : seul le bouton **« Courses terminées »** supprime la liste et ses coches définitivement. Toutes les cases cochées ne terminent pas automatiquement les courses. Le bouton fonctionne aussi si certains produits restent décochés. Après la fin, l’application redemande le nombre de repas.

Une sélection en cours est conservée après rechargement. Son récapitulatif repliable permet de modifier ou retirer un plat avant d’atteindre l’objectif. Les recettes et leurs photos restent dans le carnet quand les courses sont terminées. Modifier ou supprimer une recette pendant les courses ne change pas la liste déjà générée : elle constitue un instantané. Aucune liste ne peut être remplacée avant la fin explicite des courses, et aucun historique n’est conservé.

Les données de la première version sont conservées : une liste existante devient la liste active et une sélection déjà commencée reprend à l’étape du swipe.

## Portions, calculs et cycles

- Les repas comptent pour l’objectif, indépendamment des portions. Les ingrédients sont multipliés par `portions sélectionnées / portions de référence`. La même recette peut être choisie dans plusieurs cycles : chaque choix est une entrée indépendante.
- Par défaut, un plat compte pour un repas et deux portions (ou le nombre de personnes déjà sauvegardé dans l’ancienne version). Changer le nombre de repas adapte les portions jusqu’à ce que l’utilisateur règle lui-même celles-ci ; les valeurs deviennent alors indépendantes. Le nombre de repas pour le plat est limité aux repas restants.
- Les repas et portions sont des entiers positifs ; les quantités d’ingrédients acceptent des décimales et zéro.
- Une permutation Fisher-Yates contient les cartes à venir. Après actualisation, la carte sans décision reste affichée ; les cartes déjà passées ne reviennent pas avant la fin du cycle. Les refus ne bloquent jamais le cycle.
- Les recettes nouvelles rejoignent le cycle en cours, les recettes supprimées sont retirées de la file et de la sélection. Modifier une recette conserve sa place dans le cycle.
- Les noms sont comparés exactement après normalisation Unicode NFC, suppression des espaces aux extrémités, réduction des espaces multiples et conversion en minuscules. Aucun rapprochement approximatif, singulier/pluriel ou suppression d’accent n’est appliqué.
- Les unités kg/g et L/ml sont converties et regroupées. Les autres unités ne sont regroupées que si elles sont identiques. Si un même produit possède plusieurs catégories, la première catégorie rencontrée dans la sélection est utilisée.
- Les calculs utilisent des fractions `BigInt`, avec arrondi final à six décimales. À partir de 1 000 g/ml, l’affichage utilise kg/L.

## Nutrition locale et choix des ingrédients

La base `src/data/ciqual-2025.json` contient les 3 484 références Ciqual 2025, avec quatre nutriments pour 100 g. Le catalogue est embarqué avec l’application et validé au chargement. La recherche et les calculs ne nécessitent aucune API ni requête réseau. Le JSON fourni n’est pas réécrit par l’application.

Dans le formulaire de recette, le champ **Nom** propose les variantes groupées par famille dès la saisie : « pâtes », « pois-chiche », « riz », etc. Accents, casse, tirets et apostrophes sont normalisés pour la recherche. Les suggestions habituelles utilisent exclusivement les références `isIngredientCandidate=true`. Les autres références restent disponibles pour les associations déjà enregistrées. Choisir une variante est obligatoire pour établir le lien : taper un nom ou quitter le champ ne sélectionne aucun aliment. Au clavier, utiliser les flèches puis Entrée ; Échap ferme les suggestions. La recherche par nom ou code se fait directement dans ce champ, sans section Ciqual supplémentaire ni boutons d’association.

Les présentations supplémentaires, comme les tagliatelles ou les coquillettes, portent la mention **Valeurs nutritionnelles génériques** dans les suggestions. Elles enregistrent leur `ingredientOptionId` et le `ciqualCode` de référence, sans créer de valeurs nutritionnelles spécifiques. Le nom de la présentation et sa catégorie sont utilisés pour la recette et les courses. La mention **Profil générique** apparaît dans le bloc Calories sur les cartes lorsque la nutrition est activée.

Les quantités en g/kg sont directement convertibles. Pour les ml, L, unités, cuillères et pincées, renseigner la masse comestible en grammes pour **une unité de l’unité sélectionnée** : par exemple 0,92 g pour 1 ml, ou 920 g pour 1 L, uniquement si cette conversion est justifiée pour l’ingrédient. Aucun poids ou facteur de densité n’est supposé. Changer l’unité ou le profil efface la conversion ; modifier le nom demande une nouvelle association.

Les calories, protéines, glucides et lipides apparaissent uniquement sur les cartes de swipe lorsque l’option **Afficher les informations nutritionnelles** est activée. Quatre blocs colorés à coins arrondis affichent les valeurs pour **une portion de référence** : total des ingrédients divisé par les portions de référence de la recette. Ces chiffres restent indépendants des portions choisies pour les courses. Aucun panneau nutritionnel ni champ de calories n’est affiché dans l’éditeur ou le détail des recettes. Les anciennes calories manuelles restent conservées lors des modifications, sans remplacer le calcul Ciqual. La préférence d’affichage est sauvegardée dans IndexedDB.

Les blocs affichent des entiers arrondis au supérieur et aucun sous-titre « par portion ». Un préfixe `~` indique un profil générique, une conversion de masse ou une valeur issue d’un seuil/des traces ajoutées à une contribution connue. Les données manquantes et traces sans valeur quantifiée sont représentées par `—` ; leur nature reste expliquée par le titre du bloc. Les calculs internes et le catalogue conservent leur précision.

Le calcul additionne `masse × valeur / 100`, puis divise par les portions de référence. Une sélection multiplie la valeur par portion par les portions choisies, sans multiplicateur supplémentaire pour les repas. Les arrondis sont réservés à l’affichage. Les valeurs sous un seuil restent des intervalles (`< …` ou `… à < …`) ; les traces restent qualitatives. Les données manquantes, codes inconnus et conversions absentes produisent un résultat indisponible ou partiel avec les ingrédients à vérifier, jamais une valeur inventée. Une ligne de quantité nulle contribue zéro sans nécessiter d’association.

Les anciennes recettes, leurs calories manuelles, leurs codes et la liste de courses actuelle sont conservés. La base IndexedDB et la version de l’état restent inchangées. Les champs nutritionnels sont facultatifs ; aucune association automatique n’est créée au chargement. Les familles et libellés de présentation du catalogue enrichi sont des aides à la recherche, distinctes des valeurs officielles Ciqual.

## Stockage et images

La base IndexedDB `serranotool-repas-v1` est isolée des autres applications SerranoTool. Le magasin `state` contient une seule entrée `current` : recettes, session, réglages et dernière liste. Le magasin `images` contient les photos sous forme de **Blob** ; les recettes référencent leur identifiant. Aucun stockage localStorage ni Base64 persistant n’est utilisé.

Les sauvegardes sont des transactions atomiques : l’interface confirme l’opération après validation de l’écriture. Les modifications d’une photo et de sa recette sont validées ensemble. La lecture et la modification de l’état ont lieu dans la même transaction pour préserver les écritures concurrentes. Les onglets se rafraîchissent par BroadcastChannel et au retour sur la page.

Les images JPEG, PNG et WebP jusqu’à 25 Mo sont redimensionnées à 1 400 pixels maximum et recompressées en WebP (qualité 82 %, ou format de repli fourni par le navigateur). Les URL Blob d’affichage sont libérées à leur remplacement. Une image manquante affiche une illustration locale en CSS/SVG. Les champs invalides sont signalés ; les enregistrements corrompus sont filtrés indépendamment à la lecture. Une version future inconnue est refusée sans écrasement.

Les données appartiennent au navigateur et à l’origine HTTPS. Elles ne sont pas partagées entre appareils ni transférées automatiquement entre `localhost` et `serranotool.fr`. Effacer les données du site, utiliser la navigation privée ou perdre ce profil peut supprimer le carnet. Le navigateur peut aussi appliquer ses propres quotas : une erreur de stockage est affichée sans annoncer une sauvegarde réussie. L’application ne propose ni sauvegarde distante ni synchronisation.

## Architecture

```text
src/types.ts          modèles explicites
src/data/ciqual-2025.json catalogue fourni, références et nutrition Ciqual
src/ciqual.ts         validation, index local, recherche par familles
src/nutrition.ts      conversions, calculs et valeurs incomplètes
src/NutritionSummary.tsx quatre blocs nutritionnels sur la carte, par portion de référence
src/IngredientNameInput.tsx autocomplétion tactile et clavier
src/IngredientSuggestions.tsx familles et choix explicites de variantes
src/IngredientMassField.tsx conversion en grammes pour les unités et volumes
src/domain.ts         calculs, validation, sélection et permutation
src/storage.ts        IndexedDB et transactions
src/images.ts         validation et compression des photos
src/components.tsx    champs, images et dialogues accessibles
src/RecipeEditor.tsx  formulaire complet des recettes
src/SwipeCard.tsx     gestes Pointer Events et accès au clavier
src/workflow.ts       étapes, génération automatique, verrouillage et fin
src/sampleRecipes.ts  jeu de 8 recettes chargé uniquement sur demande
src/App.tsx           trois onglets et orchestration
src/styles.css        palette SerranoTool, responsive et zones de sécurité
src/theme.css         direction artistique bleu canard et accents bleus
```

Les boutons et dialogues fonctionnent au clavier. Les dialogues natifs gèrent le focus et la touche Échap ; les animations respectent la préférence de réduction des mouvements. `touch-action: pan-y` autorise le défilement vertical sur les cartes. La capture du pointeur n’intervient qu’après identification d’un geste horizontal.

## Déploiement

Voir [DEPLOYMENT.md](DEPLOYMENT.md). La configuration et les services de production existants n’ont pas été modifiés.
