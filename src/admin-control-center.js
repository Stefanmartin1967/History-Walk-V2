
import { state } from './state.js';
import { getPoiId, getPoiName } from './data.js';
import { showAlert, showConfirm } from './modal.js';
import { createIcons, icons } from 'lucide';
import { generateMasterGeoJSONData } from './admin.js';
import { uploadFileToGitHub, getStoredToken, saveToken } from './github-sync.js';
import { showToast } from './toast.js';
import { saveAppState, getAppState } from './database.js';

// --- STATE MANAGEMENT ---

const DRAFT_KEY = 'admin_draft_v1';
let adminDraft = {
    pendingPois: {}, // Map<poiId, { timestamp, changes: Set<key> }>
    pendingCircuits: {} // Map<circuitId, { type, timestamp }>
};

// Charge le brouillon au démarrage
export async function initAdminControlCenter() {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Convert arrays back to Sets if needed, or just use arrays
            adminDraft = parsed;
        } catch (e) {
            console.error("Erreur lecture brouillon admin", e);
        }
    }

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        .admin-cc-tabs { display: flex; border-bottom: 1px solid var(--line); margin-bottom: 15px; }
        .admin-cc-tab { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; font-weight: 500; color: var(--ink-soft); }
        .admin-cc-tab.active { border-bottom-color: var(--brand); color: var(--brand); }
        .admin-cc-content { min-height: 300px; max-height: 60vh; overflow-y: auto; }
        .diff-item { background: var(--surface-muted); border-radius: 8px; padding: 12px; margin-bottom: 10px; }
        .diff-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .diff-title { font-weight: 600; font-size: 1.1em; }
        .diff-row { display: grid; grid-template-columns: 100px 1fr 20px 1fr; gap: 10px; font-size: 0.9em; align-items: center; margin-top: 4px; }
        .diff-label { color: var(--ink-soft); font-weight: 500; }
        .diff-old { color: var(--danger); text-decoration: line-through; opacity: 0.7; word-break: break-word; }
        .diff-arrow { color: var(--ink-soft); text-align: center; }
        .diff-new { color: var(--ok); font-weight: 600; word-break: break-word; }
        .stat-card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 15px; text-align: center; flex: 1; }
        .stat-value { font-size: 2em; font-weight: 700; color: var(--brand); }
        .stat-label { color: var(--ink-soft); font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.5px; }
    `;
    document.head.appendChild(style);
}

function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(adminDraft));
    updateButtonBadge();
}

function updateButtonBadge() {
    const btn = document.getElementById('btn-admin-control-center');
    if (!btn) return;

    const count = Object.keys(adminDraft.pendingPois).length + Object.keys(adminDraft.pendingCircuits).length;
    if (count > 0) {
        btn.innerHTML = `<i data-lucide="layout-dashboard"></i> Centre de Contrôle <span class="badge" style="background:var(--brand); color:white; padding:2px 6px; border-radius:10px; font-size:0.8em; margin-left:5px;">${count}</span>`;
    } else {
        btn.innerHTML = `<i data-lucide="layout-dashboard"></i> Centre de Contrôle`;
    }
    createIcons({ icons, root: btn });
}

// --- API ---

export function addToDraft(type, id, details) {
    if (!state.isAdmin) return;

    const timestamp = Date.now();

    if (type === 'poi') {
        if (!adminDraft.pendingPois[id]) {
            adminDraft.pendingPois[id] = { changes: [], timestamp };
        }
        // details = { key: 'price', value: 10 } or { type: 'coords' }
        if (details.key && !adminDraft.pendingPois[id].changes.includes(details.key)) {
            adminDraft.pendingPois[id].changes.push(details.key);
        } else if (details.type === 'coords' && !adminDraft.pendingPois[id].changes.includes('geometry')) {
            adminDraft.pendingPois[id].changes.push('geometry');
        }
    } else if (type === 'circuit') {
        // TODO: Implement circuit tracking
    }

    saveDraft();
}

// --- UI ---

export async function openControlCenter() {
    // 1. Structure de la modale
    const html = `
        <div class="admin-cc-tabs">
            <div class="admin-cc-tab active" data-tab="dashboard">Tableau de Bord</div>
            <div class="admin-cc-tab" data-tab="changes">Détail des Modifications</div>
            <div class="admin-cc-tab" data-tab="settings">Configuration</div>
        </div>
        <div id="admin-cc-content" class="admin-cc-content">
            <div style="text-align:center; padding:40px; color:var(--ink-soft);">
                <i data-lucide="loader-2" class="spin" style="width:32px; height:32px;"></i><br>
                Analyse des données en cours...
            </div>
        </div>
    `;

    // 2. Ouverture Modale
    // On n'attend PAS la fermeture (await), sinon le code suivant ne s'exécuterait qu'à la fermeture !
    showAlert("Centre de Contrôle Admin", html, null);

    // 3. Setup Tabs
    const tabs = document.querySelectorAll('.admin-cc-tab');
    tabs.forEach(t => {
        t.onclick = () => {
            tabs.forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            renderTab(t.dataset.tab);
        };
    });

    // 4. Custom Footer Actions
    const actions = document.getElementById('custom-modal-actions');
    if (actions) {
        actions.innerHTML = `
            <button class="custom-modal-btn secondary" onclick="document.getElementById('custom-modal-overlay').classList.remove('active')">Fermer</button>
            <button class="custom-modal-btn primary" id="btn-cc-publish">
                <i data-lucide="upload-cloud"></i> Tout Publier sur GitHub
            </button>
        `;
        createIcons({ icons, root: actions });

        document.getElementById('btn-cc-publish').onclick = publishChanges;
    }

    // 5. Load Data & Render Default Tab
    await prepareDiffData();
    renderTab('dashboard');
}

let diffData = { pois: [], circuits: [] };

async function prepareDiffData() {
    // A. Fetch Original from GitHub (Cache Busting)
    let originalFeatures = [];
    try {
        const timestamp = Date.now();
        const mapId = state.currentMapId || 'djerba';
        const url = `https://raw.githubusercontent.com/Stefanmartin1967/History-Walk-V1/main/public/${mapId}.geojson?t=${timestamp}`;
        const response = await fetch(url);
        if (response.ok) {
            const json = await response.json();
            originalFeatures = json.features;
        } else {
            console.warn("Impossible de charger l'original GitHub. Comparaison locale uniquement.");
        }
    } catch (e) {
        console.error("Erreur fetch original", e);
    }

    // B. Compare POIs
    diffData.pois = [];
    const pendingIds = Object.keys(adminDraft.pendingPois);

    pendingIds.forEach(id => {
        const current = state.loadedFeatures.find(f => getPoiId(f) === id);
        const original = originalFeatures.find(f => getPoiId(f) === id);

        if (!current) return; // Should not happen unless deleted

        const changes = [];

        // 1. Geometry
        if (original) {
            const [oLng, oLat] = original.geometry.coordinates;
            const [cLng, cLat] = current.geometry.coordinates;
            // Round to 5 decimals to avoid float noise
            if (oLng.toFixed(5) !== cLng.toFixed(5) || oLat.toFixed(5) !== cLat.toFixed(5)) {
                changes.push({
                    key: 'Position',
                    old: `${oLat.toFixed(5)}, ${oLng.toFixed(5)}`,
                    new: `${cLat.toFixed(5)}, ${cLng.toFixed(5)}`
                });
            }
        }

        // 2. Properties (userData merged)
        const trackedKeys = adminDraft.pendingPois[id].changes;
        // On check aussi toutes les clés userData présentes
        const userData = current.properties.userData || {};

        // Merge tracked keys and actual userData keys
        const allKeysToCheck = new Set([...trackedKeys, ...Object.keys(userData)]);

        allKeysToCheck.forEach(key => {
            if (key === 'lat' || key === 'lng') return; // Handled by geometry

            let oldVal = original ? original.properties[key] : undefined;
            // Map generic keys if needed (e.g. price -> Prix)
            // But let's stick to raw keys for Admin or simple mapping

            let newVal = userData[key] !== undefined ? userData[key] : current.properties[key];

            // Special handling for Photos (Array)
            if (key === 'photos') {
                const oldPhotos = JSON.stringify(oldVal || []);
                const newPhotos = JSON.stringify(newVal || []);
                if (oldPhotos !== newPhotos) {
                    changes.push({
                        key: 'Photos',
                        old: `${(oldVal||[]).length} photo(s)`,
                        new: `${(newVal||[]).length} photo(s)`
                    });
                }
                return;
            }

            // Standard comparison
            if (String(oldVal) !== String(newVal)) {
                changes.push({
                    key: key,
                    old: oldVal !== undefined ? oldVal : '(vide)',
                    new: newVal
                });
            }
        });

        if (changes.length > 0) {
            diffData.pois.push({
                id: id,
                name: getPoiName(current),
                changes: changes
            });
        }
    });
}

function renderTab(tabName) {
    const container = document.getElementById('admin-cc-content');
    if (!container) return;
    container.innerHTML = '';

    if (tabName === 'dashboard') {
        renderDashboard(container);
    } else if (tabName === 'changes') {
        renderChanges(container);
    } else if (tabName === 'settings') {
        renderSettings(container);
    }
}

function renderDashboard(container) {
    const poiCount = diffData.pois.length;
    // const circuitCount = diffData.circuits.length;

    container.innerHTML = `
        <div style="display:flex; gap:20px; margin-bottom:30px;">
            <div class="stat-card">
                <div class="stat-value">${poiCount}</div>
                <div class="stat-label">Lieux modifiés</div>
            </div>
            <!--
            <div class="stat-card">
                <div class="stat-value">0</div>
                <div class="stat-label">Nouveaux Circuits</div>
            </div>
            -->
        </div>

        <div style="background:var(--surface-muted); padding:20px; border-radius:8px;">
            <h3 style="margin-top:0;">État de la Synchronisation</h3>
            <p>
                Vous avez <strong>${poiCount} modifications</strong> en attente de publication.
                Ces changements sont sauvegardés localement dans votre navigateur.
            </p>
            <p style="font-size:0.9em; color:var(--ink-soft);">
                Cliquez sur "Tout Publier" pour mettre à jour la carte officielle sur GitHub.
                Cela rendra vos modifications visibles pour tous les utilisateurs.
            </p>
        </div>
    `;
}

function renderChanges(container) {
    if (diffData.pois.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--ink-soft);">Aucune modification détectée.</div>`;
        return;
    }

    const html = diffData.pois.map(item => `
        <div class="diff-item">
            <div class="diff-header">
                <div class="diff-title">${item.name}</div>
                <div style="font-family:monospace; font-size:0.8em; opacity:0.5;">${item.id}</div>
            </div>
            ${item.changes.map(c => `
                <div class="diff-row">
                    <div class="diff-label">${c.key}</div>
                    <div class="diff-old">${c.old}</div>
                    <div class="diff-arrow">➜</div>
                    <div class="diff-new">${c.new}</div>
                </div>
            `).join('')}
        </div>
    `).join('');

    container.innerHTML = html;
}

function renderSettings(container) {
    const token = getStoredToken() || '';
    container.innerHTML = `
        <div style="padding:10px;">
            <label style="display:block; margin-bottom: 8px; font-weight: 600;">GitHub Personal Access Token (PAT)</label>
            <input type="password" id="cc-token-input" value="${token}"
                   style="width: 100%; padding: 10px; border: 1px solid var(--line); border-radius: 6px; margin-bottom: 10px;">
            <p style="font-size: 0.8em; color: var(--ink-soft); margin-bottom:20px;">
                Requis pour publier les changements. Stocké localement.
            </p>
            <button class="custom-modal-btn primary" id="btn-save-token">Sauvegarder Token</button>
        </div>
    `;

    // Wait for DOM
    setTimeout(() => {
        const btn = document.getElementById('btn-save-token');
        if (btn) {
            btn.onclick = () => {
                const val = document.getElementById('cc-token-input').value.trim();
                saveToken(val);
                showToast("Token sauvegardé !", "success");
            };
        }
    }, 0);
}

// --- ACTION : PUBLISH ---

async function publishChanges() {
    const token = getStoredToken();
    if (!token) {
        showToast("Token manquant. Allez dans l'onglet Configuration.", "error");
        renderTab('settings');
        return;
    }

    if (!confirm("Êtes-vous sûr de vouloir publier ces changements sur GitHub ?\nCette action est définitive.")) {
        return;
    }

    const btn = document.getElementById('btn-cc-publish');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Publication...`;
        createIcons({ icons, root: btn });
    }

    try {
        // 1. Generate Master GeoJSON
        const geojson = generateMasterGeoJSONData();
        if (!geojson) throw new Error("Erreur génération GeoJSON");

        const mapId = state.currentMapId || 'djerba';
        const filename = `${mapId}.geojson`;
        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
        const file = new File([blob], filename, { type: 'application/geo+json' });

        // 2. Upload
        const repoOwner = 'Stefanmartin1967'; // Should come from config/state really
        const repoName = 'History-Walk-V1';
        const path = `public/${filename}`;

        await uploadFileToGitHub(file, token, repoOwner, repoName, path, `Admin Update via Control Center (${diffData.pois.length} POIs)`);

        // 3. Success & Cleanup
        showToast("Publication réussie !", "success");

        // Reset Draft
        adminDraft = { pendingPois: {}, pendingCircuits: {} };
        saveDraft();
        updateButtonBadge();

        // Optional: Clear merged userData from local storage to keep it clean?
        // Actually, no. If we clear it, and reload, the new GeoJSON will have the data.
        // But if we don't clear it, we just have redundant data.
        // Let's clear the tracked IDs from userData to be clean.
        diffData.pois.forEach(p => {
             if (state.userData[p.id]) {
                 delete state.userData[p.id];
                 // Also remove from DB
                 saveAppState('userData', state.userData); // This is heavy if done per item, but ok for now.
             }
        });
        // Save the cleaned userData once
        await saveAppState('userData', state.userData);


        alert("La carte a été mise à jour avec succès !\nLes changements seront visibles dans quelques minutes.");
        document.getElementById('custom-modal-overlay').classList.remove('active');

    } catch (e) {
        console.error(e);
        showToast("Erreur publication: " + e.message, "error");
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="upload-cloud"></i> Réessayer`;
            createIcons({ icons, root: btn });
        }
    }
}
