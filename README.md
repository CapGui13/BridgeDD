# Bridge DD

Application de bridge **double dummy** pour iPhone (PWA) et ordinateur.

[**Ouvrir Bridge DD**](https://capgui13.github.io/BridgeDD/)

Fonctionnement : importer une capture de donne FFB, sélectionner le contrat et le déclarant, puis jouer en suivant les coups optimaux calculés par DDS. Les cartes optimales sont vertes, les alternatives perdantes noires et les cartes jouées grisées. Un tableau « Double dummy » récapitule les contrats réalisables dans toutes les positions.

## Organisation

- `src/` : **sources maintenues dans ce dépôt** (interface, reconnaissance FFB, tests, manifest et icônes)
- `docs/` : site généré automatiquement depuis `src/`, à publier avec GitHub Pages
- `.github/workflows/build.yml` : construction autonome avec le moteur libre [DDS](https://github.com/dds-bridge/dds)

## Publication GitHub Pages

Dans **Settings → Pages**, choisir **Deploy from a branch**, la branche **main**, et le dossier **/docs**. Le site du dépôt sera accessible à https://capgui13.github.io/BridgeDD/.

Les sources ont été initialement déplacées depuis le dépôt `CapGui13/capgui13.github.io`. Pendant la transition, l'ancienne copie n'est pas effacée afin d'éviter toute interruption.

## Développement

Modifier `src/` puis pousser sur `main`. L'action de construction régénère `docs/` et y inclut DDS Web (WASM), l'OCR sur l'appareil, les icônes PWA et le service worker de compatibilité.

Le code de l'interface de Bridge DD et les ressources tierces conservent leurs licences respectives. Les composants DDS sont accompagnés de leur fichier `DDS_LICENSE.txt` dans la version publiée.
