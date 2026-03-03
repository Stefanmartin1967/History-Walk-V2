import re

with open('rapport_analyse.md', 'r') as f:
    content = f.read()

replacement = r"""### Phase 9 : Découplage et Optimisation de la Carte (`src/map.js`) (Recommandation pour la suite)
Maintenant que le code et les données sont robustes, la prochaine étape logique est de s'attaquer au cœur visuel de la version PC : la Carte.

*   **Le besoin actuel** :
    *   Le fichier `src/map.js` est encore un peu trop monolithique. Il mélange la configuration technique de Leaflet (la bibliothèque de cartographie) avec la logique métier pure de History Walk (la création complexe du HTML des popups, la gestion des icônes spécifiques selon le statut visité/planifié).
*   **L'objectif de cette phase (Phase 9)** :
    *   **Nettoyage de `map.js`** : Extraire la logique de création des infobulles (popups) et des icônes dynamiques vers un ou plusieurs fichiers dédiés (ex: `src/map-ui.js` ou `src/map-popups.js`).
    *   **Optimisation du Rendu (PC)** : Permettre de rafraîchir le statut visuel d'un seul marqueur sans avoir à recalculer toute la couche de la carte.

"""

# We need to replace the Phase 9 we just added.
content = re.sub(r'### Phase 9 : Optimisation des Performances de la Carte.*?$', replacement + "\n\n---", content, flags=re.DOTALL | re.MULTILINE)

with open('rapport_analyse.md', 'w') as f:
    f.write(content)
