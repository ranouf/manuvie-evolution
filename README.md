# Manuvie Évolution

Extension Chrome locale qui ajoute un bouton **Évolution** au portail Gestion de patrimoine Manuvie. Le panneau affiche les gains cumulés, les rendements par année et les frais directement débités.

## Installation locale

1. Ouvrir `chrome://extensions/` dans Chrome.
2. Activer **Mode développeur**.
3. Cliquer **Charger l’extension non empaquetée**.
4. Sélectionner le dossier de ce projet.
5. Recharger `https://manulifewealth.myinvestorportal.ca/overview`.

Lien à charger dans Chrome : `C:\Users\cedric\Documents\Sources\Manuvie`

## Commandes

```text
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:visual
npm run build
```

Le build produit deux archives :

- `dist/manuvie-evolution-{version}.zip` pour les tests et les releases locales ;
- `dist/manuvie-evolution-{version}-chrome-store.zip` pour le Chrome Web Store.

## Publication Chrome Web Store

La publication reprend la même procédure que l’extension UglyPadlet via le workflow GitHub Actions **Deploy Chrome Extension**.

Secrets GitHub requis :

- `CHROME_EXTENSION_ID`
- `CHROME_PUBLISHER_ID`
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`

Validation locale des credentials, si `.codex/secretkeys.txt` contient ces valeurs :

```text
npm run chrome-store:dry-run
```

Publication depuis GitHub :

1. Ouvrir **Actions**.
2. Lancer **Deploy Chrome Extension** avec **Run workflow**.
3. Garder `dry_run=true` pour valider les secrets sans publier.
4. Mettre `dry_run=false` et `publish_to_chrome_store=true` pour envoyer et publier sur le Chrome Web Store.
5. Optionnellement mettre `create_github_release=true` pour créer la release GitHub avec le zip Chrome Store.

## Sources de données du portail

- `/portfoliosummary/performance/v3/fr?rangeType=sinceInception` : historique global.
- `/account/chart/account/{compte}/language/fr?rangeType=sinceInception` : historique d’un compte.
- `/transactions/investorId/{investisseur}/language/fr` : frais Manuvie, TPS et TVQ.

Le gain affiché correspond à `valeur marchande - capital net investi`. Les dépôts et retraits ne sont donc pas comptés comme un gain ou une perte.

## Cache local

L’extension conserve les données déjà chargées dans le stockage local Chrome, par investisseur. Les années fermées sont réutilisées au prochain chargement et l’extension redemande seulement l’année courante pour actualiser les graphiques et les frais.
