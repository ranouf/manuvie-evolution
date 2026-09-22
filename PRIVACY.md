# Politique de confidentialité

Dernière mise à jour : 21 septembre 2026

Manuvie Évolution est une extension Chrome qui ajoute un panneau d’analyse directement dans le portail Gestion de patrimoine Manuvie.

## Données traitées

L’extension lit uniquement les données déjà accessibles à l’utilisateur connecté dans le portail Manuvie, par exemple les comptes, valeurs marchandes, transactions, cotisations, frais et historiques de performance nécessaires aux calculs affichés.

Ces données servent seulement à afficher localement les gains, rendements, frais, cotisations et graphiques dans le navigateur.

## Collecte et transmission

Manuvie Évolution ne collecte aucune donnée sur un serveur, ne crée aucun compte utilisateur, ne vend aucune donnée et ne transmet aucune donnée financière à l’éditeur de l’extension ou à des tiers.

Les identifiants, mots de passe et codes d’authentification Manuvie ne sont jamais lus, stockés ou transmis par l’extension.

## Stockage local

L’extension peut conserver localement, dans le stockage Chrome du profil courant, certaines données déjà chargées depuis le portail afin d’éviter de recharger les années passées et d’accélérer l’affichage.

Ce cache reste sur l’appareil de l’utilisateur. Il est utilisé uniquement par l’extension dans le portail Manuvie.

## Permissions

L’autorisation `storage` permet de conserver ce cache local et les préférences nécessaires au fonctionnement de l’extension.

Les autorisations d’hôte sont limitées au portail Manuvie et à son API associée. Elles sont nécessaires pour exécuter l’extension dans le portail et lire les réponses autorisées par la session Manuvie de l’utilisateur connecté.

## Code distant

Toute la logique JavaScript de l’extension est incluse dans le package publié. L’extension ne charge pas de script distant et n’utilise pas de code JavaScript ou WebAssembly externe pour son fonctionnement.

L’extension interagit avec le portail Manuvie et son API afin de lire les données de l’utilisateur connecté, mais elle n’exécute pas de code provenant de ces réponses.

## Contact

Pour signaler un bug ou envoyer une suggestion, utilisez la page d’assistance du projet : <https://github.com/ranouf/manuvie-evolution/issues>.
