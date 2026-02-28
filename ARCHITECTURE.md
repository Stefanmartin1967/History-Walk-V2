# Architecture & Flux de Données

Ce document explique le mécanisme de surcharge des données au sein de l'application History Walk, et particulièrement la différence entre les données officielles et les données locales de l'utilisateur.

## Le principe de base

L'application fonctionne selon le principe d'une **carte officielle en lecture seule**, sur laquelle viennent se superposer des **calques de modifications locales**.

*   **Le Fichier Source (`djerba.geojson`) :** Hébergé sur le serveur (GitHub), c'est la vérité officielle partagée par tous. Il n'est jamais modifié directement par le navigateur de l'utilisateur.
*   **La Base Locale (IndexedDB) :** Le navigateur de chaque utilisateur (ou administrateur) possède sa propre base de données locale où sont stockées ses modifications personnelles.

Lorsque l'application démarre, elle télécharge la carte officielle puis y "fusionne" à la volée, en mémoire (RAM), les données locales. Ainsi, chaque utilisateur voit une carte qui lui est propre (avec ses lieux visités, ses notes, etc.).

## `userData` vs `customFeatures`

La sauvegarde locale se divise en deux concepts clés pour gérer l'ajout ou la modification de lieux :

### 1. `customFeatures` (Les Nouveaux Lieux)

C'est un tableau stocké localement qui contient des **objets géographiques complets** (des `Features` GeoJSON avec des coordonnées `[lng, lat]`, un type `Point`, et un bloc `properties` complet).

*   **Rôle :** Il ne contient **que** les lieux qui ont été créés de zéro manuellement par l'utilisateur (via le bouton "Créer un lieu" ou l'import de données externes) et qui **n'existent pas du tout** dans la carte officielle.
*   **Fonctionnement :** Au chargement, ces lieux entiers sont injectés dans la liste des lieux à afficher, comme une extension de la carte officielle.

### 2. `userData` (Le Calque de Modification)

C'est un dictionnaire (`Objet` JavaScript) stocké localement, où la clé est l'ID du lieu (`HW_ID`) et la valeur est un objet contenant uniquement les **champs modifiés**.

*   **Rôle :** Il stocke **uniquement les différences** par rapport aux données originales. Cela s'applique aussi bien pour un lieu officiel (issu de `djerba.geojson`) que pour un lieu personnalisé (issu de `customFeatures`).
*   **Contenu typique :** Le fait qu'un lieu ait été visité (`vu: true`), qu'il soit planifié (`planifieCounter: 1`), qu'une catégorie ait été corrigée, qu'une note personnelle ait été ajoutée, ou même qu'un lieu officiel ait été virtuellement déplacé (nouvelles coordonnées `lat`/`lng`).
*   **Fonctionnement :** Lors de l'affichage d'un point sur la carte ou dans le panneau latéral, l'application lit l'objet GeoJSON original, mais **donne toujours la priorité** aux valeurs trouvées dans `userData` pour cet ID précis. C'est un mécanisme "d'écrasement" en mémoire.

### Exemple concret

Dans un fichier de sauvegarde (`.json` ou `.txt`), vous pouvez observer ce motif :

```json
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [ 10.854611, 33.723778 ] },
  "properties": {
    "HW_ID": "HW-01...",
    "Nom du site FR": "Atelier de poterie Fathi",
    "Catégorie": "Site historique",
    "userData": {
      "Catégorie": "Culture et tradition",
      "vu": true,
      "notes": "Très beau travail artisanal."
    }
  }
}
```

*   L'objet "racine" est la donnée telle qu'elle existe (ou existait) officiellement.
*   Le sous-objet `userData` représente le calque de l'utilisateur. Au rendu, l'application verra que cet atelier est visité, lira la note, et affichera l'icône correspondant à "Culture et tradition" (surchargeant "Site historique").

## Le rôle de la Console Fusion ++ (Mode Admin)

La Console Fusion ++ est l'outil exclusif des administrateurs pour propager les modifications locales vers la carte officielle.

1.  L'admin utilise l'application normalement, modifie des descriptions ou catégories, déplace des points (ce qui remplit son `userData` local) et crée de nouveaux lieux (remplissant son `customFeatures` local).
2.  Il ouvre la Console Fusion ++.
3.  L'outil télécharge la carte officielle (`djerba.geojson`) et la compare avec la base locale de l'admin (`userData` + `customFeatures`).
4.  L'outil liste toutes les différences ("Vous avez corrigé la catégorie de l'Atelier Fathi", "Vous avez ajouté un nouveau café").
5.  L'admin valide ces changements.
6.  L'outil **"aplatit"** (fusionne définitivement) le calque `userData` dans les propriétés officielles pour les points modifiés, et insère les `customFeatures` dans la liste globale. (Les données strictement personnelles comme `vu` ou `planifieCounter` sont ignorées lors de cet aplatissement).
7.  L'outil génère un nouveau fichier `djerba.geojson` consolidé et le téléverse sur le serveur (GitHub).
8.  Ce fichier devient la nouvelle référence pour **tous** les utilisateurs au prochain chargement de leur application.
