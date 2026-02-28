import { state } from './state.js';
import { getPoiId, getPoiName } from './data.js';
import { showAlert } from './modal.js';
import { createIcons, icons } from 'lucide';
import { uploadFileToGitHub, getStoredToken } from './github-sync.js';
import { showToast } from './toast.js';
import { escapeHtml } from './utils.js';

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

    // Inject Custom Styles for Fusion ++ (Matching original fusion.html)
    if (!document.getElementById('fusion-plus-styles')) {
        const style = document.createElement('style');
        style.id = 'fusion-plus-styles';
        style.textContent = `
            /* Variables de base de fusion.html */
            :root {
                --bg: #0D3B66;
                --surface: #FFFFFF;
                --surface-alt: #F8FAFC;
                --ink: #102A43;
                --ink-light: #64748B;
                --brand: #3B82F6;
                --ok: #10B981;
                --warn: #F59E0B;
                --danger: #EF4444;
                --border: #E2E8F0;
            }

            #fusion-plus-container {
                font-family: system-ui, sans-serif;
                background-color: #F1F5F9;
                color: var(--ink);
            }

            .fusion-group-title { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px; margin-top: 20px; margin-bottom: 10px; color: var(--ink); }

            .fusion-badge { padding: 4px 8px; border-radius: 99px; font-size: 12px; font-weight: 700; }
            .fusion-badge.new { background: #DBEAFE; color: #1E40AF; }
            .fusion-badge.gps { background: #FEF3C7; color: #92400E; }
            .fusion-badge.content { background: #D1FAE5; color: #065F46; }
            .fusion-badge.del { background: #FEE2E2; color: #991B1B; }

            .fusion-item { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 15px; margin-bottom: 10px; display: flex; gap: 15px; align-items: flex-start; transition: border-color 0.2s; }
            .fusion-item:hover { border-color: var(--brand); }

            .fusion-checkbox { width: 18px; height: 18px; cursor: pointer; margin-top:2px; }

            .fusion-item-body { flex-grow: 1; }

            .fusion-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
            .fusion-poi-name { font-weight: 700; font-size: 16px; margin: 0; }

            .fusion-change-row { font-size: 14px; color: var(--ink-light); display: flex; gap: 10px; align-items: center; margin-top: 6px; background: var(--surface-alt); padding: 8px; border-radius: 6px; }
            .fusion-old-val { text-decoration: line-through; color: #94A3B8; font-size: 12px; }
            .fusion-new-val { color: var(--ink); font-weight: 500; }

            .btn-edit-poi { background:transparent; border:1px solid var(--border); color:var(--ink-light); padding:4px 8px; border-radius:6px; cursor:pointer; font-size:12px; display:flex; align-items:center; gap:4px; font-weight: 500;}
            .btn-edit-poi:hover { background:#F1F5F9; color:var(--ink); }

            /* Inputs pour Nouveaux Lieux */
            .fusion-new-poi-input { width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-family: inherit; box-sizing: border-box; font-size: 14px; margin-top: 4px; }
            .fusion-new-poi-input[dir="rtl"] { direction: rtl; text-align: right; }
        `;
        document.head.appendChild(style);
    }

    // Ensure we are displaying properly in the standard UI
    const existing = document.getElementById('custom-modal-overlay');
    if (existing) {
        existing.classList.remove('active');
    }

    // Ensure we are displaying properly in the standard UI
    const existing = document.getElementById('custom-modal-overlay');
    if (existing) {
        existing.classList.remove('active');
    }

    // Open Modal via standard mechanism
    showAlert("", html, null, 'fusion-plus-modal');

    // Adjust modal styling post-render
    setTimeout(() => {
        const titleEl = document.getElementById('custom-modal-title');
        if (titleEl) titleEl.style.display = 'none';
        const actionsEl = document.getElementById('custom-modal-actions');
        if (actionsEl) actionsEl.style.display = 'none';

        // Override padding & height for consistency with original fusion
        const box = document.querySelector('.custom-modal-box.fusion-plus-modal');
        if (box) {
            box.style.padding = '0';
            box.style.width = '100%';
            box.style.maxWidth = '900px'; // Align with fusion width
            box.style.height = '85vh';
            box.style.display = 'flex';
            box.style.flexDirection = 'column';
        }

        const container = document.getElementById('fusion-plus-container');
        if(container) {
            createIcons({ icons, root: container });
        }
    }, 50);

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

    html += renderSection('Nouveaux Lieux à Créer', newPois, 'new', 'plus-circle', (item, idx) => `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
            <div>
                <label style="font-size:11px; color:var(--ink-light); font-weight:600;">Nom FR</label>
                <input type="text" class="fusion-new-poi-input" id="fusion-name-new-${idx}" value="${escapeHtml(item.name)}">
            </div>
            <div>
                <label style="font-size:11px; color:var(--ink-light); font-weight:600;">Nom AR (Optionnel)</label>
                <input type="text" class="fusion-new-poi-input" id="fusion-name-ar-new-${idx}" placeholder="الاسم بالعربية" dir="rtl">
            </div>
        </div>
    `);

    html += renderSection('Corrections GPS', gpsUpdates, 'gps', 'map-pin', (item) => `
        <div class="fusion-change-row">
            <span class="fusion-old-val">[${item.oldCoords[0].toFixed(5)}, ${item.oldCoords[1].toFixed(5)}]</span>
            <span style="color:var(--brand); font-weight:bold;">➜</span>
            <span class="fusion-new-val">[${item.newCoords[0].toFixed(5)}, ${item.newCoords[1].toFixed(5)}]</span>
        </div>
    `);

    html += renderSection('Modifications Contenu', contentUpdates, 'content', 'file-edit', (item) => {
        return item.changes.map(c => `
            <div class="fusion-change-row">
                <span class="fusion-badge content" style="margin-right:8px; display:inline-block; min-width:60px; text-align:center;">${c.displayKey}</span>
                <span class="fusion-new-val" style="background:transparent;">${c.new}</span>
            </div>
        `).join('');
    });

    html += renderSection('Suppressions', deletes, 'del', 'trash-2', (item) => ``);

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
