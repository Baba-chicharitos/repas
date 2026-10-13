# Repas · SerranoTool

Application personnelle React/TypeScript : choisissez des recettes avec des gestes de swipe, ajustez les repas et les portions, puis générez votre liste de courses. Aucune recette de démonstration n’est ajoutée automatiquement. Aucun serveur métier, compte, service cloud ou accès à une API n’est nécessaire.

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

Le build est généré dans `dist/`. Vite utilise explicitement `base: '/repas/'`. La navigation repose sur les fragments (`#repas`, `#recettes`, `#courses`, `#options`) : elle fonctionne sur un hébergement statique et l’ouverture sans fragment arrive sur Repas.

## Tests navigateur

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

## Fonctionnement

- Les repas comptent pour l’objectif, indépendamment des portions. Les ingrédients sont multipliés par `portions sélectionnées / portions de référence`. La même recette peut être choisie dans plusieurs cycles : chaque choix est une entrée indépendante et toutes les quantités sont additionnées.
- L’objectif ne peut pas devenir inférieur aux repas déjà sélectionnés. Il faut retirer ou réduire les plats concernés avant de le diminuer. Les repas et portions sont des entiers positifs ; les quantités d’ingrédients acceptent des décimales et zéro.
- Une permutation Fisher-Yates contient les cartes à venir. Une carte est consommée après un refus ou une acceptation confirmée. Annuler le choix conserve la carte. Après actualisation, la carte sans décision reste affichée ; les cartes déjà passées ne reviennent pas avant la fin du cycle.
- Les recettes nouvelles rejoignent le cycle en cours, les recettes supprimées sont retirées de la file et de la sélection. Modifier une recette conserve sa place dans le cycle et met à jour les prochains calculs.
- Les noms sont comparés exactement après normalisation Unicode NFC, suppression des espaces aux extrémités, réduction des espaces multiples et conversion en minuscules. Aucun rapprochement approximatif, singulier/pluriel ou suppression d’accent n’est appliqué.
- Les unités kg/g et L/ml sont converties et regroupées. Les autres unités sont regroupées uniquement si elles sont identiques. Si un même produit compatible possède plusieurs catégories, la première catégorie rencontrée dans la sélection est utilisée. On peut la corriger dans les recettes avant de régénérer la liste.
- Les calculs utilisent des fractions `BigInt`, avec arrondi final à six décimales, sans cumuler les arrondis intermédiaires. À partir de 1 000 g/ml, l’affichage utilise kg/L.
- La liste est un instantané. Modifier ou supprimer une recette ne change pas les produits et les coches de cette liste. Générer à nouveau la remplace intégralement, après confirmation si une liste existe. Aucune ancienne liste n’est archivée.
- « Nouvelle sélection » vide les choix après confirmation et conserve les recettes, les réglages et la liste de courses existante.
- Les calories sont saisies manuellement. L’option masque leur affichage dans les cartes et les détails. Le champ reste disponible dans le formulaire afin de pouvoir saisir cette donnée, quelle que soit la préférence d’affichage.

## Stockage et images

La base IndexedDB `serranotool-repas-v1` est isolée des autres applications SerranoTool. Le magasin `state` contient une seule entrée `current` : recettes, session, réglages et dernière liste. Le magasin `images` contient les photos sous forme de **Blob** ; les recettes référencent leur identifiant. Aucun stockage localStorage ni Base64 persistant n’est utilisé.

Les sauvegardes sont des transactions atomiques : l’interface confirme l’opération après validation de l’écriture. Les modifications d’une photo et de sa recette sont validées ensemble. La lecture et la modification de l’état ont lieu dans la même transaction pour préserver les écritures concurrentes. Les onglets se rafraîchissent par BroadcastChannel et au retour sur la page.

Les images JPEG, PNG et WebP jusqu’à 25 Mo sont redimensionnées à 1 400 pixels maximum et recompressées en WebP (qualité 82 %, ou format de repli fourni par le navigateur). Les URL Blob d’affichage sont libérées à leur remplacement. Une image manquante affiche une illustration locale en CSS/SVG. Les champs invalides sont signalés ; les enregistrements corrompus sont filtrés indépendamment à la lecture. Une version future inconnue est refusée sans écrasement.

Les données appartiennent au navigateur et à l’origine HTTPS. Elles ne sont pas partagées entre appareils ni transférées automatiquement entre `localhost` et `serranotool.fr`. Effacer les données du site, utiliser la navigation privée ou perdre ce profil peut supprimer le carnet. Le navigateur peut aussi appliquer ses propres quotas : une erreur de stockage est affichée sans annoncer une sauvegarde réussie. L’application ne propose ni sauvegarde distante ni synchronisation.

## Architecture

```text
src/types.ts          modèles explicites
src/domain.ts         calculs, validation, sélection et permutation
src/storage.ts        IndexedDB et transactions
src/images.ts         validation et compression des photos
src/components.tsx    champs, images et dialogues accessibles
src/RecipeEditor.tsx  formulaire complet des recettes
src/SwipeCard.tsx     gestes Pointer Events et boutons équivalents
src/App.tsx           quatre pages et orchestration
src/styles.css        palette SerranoTool, responsive et zones de sécurité
```

Les boutons et dialogues fonctionnent au clavier. Les dialogues natifs gèrent le focus et la touche Échap ; les animations respectent la préférence de réduction des mouvements. `touch-action: pan-y` autorise le défilement vertical sur les cartes. La capture du pointeur n’intervient qu’après identification d’un geste horizontal.

## Déploiement

Voir [DEPLOYMENT.md](DEPLOYMENT.md). La configuration et les services de production existants n’ont pas été modifiés.
