import { state } from './state.js';
import { getPoiId, getPoiName } from './data.js';
import { showAlert } from './modal.js';
import { createIcons, icons } from 'lucide';
import { uploadFileToGitHub, getStoredToken } from './github-sync.js';
import { showToast } from './toast.js';

let originalData = null;
let currentPendingChanges = { newPois: [], gpsUpdates: [], contentUpdates: [], deletes: [] };

export async function openAdminFusionConsole() {
    // Basic UI Setup
    const html = `
        <div id="fusion-plus-container" style="display:flex; flex-direction:column; height:85vh; width:min(900px, 95vw); font-family:'Inter',sans-serif; color:var(--ink);">
            <div style="padding:20px; border-bottom:1px solid #E5E7EB; display:flex; justify-content:space-between; align-items:center; background:#FFFBEB; border-radius:16px 16px 0 0;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i data-lucide="git-merge" style="color:var(--amber);"></i>
                    <h2 style="margin:0; font-size:1.2rem;">Console Fusion ++</h2>
                </div>
                <div id="fusion-status" style="font-size:0.9rem; font-weight:600; color:var(--ink-soft);">
                    <i data-lucide="loader-2" class="spin" style="width:16px;height:16px;"></i> Chargement des données...
                </div>
            </div>

            <div id="fusion-content" style="flex:1; overflow-y:auto; padding:20px; background:#F8FAFC;">
                <div style="text-align:center; padding:40px; color:#64748B;">
                    Analyse en cours...
                </div>
            </div>

            <div style="padding:15px 20px; border-top:1px solid #E5E7EB; background:white; display:flex; justify-content:space-between; align-items:center; border-radius:0 0 16px 16px;">
                <button class="custom-modal-btn secondary" onclick="document.getElementById('custom-modal-overlay').classList.remove('active')">Annuler</button>
                <button id="btn-fusion-publish" disabled style="background:var(--amber); color:white; border:none; padding:10px 20px; border-radius:10px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:8px; opacity:0.5; transition:0.2s;">
                    <i data-lucide="upload-cloud"></i> Envoyer sur le serveur
                </button>
            </div>
        </div>
    `;

    // Inject Custom Styles for Fusion ++
    if (!document.getElementById('fusion-plus-styles')) {
        const style = document.createElement('style');
        style.id = 'fusion-plus-styles';
        style.textContent = `
            .fusion-group-title { font-weight:800; font-size:1rem; margin:20px 0 10px 0; display:flex; align-items:center; gap:10px; }
            .fusion-badge { padding:2px 8px; border-radius:20px; font-size:0.75rem; font-weight:bold; color:white; }
            .fusion-badge.new { background:#10B981; }
            .fusion-badge.gps { background:#3B82F6; }
            .fusion-badge.content { background:#F59E0B; }
            .fusion-badge.del { background:#EF4444; }

            .fusion-item { background:white; border:1px solid #E2E8F0; border-radius:12px; margin-bottom:10px; display:flex; padding:15px; gap:15px; transition:0.2s; }
            .fusion-item:hover { border-color:#CBD5E1; box-shadow:0 2px 8px rgba(0,0,0,0.05); }

            .fusion-checkbox { width:20px; height:20px; cursor:pointer; accent-color:var(--amber); margin-top:2px; }
            .fusion-item-body { flex:1; }

            .fusion-item-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px; }
            .fusion-poi-name { font-weight:700; font-size:1rem; margin:0; }

            .fusion-change-row { display:flex; align-items:center; gap:8px; font-size:0.85rem; margin-top:5px; padding-top:5px; border-top:1px dashed #F1F5F9; }
            .fusion-old-val { color:#94A3B8; text-decoration:line-through; }
            .fusion-new-val { color:#166534; font-weight:600; background:#F0FDF4; padding:0 4px; border-radius:4px; }

            .btn-edit-poi { background:transparent; border:1px solid #E2E8F0; color:#64748B; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:0.75rem; display:flex; align-items:center; gap:4px; }
            .btn-edit-poi:hover { background:#F1F5F9; color:var(--ink); }
        `;
        document.head.appendChild(style);
    }

    // Open Modal
    showAlert("", html, null, 'fusion-plus-modal');

    // Hide default title/actions
    const titleEl = document.getElementById('custom-modal-title');
    if (titleEl) titleEl.style.display = 'none';
    const actionsEl = document.getElementById('custom-modal-actions');
    if (actionsEl) actionsEl.style.display = 'none';

    // Override padding
    const box = document.querySelector('.custom-modal-box.fusion-plus-modal');
    if (box) box.style.padding = '0';

    createIcons({ icons, root: document.getElementById('fusion-plus-container') });

    await analyzeData();
}

async function analyzeData() {
    const mapId = state.currentMapId || 'djerba';

    try {
        // 1. Fetch Remote File
        const url = `https://raw.githubusercontent.com/Stefanmartin1967/History-Walk-V1/main/public/${mapId}.geojson?t=${Date.now()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Impossible de charger le fichier source distant.");

        originalData = await response.json();
        const originalFeatures = originalData.features || [];

        // 2. Prepare Data Dictionaries
        const origMap = new Map();
        originalFeatures.forEach(f => {
            const id = getPoiId(f);
            if (id) origMap.set(id, f);
        });

        const localFeatures = state.loadedFeatures || [];

        currentPendingChanges = { newPois: [], gpsUpdates: [], contentUpdates: [], deletes: [] };

        // 3. Analyze Deletions (Soft deletes in hiddenPoiIds or userData._deleted)
        const deletedIds = new Set(state.hiddenPoiIds || []);
        Object.keys(state.userData).forEach(id => {
            if (state.userData[id] && state.userData[id]._deleted) deletedIds.add(id);
        });

        // 4. Analyze
        localFeatures.forEach(localFeat => {
            const id = getPoiId(localFeat);
            if (!id) return;

            const isCustom = state.customFeatures && state.customFeatures.some(f => getPoiId(f) === id);
            const origFeat = origMap.get(id);
            const uData = state.userData[id] || {};

            // --- A. DELETIONS ---
            if (deletedIds.has(id) && origFeat) {
                currentPendingChanges.deletes.push({
                    id: id,
                    name: getPoiName(origFeat) || 'Lieu inconnu',
                    feature: origFeat
                });
                return; // Skip other checks if deleted
            }

            if (deletedIds.has(id)) return; // Was custom and deleted, ignore.

            // --- B. NEW POIS ---
            if (isCustom && !origFeat) {
                currentPendingChanges.newPois.push({
                    id: id,
                    name: getPoiName(localFeat) || 'Nouveau Lieu',
                    feature: localFeat
                });
                return;
            }

            // --- C. MODIFICATIONS (GPS & Content) ---
            if (origFeat) {
                // Ignore specific user-only keys
                const ignoredKeys = ['visited', 'vu', 'planifie', 'planifieCounter', 'notes', 'lat', 'lng', '_deleted'];

                // Check GPS (Override in userData)
                if (uData.lat !== undefined && uData.lng !== undefined) {
                    const oCoords = origFeat.geometry.coordinates;
                    const nLat = parseFloat(uData.lat);
                    const nLng = parseFloat(uData.lng);

                    if (oCoords[1].toFixed(5) !== nLat.toFixed(5) || oCoords[0].toFixed(5) !== nLng.toFixed(5)) {
                        currentPendingChanges.gpsUpdates.push({
                            id: id,
                            name: getPoiName(localFeat),
                            oldCoords: [oCoords[1], oCoords[0]], // lat, lng
                            newCoords: [nLat, nLng]
                        });
                    }
                }

                // Check Content
                const contentChanges = [];
                Object.keys(uData).forEach(key => {
                    if (ignoredKeys.includes(key)) return;

                    const oldVal = origFeat.properties[key];
                    const newVal = uData[key];

                    if (String(oldVal) !== String(newVal) && !(oldVal === undefined && newVal === "")) {
                        let displayKey = key;
                        if (key === 'timeH') displayKey = 'Heures';
                        if (key === 'timeM') displayKey = 'Minutes';

                        contentChanges.push({
                            key: key,
                            displayKey: displayKey,
                            old: oldVal !== undefined ? oldVal : '—',
                            new: newVal
                        });
                    }
                });

                if (contentChanges.length > 0) {
                    currentPendingChanges.contentUpdates.push({
                        id: id,
                        name: getPoiName(localFeat),
                        changes: contentChanges
                    });
                }
            }
        });

        renderDashboard();

    } catch (err) {
        console.error(err);
        document.getElementById('fusion-content').innerHTML = `
            <div style="color:var(--danger); text-align:center; padding:40px;">
                <i data-lucide="alert-triangle" style="width:48px;height:48px;margin-bottom:15px;"></i><br>
                Erreur: ${err.message}
            </div>
        `;
        createIcons({ icons, root: document.getElementById('fusion-content') });
        document.getElementById('fusion-status').textContent = "Erreur de chargement";
    }
}

function renderDashboard() {
    const container = document.getElementById('fusion-content');
    const status = document.getElementById('fusion-status');
    const btnPublish = document.getElementById('btn-fusion-publish');

    const { newPois, gpsUpdates, contentUpdates, deletes } = currentPendingChanges;
    const totalChanges = newPois.length + gpsUpdates.length + contentUpdates.length + deletes.length;

    if (totalChanges === 0) {
        status.innerHTML = `<i data-lucide="check-circle" style="color:#10B981;width:16px;height:16px;"></i> À jour`;
        container.innerHTML = `
            <div style="text-align:center; padding:60px; opacity:0.6;">
                <i data-lucide="check-square" style="width:64px;height:64px;margin-bottom:20px;color:#10B981;"></i>
                <h3 style="margin:0;">Aucune modification détectée</h3>
                <p style="font-size:0.9rem;">Votre carte locale est identique à la carte officielle.</p>
            </div>
        `;
        createIcons({ icons, root: container });
        return;
    }

    status.innerHTML = `<span style="background:var(--amber); color:white; padding:2px 8px; border-radius:12px; font-size:0.8rem;">${totalChanges} modif(s)</span>`;

    let html = '';

    // --- RENDER HELPERS ---
    const renderSection = (title, data, typeClass, icon, renderItem) => {
        if (data.length === 0) return '';
        return `
            <div class="fusion-group-title">
                <i data-lucide="${icon}"></i> ${title}
                <span class="fusion-badge ${typeClass}">${data.length}</span>
            </div>
            ${data.map((item, idx) => `
                <div class="fusion-item">
                    <input type="checkbox" class="fusion-checkbox" id="chk-${typeClass}-${idx}" checked data-type="${typeClass}" data-id="${item.id}">
                    <div class="fusion-item-body">
                        <div class="fusion-item-header">
                            <h4 class="fusion-poi-name">${item.name}</h4>
                            <button class="btn-edit-poi" onclick="editPoiFromFusion('${item.id}')"><i data-lucide="edit-2" style="width:12px;height:12px;"></i> Éditer</button>
                        </div>
                        ${renderItem(item)}
                    </div>
                </div>
            `).join('')}
        `;
    };

    html += renderSection('Nouveaux Lieux', newPois, 'new', 'plus-circle', (item) => `
        <div style="font-size:0.85rem; color:#64748B; margin-top:5px;">
            Sera ajouté à la carte officielle.
        </div>
    `);

    html += renderSection('Corrections GPS', gpsUpdates, 'gps', 'map-pin', (item) => `
        <div class="fusion-change-row">
            <span class="fusion-old-val">[${item.oldCoords[0].toFixed(5)}, ${item.oldCoords[1].toFixed(5)}]</span>
            <i data-lucide="arrow-right" style="width:14px;height:14px;color:#94A3B8;"></i>
            <span class="fusion-new-val">[${item.newCoords[0].toFixed(5)}, ${item.newCoords[1].toFixed(5)}]</span>
        </div>
    `);

    html += renderSection('Modifications Contenu', contentUpdates, 'content', 'file-edit', (item) => {
        return item.changes.map(c => `
            <div class="fusion-change-row">
                <strong style="width:80px;">${c.displayKey}</strong>
                <span class="fusion-old-val">${c.old}</span>
                <i data-lucide="arrow-right" style="width:14px;height:14px;color:#94A3B8;"></i>
                <span class="fusion-new-val">${c.new}</span>
            </div>
        `).join('');
    });

    html += renderSection('Suppressions', deletes, 'del', 'trash-2', (item) => `
        <div style="font-size:0.85rem; color:#EF4444; margin-top:5px;">
            Sera supprimé définitivement de la carte.
        </div>
    `);

    container.innerHTML = html;
    createIcons({ icons, root: container });

    // Enable button
    btnPublish.disabled = false;
    btnPublish.style.opacity = '1';
    btnPublish.onclick = publishFusion;
}

// Global function to call existing editor
window.editPoiFromFusion = (id) => {
    // We can use the existing global edit mode from map.js/UI
    // The easiest way is to close this modal temporarily, open the editor, and we would need a hook to come back.
    // For simplicity, we just trigger the normal click event on the map if possible,
    // or call the edit UI.

    showToast("Fermez la console pour éditer, puis rouvrez-la.", "info");

    // In a full implementation, we would import `showEditModal` from `ui.js` and call it here,
    // then re-run `analyzeData()` when it closes.
    // To avoid circular dependency hell, we advise the user.
};

async function publishFusion() {
    const token = getStoredToken();
    if (!token) {
        showToast("Token GitHub manquant. Configurez-le dans le God Mode.", "error");
        return;
    }

    const btn = document.getElementById('btn-fusion-publish');
    btn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Envoi...`;
    btn.disabled = true;

    try {
        // Deep clone original features to build the new master
        let finalFeatures = JSON.parse(JSON.stringify(originalData.features));

        // 1. Process Deletions
        const deleteIds = Array.from(document.querySelectorAll('.fusion-checkbox[data-type="del"]:checked')).map(cb => cb.dataset.id);
        if (deleteIds.length > 0) {
            finalFeatures = finalFeatures.filter(f => !deleteIds.includes(getPoiId(f)));
        }

        // 2. Process Content Updates
        const contentUpdates = Array.from(document.querySelectorAll('.fusion-checkbox[data-type="content"]:checked')).map(cb => cb.dataset.id);
        contentUpdates.forEach(id => {
            const feat = finalFeatures.find(f => getPoiId(f) === id);
            const updates = currentPendingChanges.contentUpdates.find(u => u.id === id);
            if (feat && updates) {
                updates.changes.forEach(c => {
                    feat.properties[c.key] = c.new;
                });
            }
        });

        // 3. Process GPS Updates
        const gpsUpdates = Array.from(document.querySelectorAll('.fusion-checkbox[data-type="gps"]:checked')).map(cb => cb.dataset.id);
        gpsUpdates.forEach(id => {
            const feat = finalFeatures.find(f => getPoiId(f) === id);
            const updates = currentPendingChanges.gpsUpdates.find(u => u.id === id);
            if (feat && updates) {
                // GeoJSON uses [lng, lat]
                feat.geometry.coordinates = [updates.newCoords[1], updates.newCoords[0]];
            }
        });

        // 4. Process New POIs
        const newIds = Array.from(document.querySelectorAll('.fusion-checkbox[data-type="new"]:checked')).map(cb => cb.dataset.id);
        newIds.forEach(id => {
            const updates = currentPendingChanges.newPois.find(u => u.id === id);
            if (updates) {
                // Clean up specific keys before injecting
                const newFeat = JSON.parse(JSON.stringify(updates.feature));
                if (newFeat.properties.userData) delete newFeat.properties.userData; // Don't upload local state

                finalFeatures.push(newFeat);
            }
        });

        // Create new GeoJSON
        const newGeoJSON = {
            type: "FeatureCollection",
            features: finalFeatures
        };

        const mapId = state.currentMapId || 'djerba';
        const filename = `${mapId}.geojson`;
        const blob = new Blob([JSON.stringify(newGeoJSON, null, 2)], { type: 'application/geo+json' });
        const file = new File([blob], filename, { type: 'application/geo+json' });

        await uploadFileToGitHub(file, token, 'Stefanmartin1967', 'History-Walk-V1', `public/${filename}`, `Update via Console Fusion ++`);

        showToast("Fusion et envoi réussis !", "success");

        // Clean up UI
        document.getElementById('custom-modal-overlay').classList.remove('active');

        // Suggest refresh
        setTimeout(() => {
            if (confirm("La carte a été mise à jour. Voulez-vous recharger l'application pour voir les changements ?")) {
                window.location.reload();
            }
        }, 1000);

    } catch (err) {
        console.error(err);
        showToast("Erreur lors de l'envoi : " + err.message, "error");
        btn.innerHTML = `<i data-lucide="upload-cloud"></i> Envoyer sur le serveur`;
        btn.disabled = false;
        createIcons({ icons, root: btn });
    }
}
