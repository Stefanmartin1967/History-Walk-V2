import re

with open('rapport_analyse.md', 'r') as f:
    content = f.read()

replacement = r"""### Phase 8 : Fiabilisation des Sauvegardes et Imports (Terminée 🎉)
*   **Objectif** : Sécuriser les données entrantes et sortantes de l'utilisateur (fichiers de sauvegarde JSON, imports GPX).
*   **Bilan des Actions Réalisées** :
    1.  **Sécurisation de l'Importation** : Ajout d'une validation stricte (`isValidBackup`) dans `src/fileManager.js`. Avant d'importer une sauvegarde, l'application vérifie son intégrité (version, structure des objets). Un fichier corrompu est bloqué avec un message d'erreur, protégeant ainsi la base de données locale.
    2.  **Fiabilisation de l'Exportation** : Création d'un nettoyeur de données récursif (`cleanDataForExport`). Avant la création d'un fichier de sauvegarde, la mémoire est scannée pour purger d'éventuelles valeurs `null` ou corrompues, garantissant un export 100% sain.
    3.  **Nettoyage du Moteur GPX** : Découplage du fichier `src/gpx.js`. Les calculs complexes liés aux statistiques des circuits ont été déplacés vers `src/circuit-actions.js`. `gpx.js` ne gère désormais plus que la lecture et l'écriture pures du format XML.

### Phase 9 : Optimisation des Performances de la Carte (Recommandation pour la suite)
Maintenant que le code et les données sont robustes, la prochaine étape logique est de s'attaquer aux performances visuelles.

*   **Le besoin actuel** :
    *   Le fichier `src/map.js` gère l'affichage de centaines de lieux (POIs). Sur de vieux téléphones, le redessin de la carte lors d'un filtrage peut provoquer des saccades.
*   **L'objectif de cette phase (Phase 9)** :
    *   **Nettoyage de `map.js`** : Séparer la logique de configuration de la carte (Leaflet) de la logique métier (création des popups, gestion des icônes dynamiques).
    *   **Optimisation du Rendu** : Éviter les rechargements complets de marqueurs quand seul l'état d'un seul lieu change.

"""

content = re.sub(r'### Phase 8 : Fiabilisation des Sauvegardes et Imports \(Recommandation pour la suite\).*?(?=\n---)', replacement, content, flags=re.DOTALL)

with open('rapport_analyse.md', 'w') as f:
    f.write(content)
