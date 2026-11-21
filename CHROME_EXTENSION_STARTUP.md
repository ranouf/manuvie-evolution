# Démarrer et livrer une extension Chrome

Guide commun établi le 30 octobre 2026 à partir de Manuvie Évolution, BNRI Évolution, C411 Deep Search, UglyPadlet, UberEatHabits et du fonctionnement local de Block New Tab.

Ce document décrit la procédure cible d'une **nouvelle extension**. La présence de ce guide dans un dépôt ne signifie pas que toutes les étapes y sont déjà configurées. Vérifier les scripts, les workflows et les réglages réels avant de les réutiliser.

## 1. Partir des données réelles : documentation API et appels réseau

Cette investigation précède le choix de l'architecture et la réalisation de l'interface.

1. Rechercher la documentation API officielle du site : endpoints, authentification, droits, pagination, limites et exemples. Consigner les liens et la date de consultation. Ne pas inventer une API ou un schéma à partir d'une capture d'écran.
2. Examiner les appels réseau réellement effectués par le site dans une session autorisée : Fetch/XHR, paramètres, corps des requêtes, réponses, codes d'erreur et séquence de chargement. Si aucune documentation publique n'existe, ces observations définissent le contrat à vérifier.
3. Identifier la source de chaque donnée : identifiant stable, date et fuseau horaire, statut, quantité, montant, devise et liens de détail. Pour un historique, vérifier les curseurs, les pages suivantes, les doublons et la condition de fin. Comparer plusieurs résultats avec l'interface native.
4. Distinguer une consultation d'une action métier. Ne pas rejouer une requête qui commande, paie, publie, modifie ou supprime une donnée pour découvrir son fonctionnement.
5. Choisir l'API documentée ou les réponses déjà reçues par le site lorsque cela fournit des données fiables. Utiliser le DOM lorsque cette approche est adaptée ou que l'API n'est pas exploitable ; documenter alors les limites, par exemple « uniquement les commandes chargées dans la page ».
6. Produire des fixtures anonymisées pour tester le contrat observé. Les exports réseau bruts peuvent contenir des cookies, en-têtes d'autorisation et données personnelles : les garder dans le dossier temporaire ignoré prévu par les instructions locales, puis supprimer les copies inutiles. Ne pas les commiter ni les joindre aux artefacts publics.

Noter dans le README la source retenue, les routes et champs utiles, la stratégie de pagination, la date de vérification et les limites connues. Une absence de résultats doit être distinguée d'une session expirée ou d'un changement de schéma. Éviter les valeurs de secours qui donnent un résultat plausible mais faux.

Pour observer les réponses de la page, une passerelle exécutée dans le monde `MAIN` peut être nécessaire. Conserver le comportement initial de `fetch`/XHR, limiter l'observation aux domaines et routes utiles et vérifier l'origine, la source et le contenu des messages reçus par le script isolé. Ne pas enregistrer les en-têtes de session dans le dépôt ou les logs.

## 2. Les références à réutiliser

| Projet            | Éléments utiles                                                                                                       | Attention avant réutilisation                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Manuvie Évolution | Panneau latéral intégré, observation réseau, calculs, cache, tests, archives et déploiement manuel                    | Adapter les domaines, la structure API, les règles de calcul et la politique de cache.                                   |
| BNRI Évolution    | Bouton flottant, panneau aux couleurs du portail, séparation analyse/interface, contrôle de couverture                | Ne pas reprendre les identifiants ni les règles financières d'un autre portail.                                          |
| C411 Deep Search  | Enrichissement direct du site, pagination et chargement progressif, tests du comportement navigateur                  | Vérifier les routes, la fin de pagination et les écarts entre branches locales et distantes.                             |
| UglyPadlet        | Transformation de contenu, filtres, suivi en arrière-plan, packaging par liste autorisée, CI et protection de branche | Respecter pnpm et ses fichiers de verrouillage. Les fonctions d'arrière-plan exigent une justification propre.           |
| UberEatHabits     | Modules réutilisables, panneau isolé, police héritée du site, mise à jour du DOM, version synchronisée                | Le lecteur actuel ne couvre que l'historique déjà chargé. Les workflows de publication complète sont encore à compléter. |
| Block New Tab     | Extension utilitaire avec popup et service worker                                                                     | Un utilitaire sans site cible n'impose pas le même panneau qu'une extension qui enrichit un portail.                     |

Réutiliser les composants et scripts génériques, pas une application complète avec ses noms, secrets et hypothèses métier. Ne pas copier les répertoires de dépendances, profils de navigateur, caches ou archives de sauvegarde.

## 3. Préparer les outils et préserver les travaux existants

Sous Windows, utiliser PowerShell et des fichiers UTF-8. Vérifier :

```powershell
git --version
gh --version
gcloud --version
node --version
npm --version
gh auth status
gcloud auth list
```

Les projets de référence utilisent Node.js 24 dans leurs workflows. Conserver le gestionnaire et le lockfile du dépôt : `npm ci` avec `package-lock.json`, ou `pnpm install --frozen-lockfile` avec `pnpm-lock.yaml`. Ne pas introduire un second gestionnaire de dépendances par inadvertance.

Si nécessaire, installer l'outil Google officiel :

```powershell
winget install --id Google.CloudSDK --exact --source winget
```

Ouvrir ensuite un nouveau terminal pour actualiser le `PATH`. Réutiliser les connexions existantes ; ne relancer `gh auth login` ou `gcloud auth login` que si nécessaire. Ne pas révoquer les accès d'une autre extension.

Avant chaque intervention : lire `AGENTS.md`, le README, les règles de version, `git status --short --branch`, les remotes et les PR ouvertes. Un dossier contenant un manifeste n'est pas nécessairement un dépôt Git.

Si un dépôt contient des changements en cours, préparer les commits dans une copie ou un checkout isolé de sa branche cible. Ne pas commiter ces changements, les réinitialiser, les déplacer ou les inclure dans une PR de documentation. Ne jamais fermer tous les processus Chrome pour effectuer un test ; utiliser un profil de test distinct.

## 4. Identifier les ressources sans les confondre

Définir avant de commencer :

```powershell
$ExtensionName = "Ma nouvelle extension"
$ExtensionSlug = "ma-nouvelle-extension"
$Repository = "ranouf/$ExtensionSlug"
$ProjectId = "identifiant-google-unique-a-choisir"
$Branch = "setup/extension"
```

| Ressource                       | Rôle                                              | Partage entre extensions                                                            |
| ------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Dépôt GitHub                    | Sources, contrôles, PR et secrets de livraison    | Dépôt distinct.                                                                     |
| Projet Google Cloud             | Activation de l'API et configuration OAuth        | Créer un projet dédié pour cette procédure.                                         |
| Client OAuth                    | Identité du programme qui publie                  | Nouveau client dédié.                                                               |
| Refresh token                   | Autorisation persistante accordée au client       | Nouveau token ; ne pas copier celui d'un autre projet.                              |
| Compte éditeur Chrome Web Store | Propriétaire des fiches et coordonnées publiques  | Peut être commun à plusieurs extensions.                                            |
| ID éditeur                      | Identifiant attribué à ce compte                  | Peut donc être identique entre plusieurs dépôts. Ce n'est pas un token à régénérer. |
| ID extension                    | Identifiant de la nouvelle fiche Chrome Web Store | Propre à chaque fiche ; ne jamais réutiliser celui d'une autre extension.           |

Les paramètres du compte éditeur ne sont pas ceux d'une fiche particulière. Son adresse e-mail de contact est commune : la modifier peut affecter toutes ses extensions. Vérifier aussi les coordonnées propres à chaque fiche. Une adresse commune doit être validée avec l'e-mail envoyé par Google.

## 5. Créer le dépôt avec gh

Toutes les opérations GitHub passent par `gh` : dépôts, branches distantes, fichiers, PR, secrets, réglages, workflows et releases. Les commandes Git locales restent adaptées à l'inspection et aux commits locaux.

Pour un dossier déjà préparé, vérifier les fichiers suivis et les exclusions avant un premier envoi :

```powershell
git init
git branch -M main
git add manifest.json package.json package-lock.json src README.md .gitignore
git commit -m "Initialiser la nouvelle extension"
gh repo create $Repository --private --source . --remote origin --push
```

Adapter la liste à la structure réelle et au gestionnaire choisi. Ne pas exécuter cette séquence sur un dépôt existant. Choisir explicitement sa visibilité ; ne pas rendre un dépôt public pour contourner une restriction de configuration.

Pour récupérer un dépôt existant :

```powershell
gh repo clone $Repository
gh pr list --repo $Repository --state open --json number,title,headRefName,baseRefName,url
```

Créer une branche de travail à partir de la bonne branche de base. Réutiliser la PR correspondant à la branche déjà ouverte. S'il existe plusieurs PR sans correspondance évidente, clarifier laquelle modifier.

## 6. Créer le projet Google avec gcloud

Privilégier les commandes Google officielles et passer `--project` explicitement pour éviter de modifier le projet actif d'un autre travail.

```powershell
gcloud projects create $ProjectId --name=$ExtensionName --no-enable-cloud-apis --quiet
gcloud projects describe $ProjectId --format="json(projectId,projectNumber,name,lifecycleState)"
gcloud billing projects describe $ProjectId --format=json
gcloud services enable chromewebstore.googleapis.com --project=$ProjectId --quiet
gcloud services list --enabled --project=$ProjectId --filter="name:chromewebstore.googleapis.com"
```

Si l'organisation impose un parent, déterminer celui-ci avec `gcloud organizations list`, puis fournir `--organization=ID` à la création. Ne pas inventer l'ID et ne pas réutiliser automatiquement celui d'un autre compte.

Cette création en ligne de commande évite de sélectionner par défaut un compte de facturation dans la console. Vérifier `billingEnabled` et ne pas rattacher un compte de facturation sans demande explicite. Si l'organisation impose une contrainte, la signaler au lieu de contourner sa politique.

## 7. Configurer OAuth : commandes d'abord, navigateur si nécessaire

### Identité et client

Dans les versions auditées, `gcloud iam oauth-clients` ne crée pas le type de client Google Auth Platform requis pour la portée Chrome Web Store. Il ne faut pas confondre ce mécanisme IAM avec les clients de publication.

Utiliser les commandes et API officielles. Lorsqu'une opération exige une interface graphique, fournir à l'utilisateur le lien et les étapes précises, puis le laisser les réaliser. Ne pas prendre le contrôle de son écran ou de son navigateur. Lui laisser également les étapes d'identification et de confirmation. Ne pas contourner un avertissement de sécurité ou une restriction d'autorisation.

1. Sélectionner le **nouveau projet**, puis Google Auth Platform.
2. Renseigner le nom de l'application, l'e-mail d'assistance et le contact du développeur.
3. Choisir une audience interne lorsque le compte éditeur appartient à l'organisation et que cet usage convient. L'OAuth décrit ici sert à la publication ; il n'impose pas une connexion OAuth aux utilisateurs de l'extension.
4. Si l'audience est externe, préparer le statut de production nécessaire à l'automatisation. Les tokens d'une application externe en test peuvent expirer après sept jours ; ne pas considérer un test ponctuel comme une configuration durable. [Durée de vie des tokens Google](https://developers.google.com/identity/protocols/oauth2#expiration)
5. Accepter les conditions applicables avec l'accord requis, puis créer un client **Application de bureau** dédié à la publication.
6. Télécharger son JSON dans le dossier temporaire ignoré. Vérifier son `project_id`. Ne pas fermer la boîte de création avant d'avoir conservé le fichier lorsque Google indique que le secret ne sera plus téléchargeable.

### Nouveau refresh token avec la portée utile

Demander uniquement `https://www.googleapis.com/auth/chromewebstore`, avec un accès hors ligne et le consentement de l'éditeur. Cette portée donne accès aux éléments que le compte éditeur peut gérer ; un client dédié ne limite pas à lui seul l'autorisation à une seule fiche.

Une commande `gcloud auth application-default login` avec `--client-id-file` et cette portée peut exiger aussi `cloud-platform`, comme observé avec la version 591.0.0. Ne pas ajouter silencieusement cette permission. Employer alors le flux officiel Google pour applications de bureau avec le client dédié et uniquement la portée nécessaire. [Flux officiel pour applications de bureau](https://developers.google.com/identity/protocols/oauth2/native-app)

Exemple de script temporaire, avec la bibliothèque officielle `google-auth-oauthlib` fournie par le SDK installé :

```python
import pathlib
import sys

from google_auth_oauthlib.flow import InstalledAppFlow

flow = InstalledAppFlow.from_client_secrets_file(
    sys.argv[1],
    scopes=["https://www.googleapis.com/auth/chromewebstore"],
    autogenerate_code_verifier=True,
)
credentials = flow.run_local_server(
    host="127.0.0.1",
    port=0,
    timeout_seconds=300,
    access_type="offline",
    prompt="consent",
    authorization_prompt_message="Autorisation de publication ouverte dans le navigateur.",
    success_message="Autorisation terminée. Vous pouvez fermer cet onglet.",
)
pathlib.Path(sys.argv[2]).write_text(credentials.to_json(), encoding="utf-8")
```

Exécuter dans une session PowerShell dédiée pour ne pas modifier l'environnement des autres travaux :

```powershell
$PrivateDir = Read-Host "Chemin absolu du dossier temporaire ignoré déjà créé"
$ClientFile = Read-Host "Chemin du JSON du nouveau client"
$SdkRoot = Split-Path -Parent (Split-Path -Parent (Get-Command gcloud).Source)
$env:PYTHONPATH = Join-Path $SdkRoot "lib/third_party"
$GooglePython = Join-Path $SdkRoot "platform/bundledpython/python.exe"
& $GooglePython (Join-Path $PrivateDir "authorize-extension.py") $ClientFile (Join-Path $PrivateDir "oauth-credentials.json")
```

Vérifier les chemins et les bibliothèques de l'installation utilisée. Le callback écoute seulement sur l'interface locale. Vérifier ensuite qu'un échange du refresh token contre un access token réussit et que la portée retournée correspond à Chrome Web Store, sans imprimer les tokens ou la réponse complète.

Ne pas écraser les credentials globaux d'un autre programme pour effectuer ce flux. Pour une commande qui utilise ADC, vérifier le chemin réellement ciblé par `CLOUDSDK_CONFIG` avant de l'exécuter.

## 8. Créer une extension réellement chargeable

Créer `manifest.json` à la racine avant de demander un chargement non empaqueté. Utiliser Manifest V3, des fichiers locaux et des correspondances limitées au site cible.

Exemple de structure modulaire :

```text
manifest.json
package.json
package-lock.json
README.md
PRIVACY.md
CHROME_EXTENSION_STARTUP.md
src/
  content.js
  data.js
  ui.js
  panel.css
scripts/
  build-extension.mjs
  check-extension.mjs
  check-version.mjs
  check-release-note.mjs
  check-chrome-store-credentials.mjs
tests/
release-notes/
.github/workflows/
```

Le gestionnaire pnpm utilise son propre lockfile à la place de celui de npm. Conserver la structure existante lorsque le projet en a déjà une.

```json
{
  "manifest_version": 3,
  "name": "Ma nouvelle extension",
  "version": "0.1.0",
  "description": "Description précise de la fonction utilisateur.",
  "content_scripts": [
    {
      "matches": ["https://example.com/*"],
      "js": ["src/content.js"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["src/data.js", "src/ui.js", "src/panel.css"],
      "matches": ["https://example.com/*"]
    }
  ]
}
```

Remplacer le domaine et créer effectivement chaque ressource référencée. Un script de contenu classique peut charger les modules déclarés avec `import(chrome.runtime.getURL(...))`. Les ressources déclarées deviennent accessibles au site correspondant : limiter leur liste aux besoins réels. [Scripts de contenu Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)

Ajouter uniquement les permissions nécessaires : `storage` pour une conservation justifiée, un service worker pour des fonctions d'arrière-plan et des domaines API supplémentaires si l'architecture le demande. Ne pas reprendre les permissions d'un autre manifeste sans raison.

## 9. Interface intégrée au site

Pour une extension qui enrichit un site, l'entrée principale est un **bouton flottant dans la page qui ouvre un panneau latéral**, comme Manuvie et BNRI. Une popup Chrome seule ne remplit pas cette exigence.

- Reprendre la police, les couleurs, les espacements, les surfaces, les boutons et la densité du site. Réutiliser ses composants génériques ou ceux déjà présents dans le projet lorsque c'est possible. Privilégier le framework CSS existant avant d'ajouter du CSS spécifique.
- Isoler les styles pour ne pas altérer le portail : Shadow DOM ou sélecteurs strictement préfixés, selon le projet. Conserver la police du site et éviter un second design system inutile.
- Prévoir l'ouverture, la fermeture, le retour du focus au bouton, les libellés accessibles, la recherche lorsque pertinente, les états de chargement, d'absence de données et d'erreur.
- Afficher la version dans le bouton et l'en-tête, depuis `chrome.runtime.getManifest().version`. Ne pas dupliquer une version écrite en dur dans l'interface.
- Traiter les changements de route d'une application monopage et l'arrivée différée des données. Un observateur ne doit pas reboucler sur les propres mutations de l'extension ni perturber les événements du site.
- Conserver les choix de l'utilisateur, par exemple le restaurant ouvert, lors d'un rafraîchissement des données.
- Indiquer les limites réelles : données chargées seulement, aperçu des articles, cache, calcul estimé ou période couverte.

Toute modification visuelle nécessite une capture **analysée** sur grand écran et, lorsque pertinent, petit écran. Vérifier aussi le rendu sur le vrai site autorisé : absence de débordement, texte lisible, styles cohérents, bouton accessible et fermeture fonctionnelle. Corriger et refaire la capture si elle ne correspond pas à la demande. Une capture de fixture seule ne prouve pas la lecture des données réelles.

## 10. Versions, release notes et confidentialité

Chaque modification livrée doit augmenter la version. Incrémenter une fois par ensemble de modifications livré, pas à chaque frappe ou génération de capture. Utiliser un correctif pour une évolution compatible, une version mineure pour une nouvelle fonctionnalité et une majeure pour une incompatibilité.

Conserver une version cohérente dans `manifest.json`, `package.json` et les métadonnées de version du lockfile lorsqu'elles existent. Faire régénérer les fichiers générés par le gestionnaire du projet. Dans UberEatHabits :

```powershell
npm run version:bump
npm run version:check
```

Dans les autres projets, réutiliser leur mécanisme ou ajouter un script de synchronisation avant d'en faire une commande obligatoire. `npm version patch --no-git-tag-version` met à jour les métadonnées npm ; le manifeste nécessite un hook de synchronisation. Ne pas annoncer un automatisme absent.

Le contrôle CI doit comparer avec la bonne base Git : branche de base de la PR, ou commit précédent approprié sur `main`. Télécharger l'historique nécessaire. Comparer les composantes numériques, pas les chaînes lexicographiquement. Chrome accepte une version numérique de un à quatre composants ; le format de travail recommandé ici reste `X.Y.Z`. [Version du manifeste](https://developer.chrome.com/docs/extensions/reference/manifest/version)

Créer ou compléter `release-notes/vX.Y.Z.md` pour la version livrée. Conserver les conventions du dépôt :

```markdown
# vX.Y.Z

## Summary

Résultat concret pour l'utilisateur.

## Changes

- Changements significatifs de cette version.

## Validation

- Contrôles réellement exécutés et leurs résultats.

## Screenshots

- Captures pertinentes si l'interface change ; sinon, indiquer le motif.
```

Nettoyer et ordonner les imports des sources modifiées. Garder le diff limité au sujet. Ne pas modifier les fichiers générés manuellement et ne pas ajouter de tests qui reproduisent simplement l'implémentation.

Créer `PRIVACY.md` : quelles données sont lues, où elles sont traitées, ce qui est conservé, comment l'effacer et ce qui est transmis. Le texte et les déclarations Chrome Web Store doivent correspondre au code réel. Un profil de test isolé ne doit jamais embarquer les identifiants de publication.

## 11. Construire et contrôler le ZIP

Le script `build` doit utiliser une **liste explicite de fichiers autorisés**. Inclure le manifeste, les scripts et styles de l'extension, ses icônes et les dépendances locales réellement requises. Le manifeste doit être à la racine du ZIP.

Exclure dépendances de développement, profils, secrets, exports réseau, tests, captures, ce guide et release notes. Vérifier notamment les modules importés dynamiquement et ressources accessibles déclarées. Ne pas zipper tout le dépôt. Le build C411 observé inclut aussi sa documentation : décider explicitement des fichiers utiles plutôt que reproduire cette liste sans examen.

Produire une archive identifiable, par exemple `dist/ma-nouvelle-extension-0.1.0-chrome-store.zip`, puis tester **son contenu extrait**, pas uniquement le dossier source. Vérifier les chemins, les permissions, la version et les icônes. Garder une trace du commit source et de l'empreinte de l'archive publiée.

Dans `chrome://extensions` : charger le dossier extrait, vérifier le panneau et les données, les erreurs de l'extension et les fonctions d'arrière-plan lorsqu'elles existent. Après chaque mise à jour locale, recharger l'extension **et** l'onglet cible ; un simple rafraîchissement du site ne met pas toujours à jour le manifeste installé.

## 12. Créer la fiche Chrome Web Store et enregistrer les secrets

Créer une **nouvelle fiche** depuis le tableau de bord de l'éditeur avec le premier ZIP prêt à être testé. Cette étape fournit son ID ; on ne peut pas remplacer ce dernier par celui d'une extension existante pour compléter la configuration.

Vérifier le compte Google, l'ID éditeur, la validation de l'adresse de contact, la validation en deux étapes requise, les visuels, la description, l'objectif unique, les permissions, la politique de confidentialité et la visibilité souhaitée. Remplir les champs de la fiche et de confidentialité avant la première publication. [Préparer l'accès à Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api)

Enregistrer avec `gh` :

| Secret                 | Valeur à utiliser                                   |
| ---------------------- | --------------------------------------------------- |
| `CHROME_CLIENT_ID`     | Nouveau client OAuth du projet.                     |
| `CHROME_CLIENT_SECRET` | Secret de ce client.                                |
| `CHROME_REFRESH_TOKEN` | Nouveau token de publication obtenu pour ce client. |
| `CHROME_PUBLISHER_ID`  | ID du compte éditeur propriétaire de la fiche.      |
| `CHROME_EXTENSION_ID`  | ID de la nouvelle fiche.                            |

Exemple sans inscrire les valeurs dans la ligne de commande :

```powershell
$OAuth = Get-Content (Join-Path $PrivateDir "oauth-credentials.json") -Raw | ConvertFrom-Json
$OAuth.client_id | gh secret set CHROME_CLIENT_ID --repo $Repository
$OAuth.client_secret | gh secret set CHROME_CLIENT_SECRET --repo $Repository
$OAuth.refresh_token | gh secret set CHROME_REFRESH_TOKEN --repo $Repository
$PublisherId | gh secret set CHROME_PUBLISHER_ID --repo $Repository
$ExtensionId | gh secret set CHROME_EXTENSION_ID --repo $Repository
gh secret list --repo $Repository
```

Définir `$PublisherId` et `$ExtensionId` depuis les ressources vérifiées, pas depuis un autre dépôt. Le token automatique `GITHUB_TOKEN` des workflows ne nécessite pas de nouveau secret personnel. Ne pas afficher les valeurs ; la liste des noms suffit à contrôler leur présence.

Le test complet échange le refresh token, puis appelle `publishers.items.fetchStatus` avec **le couple éditeur/extension** attendu. Un test OAuth seul ne valide pas cette association. Garder ces deux contrôles distincts tant que la fiche n'est pas créée. Supprimer les copies temporaires du token après enregistrement et validation. Conserver les credentials de publication hors de l'extension installée.

## 13. Régler GitHub pour la CI/CD

Examiner les réglages existants avant toute modification :

```powershell
gh api "repos/$Repository/actions/permissions"
gh api "repos/$Repository/actions/permissions/workflow"
gh api "repos/$Repository/branches/main/protection"
gh workflow list --repo $Repository
```

Les valeurs de base recommandées sont `contents: read`, les Actions activées avec les actions nécessaires autorisées et aucun droit de création/approbation de PR pour les workflows qui n'en ont pas besoin. Donner `contents: write` seulement au job qui crée la release ; les droits d'annotation ou de commentaire restent limités aux jobs concernés.

Pour un dépôt neuf, une politique de protection peut être enregistrée dans un JSON puis appliquée avec `gh api --method PUT repos/$Repository/branches/main/protection --input CHEMIN_JSON`. Définir les vérifications réellement produites, interdire les force-push et choisir explicitement la politique de revue. Pour un dépôt existant, préserver ses exigences et ajouter les vérifications nécessaires sans remplacer sa politique entière.

Exemple de corps pour un **nouveau dépôt personnel**, après avoir vérifié les noms des checks :

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Validate Chrome Extension", "Build Chrome Extension"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

Le nombre de revues est à choisir selon l'équipe ; ne pas imposer une approbation impossible à obtenir à un développeur seul. Si un environnement de déploiement est souhaité, le créer avec `gh api --method PUT repos/$Repository/environments/chrome-store`, puis configurer ses protections et le référencer explicitement dans le job. La simple création de l'environnement ne configure pas de validation humaine.

Exiger les **noms exacts et uniques des jobs** visibles dans les checks, par exemple `Validate Chrome Extension` et `Build Chrome Extension`, après leur première exécution. Vérifier avec `gh pr checks`. Ne pas exiger un nom de workflow qui ne correspond à aucun status check. La disponibilité de la protection dépend de la visibilité et de l'offre GitHub ; un refus ne justifie pas de rendre le dépôt public ou de changer l'abonnement sans décision explicite. [Protection des branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

Les PR de forks ne reçoivent pas les secrets et leur token est limité. Les tests et le build doivent fonctionner sans secrets de publication. Ne pas utiliser `pull_request_target` pour exécuter du code non fiable avec des secrets. Les commentaires de synthèse et les rapports doivent tenir compte de ces permissions. [Événements GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)

## 14. Workflows PR Validation et Build

Standardiser d'abord les scripts du nouveau dépôt. Les exemples ci-dessous attendent `ci:validate` pour les contrôles applicables hors packaging et `build` pour l'archive. Adapter npm/pnpm, le cache et les versions d'actions aux conventions réellement choisies. Ne pas copier une commande absente du `package.json`.

`ci:validate` doit couvrir le format, les imports et le lint, la vérification de types si applicable, les versions cohérentes et augmentées, la release note, les tests métier utiles et les tests navigateur. Manuvie, BNRI et UglyPadlet appliquent un seuil de couverture de 90 % ; conserver leurs seuils. Le build et la note de version ne doivent pas être validés uniquement par l'existence d'un fichier.

Exemple de `.github/workflows/pr-validation.yml` :

```yaml
name: PR Validation
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: validation-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  validate:
    name: Validate Chrome Extension
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run ci:validate
      - uses: actions/upload-artifact@v7
        if: always()
        with:
          name: validation-${{ github.sha }}
          path: |
            test-results/
            playwright-report/
            coverage/
```

Adapter les chemins des captures. Si elles résident dans un dossier caché, activer `include-hidden-files: true` **uniquement avec une liste ciblée de fichiers sûrs** ; ne jamais archiver tout le dossier temporaire, qui peut contenir des credentials.

Exemple de `.github/workflows/build.yml` :

```yaml
name: Build
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
jobs:
  build:
    name: Build Chrome Extension
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v7
        with:
          name: chrome-store-package-${{ github.sha }}
          path: dist/*-chrome-store.zip
          if-no-files-found: error
```

Les versions majeures d'actions ci-dessus sont celles observées pendant l'audit ; vérifier leur disponibilité et les versions approuvées avant un nouveau bootstrap. Préférer les références immuables validées lorsque le dépôt les impose.

Éviter un job qui continue après une erreur sans rendre la validation finale bloquante. Les workflows de référence qui collectent plusieurs résultats terminent par un garde-fou explicite.

## 15. Déploiement manuel et releases

Le build sur une PR ne publie rien. Le workflow de déploiement doit partir d'un commit identifié, valider ses contrôles et sa release note, produire l'archive puis vérifier les credentials avant l'envoi.

Sérialiser les déploiements d'une même extension avec un groupe `concurrency` et `cancel-in-progress: false` pour ne pas interrompre une publication déjà commencée. Fixer le commit source au début du run et conserver le même commit pour les tests, le ZIP, la release et l'envoi au Store.

Les options observées dans les projets de référence sont :

```yaml
workflow_dispatch:
  inputs:
    dry_run:
      type: boolean
      default: true
    publish_to_chrome_store:
      type: boolean
      default: false
    create_github_release:
      type: boolean
      default: false
```

Ces entrées font partie de `on:` dans le workflow complet. Une option ne doit avoir d'effet que si le job correspondant existe. Le job Chrome Web Store s'exécute uniquement lors du déclenchement manuel ; l'upload/publication exige `!inputs.dry_run && inputs.publish_to_chrome_store`. Le job de release exige `!inputs.dry_run && inputs.create_github_release`.

Réutiliser les scripts de contrôle et de build audités, en adaptant leurs noms et listes de fichiers. Transmettre les secrets par variables d'environnement. Ne pas écrire un token dans les logs, un argument de processus, un artefact ou un ZIP. Éviter `set -x` et les messages d'erreur qui réimpriment une réponse OAuth complète.

Pour l'API v2, le script de publication appelle l'upload du ZIP puis la publication de **la fiche attendue**, avec un access token obtenu à l'exécution. Contrôler chaque réponse, puis l'état de revue/publication : un téléversement réussi ne signifie pas que la version est déjà publique. Une modification de visibilité peut nécessiter une publication manuelle dans le tableau de bord. [API de publication](https://developer.chrome.com/docs/webstore/api/reference/rest)

Déclenchement de contrôle, lorsque ces entrées existent :

```powershell
gh workflow run deploy.yml --repo $Repository --ref main -f dry_run=true -f publish_to_chrome_store=false -f create_github_release=false
gh run list --repo $Repository --workflow deploy.yml --limit 5
gh run watch ID_DU_RUN --repo $Repository --exit-status
```

Après validation et décision de publication, utiliser `dry_run=false` et `publish_to_chrome_store=true`. Ne pas ajouter une publication automatique sur toutes les PR ou tous les push.

Pour les releases GitHub, choisir **un seul responsable** : soit `release.yml` sur un tag `v*`, soit l'option du déploiement. Les références comportent ces deux approches ; les activer ensemble sans coordination crée une course ou un doublon.

Avec l'approche par tag :

```powershell
$CommitSha = gh api "repos/$Repository/git/ref/heads/main" --jq .object.sha
gh api --method POST "repos/$Repository/git/refs" -f "ref=refs/tags/v$Version" -f "sha=$CommitSha"
```

Le workflow `release.yml` doit vérifier que le tag correspond au manifeste, exécuter la validation, construire le ZIP et créer la release avec `release-notes/vX.Y.Z.md` comme description. Une release GitHub n'est pas une publication Chrome Web Store.

Si la release est créée manuellement avec `gh` et qu'aucun workflow ne s'en charge :

```powershell
gh release create "v$Version" $ZipPath --repo $Repository --verify-tag --title "$ExtensionName v$Version" --notes-file "release-notes/v$Version.md"
```

Le premier workflow manuel doit déjà exister sur la branche principale pour être proposé par GitHub. La création d'un tag ne doit pas être un moyen de livrer un commit encore en PR.

## 16. Commits, publication de branche et PR avec gh

Une livraison de plusieurs fichiers doit rester un commit cohérent : guide, version et release note, par exemple. Ne pas publier chaque fichier par une succession de commits qui laisseraient temporairement les versions incohérentes.

Pour créer une branche distante avec `gh`, partir du SHA vérifié de la branche de base :

```powershell
$BaseSha = gh api "repos/$Repository/git/ref/heads/main" --jq .object.sha
gh api --method POST "repos/$Repository/git/refs" -f "ref=refs/heads/$Branch" -f "sha=$BaseSha"
```

Pour mettre à jour une branche existante via l'API GitHub, `createCommitOnBranch` accepte une liste de chemins/contenus et le SHA attendu. Exemple à adapter à la liste **explicite** des fichiers de la livraison :

```powershell
$Files = @("CHROME_EXTENSION_STARTUP.md", "manifest.json", "package.json", "package-lock.json")
$HeadSha = gh api "repos/$Repository/git/ref/heads/$Branch" --jq .object.sha
$Additions = @($Files | ForEach-Object {
  @{ path = $_; contents = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path (Get-Location) $_))) }
})
$Request = @{
  query = 'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid url } } }'
  variables = @{
    input = @{
      branch = @{ repositoryNameWithOwner = $Repository; branchName = $Branch }
      expectedHeadOid = $HeadSha
      message = @{ headline = "Documenter le démarrage de l'extension" }
      fileChanges = @{ additions = $Additions }
    }
  }
}
$Request | ConvertTo-Json -Depth 10 -Compress | gh api graphql --input -
```

Cette publication crée un vrai commit distant. La liste doit aussi inclure les suppressions lorsque le changement en comporte. Vérifier le résultat avant de synchroniser le checkout local. Ne pas forcer la synchronisation d'un dossier sale ; conserver sa copie de travail et sa branche intactes ou utiliser le checkout isolé.

Préparer la description dans un fichier UTF-8, puis réutiliser ou créer la PR :

```powershell
gh pr list --repo $Repository --state open --head $Branch --json number,url,title
gh pr create --repo $Repository --base main --head $Branch --title "Documenter le démarrage de l'extension" --body-file $PrBodyPath
gh pr checks NUMERO_PR --repo $Repository
```

La seconde commande s'utilise seulement si aucune PR correspondante n'existe. Pour une PR existante, ajouter les commits à sa branche et conserver son contexte. Ne pas dupliquer la PR, mélanger les travaux locaux ou fusionner sans demande. Attendre les checks requis et distinguer un échec nouveau d'un problème déjà présent.

## 17. Vérifications avant de déclarer l'environnement prêt

- Le dossier est relié au bon dépôt et le manifeste se charge réellement dans Chrome.
- La documentation API ou l'analyse réseau justifie la source de données, les routes et la pagination utilisées.
- Le panneau et son bouton s'intègrent au site ; les captures ont été analysées et la lecture réelle comparée au site.
- La version est visible, synchronisée et supérieure à la précédente ; la release note correspond au changement.
- Les tests, le format, les contrôles de types utiles, la couverture applicable et le build passent sans secrets de publication.
- Le ZIP contient uniquement l'extension attendue, et un chargement de cette archive extraite a été testé.
- Le projet, le client et le refresh token sont dédiés ; l'ID éditeur et l'ID extension ont été vérifiés séparément.
- Les cinq secrets sont présents lorsque la fiche existe ; l'échange OAuth et l'accès à cette fiche ont été testés séparément.
- Les workflows PR Validation, Build, déploiement et release existent réellement, avec leurs droits et déclencheurs vérifiés.
- La branche principale exige les bons checks lorsque l'offre le permet. Aucun changement de visibilité ou de facturation n'a été fait implicitement.
- La branche de travail est publiée et sa PR créée ou réutilisée. Les autres travaux locaux sont préservés.
- L'état final distingue précisément : développement local, contrôles réussis, fiche créée, ZIP téléversé, revue en cours et version publiée.

## 18. État constaté et entretien du guide

L'audit initial a trouvé des protections de branche et des configurations de publication à des niveaux d'avancement différents. Vérifier ces réglages dépôt par dépôt : l'ajout de ce guide ne les active pas et ne modifie pas les offres GitHub, la visibilité, les comptes éditeurs ou les permissions.

Block New Tab n'a pas de dépôt Git dans le dossier audité ; il sert de référence locale et reste hors des commits/PR de cette diffusion. Une ancienne sauvegarde d'UglyPadlet n'est pas un dépôt à publier.

Conserver une copie identique de ce guide dans les dépôts concernés. Pour une évolution commune, examiner les PR ouvertes, propager la même révision, adapter seulement les notes de version propres à chaque dépôt et vérifier les règles locales. Réauditer les versions d'outils, les politiques Google/GitHub et les workflows avant un nouveau démarrage.
