# Publier sous https://serranotool.fr/repas/

Le projet se déploie uniquement en fichiers statiques. Les étapes ci-dessous sont à réaliser sur votre infrastructure ; aucune publication automatique n’est effectuée.

## 1. Construire

Avec Node.js 24 LTS :

```sh
npm ci
npm test
npm run build
```

Transférer le **contenu** de `dist/` dans `/var/www/serranotool/repas/` sur le VPS. Conserver les permissions de lecture pour Nginx. Ne pas envoyer les sources ni `node_modules` dans le répertoire public.

On doit retrouver notamment :

```text
/var/www/serranotool/repas/index.html
/var/www/serranotool/repas/favicon.svg
/var/www/serranotool/repas/assets/...
```

## 2. Ajouter des emplacements Nginx ciblés

Adapter le chemin à votre installation et intégrer uniquement ces emplacements au bloc HTTPS `server` de `serranotool.fr`, en vérifiant l’absence d’un emplacement `/repas` existant. Ils prennent priorité sur une éventuelle redirection globale vers AdonisJS et ne changent pas les autres applications.

```nginx
location = /repas {
    return 301 /repas/;
}

location ^~ /repas/assets/ {
    root /var/www/serranotool;
    try_files $uri =404;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location ^~ /repas/ {
    root /var/www/serranotool;
    index index.html;
    try_files $uri $uri/ /repas/index.html;
    add_header Cache-Control "no-cache";
}
```

Le `root` correspond au **parent** du dossier `repas`. Ne pas utiliser `root /var/www/serranotool/repas` dans ces emplacements : Nginx ajouterait une seconde fois le segment `repas`.

Les routes de navigation utilisent des fragments, qui ne sont pas envoyés au serveur. Le repli vers `index.html` permet aussi de servir l’entrée pour les chemins du module. Les fichiers CSS/JS absents dans `assets/` retournent 404, plutôt qu’une page HTML incorrectement interprétée comme JavaScript. Vérifier que votre bloc `http` inclut déjà `mime.types` pour les types CSS, JS et SVG.

## 3. Vérifier puis recharger

```sh
sudo nginx -t
sudo systemctl reload nginx
```

Ne recharger Nginx que si le test de configuration réussit. Conserver l’ancienne version des fichiers pour revenir en arrière en cas de besoin ; ne pas supprimer les données du navigateur lors d’une mise à jour.

## 4. Contrôle après publication

- Ouvrir `/repas` : la redirection doit aboutir à `/repas/`.
- Vérifier dans les outils du navigateur que les ressources de `/repas/assets/` répondent 200 avec les bons types MIME.
- Ajouter une recette avec une photo et actualiser : les deux doivent rester présentes.
- Choisir des repas, générer la liste, cocher un produit et actualiser.
- Vérifier les quatre onglets et leur ouverture directe, par exemple `/repas/#courses`.
- Vérifier les applications SerranoTool existantes après l’ajout des emplacements.

L’interface et les calculs ne font aucun appel externe. Le chargement initial de l’application nécessite l’accès au site ; aucune fonctionnalité de service worker ou garantie de chargement hors ligne n’est incluse dans cette version.
