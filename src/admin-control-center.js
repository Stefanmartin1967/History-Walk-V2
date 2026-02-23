
import { state } from './state.js';
import { getPoiId, getPoiName } from './data.js';
import { showAlert } from './modal.js';
import { createIcons, icons } from 'lucide';
import { generateMasterGeoJSONData } from './admin.js';
import { uploadFileToGitHub, getStoredToken, saveToken } from './github-sync.js';
import { showToast } from './toast.js';
import { saveAppState } from './database.js';

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
            adminDraft = parsed;
            updateButtonBadge(); // Initialize badge on load
        } catch (e) {
            console.error("Erreur lecture brouillon admin", e);
        }
    }

    // Inject styles (PC FIRST REDESIGN)
    const style = document.createElement('style');
    style.textContent = `
        /* --- GLOBAL & LAYOUT (PC First) --- */
        .admin-cc-container {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: var(--ink);
            display: flex;
            flex-direction: column;
            height: 100%;
            max-height: 80vh; /* Fixed height for modal content */
        }

        /* Modal Overrides for Admin Center */
        /* Note: These target the generic modal container when active */
        .custom-modal-content.admin-cc-mode {
            max-width: 900px !important;
            width: 90vw !important;
            padding: 0 !important; /* Remove default padding to control scroll area */
            border-radius: 16px;
            overflow: hidden; /* Prevent outer scroll */
            display: flex;
            flex-direction: column;
        }

        /* --- HEADER & TABS (Segmented Control) --- */
        .admin-cc-header {
            padding: 20px 25px 0 25px;
            background: var(--surface);
            border-bottom: 1px solid var(--line-light);
            flex-shrink: 0; /* Don't shrink */
        }

        .admin-cc-title {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .admin-cc-tabs {
            display: flex;
            gap: 5px;
            background: var(--surface-muted);
            padding: 4px;
            border-radius: 10px;
            width: fit-content;
            margin-bottom: 20px;
        }

        .admin-cc-tab {
            padding: 8px 24px;
            cursor: pointer;
            text-align: center;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.9em;
            color: var(--ink-soft);
            transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            display: flex;
            align-items: center;
            gap: 8px;
            user-select: none;
        }

        .admin-cc-tab:hover {
            color: var(--ink);
            background: rgba(0,0,0,0.03);
        }

        .admin-cc-tab.active {
            background: var(--surface);
            color: var(--brand);
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            transform: scale(1.02);
        }

        /* --- SCROLLABLE CONTENT AREA --- */
        .admin-cc-scroll-area {
            flex: 1; /* Take remaining height */
            overflow-y: auto;
            padding: 25px;
            background: var(--bg); /* Slight contrast */
        }

        /* --- DASHBOARD GRID (Glassmorphism) --- */
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(10px);
            border: 1px solid var(--line);
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.03);
            transition: transform 0.2s, box-shadow 0.2s;
            position: relative;
            overflow: hidden;
        }

        .stat-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            border-color: var(--brand-alpha);
        }

        .stat-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; width: 100%; height: 4px;
            background: var(--brand);
            opacity: 0;
            transition: opacity 0.2s;
        }
        .stat-card:hover::before { opacity: 1; }

        .stat-icon {
            color: var(--brand);
            margin-bottom: 12px;
            background: var(--brand-light-alpha);
            padding: 10px;
            border-radius: 50%;
        }

        .stat-value {
            font-size: 3rem;
            font-weight: 800;
            color: var(--ink);
            line-height: 1;
            margin-bottom: 8px;
        }

        .stat-label {
            color: var(--ink-soft);
            font-size: 0.85em;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            font-weight: 700;
        }

        /* --- SYNC BANNER --- */
        .sync-banner {
            background: linear-gradient(to right, #e3f2fd, #bbdefb);
            border-left: 5px solid #2196f3;
            color: #0d47a1;
            padding: 20px;
            border-radius: 8px;
            display: flex;
            align-items: flex-start;
            gap: 15px;
            box-shadow: 0 2px 10px rgba(33, 150, 243, 0.1);
        }
        .sync-banner i { flex-shrink: 0; margin-top: 3px; }

        /* --- DIFF LIST (Side-by-Side) --- */
        .diff-container {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .diff-card {
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 5px rgba(0,0,0,0.02);
        }

        .diff-card-header {
            background: var(--surface-muted);
            padding: 12px 20px;
            border-bottom: 1px solid var(--line);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .diff-title { font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 10px; }
        .diff-id {
            font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
            font-size: 0.8em;
            color: var(--ink-light);
            background: rgba(0,0,0,0.05);
            padding: 4px 8px;
            border-radius: 4px;
        }

        .diff-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.95em;
        }

        .diff-table th {
            text-align: left;
            padding: 10px 20px;
            background: rgba(0,0,0,0.02);
            color: var(--ink-soft);
            font-weight: 600;
            font-size: 0.8em;
            text-transform: uppercase;
        }

        .diff-table td {
            padding: 12px 20px;
            border-bottom: 1px solid var(--line-light);
            vertical-align: top;
        }
        .diff-table tr:last-child td { border-bottom: none; }

        .diff-key { font-weight: 600; color: var(--ink-soft); width: 15%; }
        .diff-old { color: var(--danger); text-decoration: line-through; opacity: 0.6; width: 35%; font-family: monospace; }
        .diff-arrow { color: var(--ink-light); text-align: center; width: 10%; }
        .diff-new { color: var(--ok); font-weight: 600; width: 35%; font-family: monospace; background: rgba(0,255,0,0.05); }

        /* --- SETTINGS --- */
        .settings-input {
            width: 100%;
            padding: 15px;
            border: 1px solid var(--line);
            border-radius: 8px;
            font-family: monospace;
            font-size: 1rem;
            background: var(--surface);
            color: var(--ink);
            transition: border 0.2s;
        }
        .settings-input:focus { border-color: var(--brand); outline: none; box-shadow: 0 0 0 3px var(--brand-light-alpha); }

        /* Scrollbar Polish */
        .admin-cc-scroll-area::-webkit-scrollbar { width: 8px; }
        .admin-cc-scroll-area::-webkit-scrollbar-track { background: transparent; }
        .admin-cc-scroll-area::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.1); border-radius: 4px; }
        .admin-cc-scroll-area::-webkit-scrollbar-thumb:hover { background-color: rgba(0,0,0,0.2); }
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

    const poiCount = Object.keys(adminDraft.pendingPois).length;
    const circuitCount = Object.keys(adminDraft.pendingCircuits).length;
    const total = poiCount + circuitCount;

    if (total > 0) {
        btn.innerHTML = `<i data-lucide="layout-dashboard"></i> Centre de Contrôle <span class="badge" style="background:var(--brand); color:white; padding:2px 6px; border-radius:10px; font-size:0.8em; margin-left:5px;">${total}</span>`;
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
        if (details.key && !adminDraft.pendingPois[id].changes.includes(details.key)) {
            adminDraft.pendingPois[id].changes.push(details.key);
        } else if (details.type === 'coords' && !adminDraft.pendingPois[id].changes.includes('geometry')) {
            adminDraft.pendingPois[id].changes.push('geometry');
        }
    } else if (type === 'circuit') {
        adminDraft.pendingCircuits[id] = {
            type: details.type || 'update',
            timestamp
        };
    }

    saveDraft();
}

// --- UI ---

export async function openControlCenter() {
    // Force specific class on modal content for overrides
    const modalContent = document.getElementById('custom-modal-message').parentElement; // .custom-modal-content
    if (modalContent) {
        modalContent.classList.add('admin-cc-mode');
    }

    // 1. Structure HTML (Header Sticky + Scrollable Body)
    const html = `
        <div class="admin-cc-container">
            <div class="admin-cc-header">
                <div class="admin-cc-title">
                    <i data-lucide="shield-check" style="color:var(--brand);"></i> Centre de Contrôle
                </div>
                <div class="admin-cc-tabs">
                    <div class="admin-cc-tab active" data-tab="dashboard">
                        <i data-lucide="layout-grid" width="18"></i> Tableau de Bord
                    </div>
                    <div class="admin-cc-tab" data-tab="changes">
                        <i data-lucide="list-checks" width="18"></i> Détail des Modifications
                    </div>
                    <div class="admin-cc-tab" data-tab="settings">
                        <i data-lucide="settings-2" width="18"></i> Configuration
                    </div>
                </div>
            </div>

            <div id="admin-cc-content" class="admin-cc-scroll-area">
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; color:var(--ink-soft);">
                    <i data-lucide="loader-2" class="spin" style="width:48px; height:48px; margin-bottom:15px; color:var(--brand);"></i>
                    <div style="font-weight:500;">Analyse des modifications en cours...</div>
                </div>
            </div>
        </div>
    `;

    // 2. Open Modal
    // We pass 'null' for title because we handle the header inside the custom HTML for layout control
    showAlert("", html, null);

    // Hide default modal title if possible or just ignore it
    const defaultTitle = document.getElementById('custom-modal-title');
    if (defaultTitle) defaultTitle.style.display = 'none';

    // 3. Setup Tabs
    const tabs = document.querySelectorAll('.admin-cc-tab');
    tabs.forEach(t => {
        t.onclick = () => {
            tabs.forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            renderTab(t.dataset.tab);
        };
    });

    // 4. Custom Footer Actions (Sticky Bottom)
    const actions = document.getElementById('custom-modal-actions');
    if (actions) {
        actions.innerHTML = `
            <button class="custom-modal-btn secondary" onclick="document.getElementById('custom-modal-overlay').classList.remove('active')">Fermer</button>
            <button class="custom-modal-btn primary" id="btn-cc-publish" style="background:var(--brand); font-weight:700; padding:10px 24px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                <i data-lucide="rocket"></i> TOUT PUBLIER
            </button>
        `;
        createIcons({ icons, root: actions });
        document.getElementById('btn-cc-publish').onclick = publishChanges;
    }

    // Clean up when modal closes
    const overlay = document.getElementById('custom-modal-overlay');
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class' && !overlay.classList.contains('active')) {
                // Remove custom class when closed
                if (modalContent) modalContent.classList.remove('admin-cc-mode');
                if (defaultTitle) defaultTitle.style.display = 'block';
                observer.disconnect();
            }
        });
    });
    observer.observe(overlay, { attributes: true });


    // 5. Load Data & Render
    await prepareDiffData();
    renderTab('dashboard');
}

let diffData = {
    pois: [],
    stats: {
        poisModified: 0,
        photosAdded: 0,
        circuitsModified: 0
    }
};

async function prepareDiffData() {
    // Similar logic to previous version
    let originalFeatures = [];
    try {
        const timestamp = Date.now();
        const mapId = state.currentMapId || 'djerba';
        const url = `https://raw.githubusercontent.com/Stefanmartin1967/History-Walk-V1/main/public/${mapId}.geojson?t=${timestamp}`;
        const response = await fetch(url);
        if (response.ok) {
            const json = await response.json();
            originalFeatures = json.features;
        }
    } catch (e) {
        console.error("Erreur fetch original", e);
    }

    diffData.pois = [];
    diffData.stats = { poisModified: 0, photosAdded: 0, circuitsModified: 0 };

    const pendingIds = Object.keys(adminDraft.pendingPois);

    pendingIds.forEach(id => {
        const current = state.loadedFeatures.find(f => getPoiId(f) === id);
        const original = originalFeatures.find(f => getPoiId(f) === id);

        if (!current) return;

        const changes = [];

        // Geometry
        if (original) {
            const [oLng, oLat] = original.geometry.coordinates;
            const [cLng, cLat] = current.geometry.coordinates;
            if (oLng.toFixed(5) !== cLng.toFixed(5) || oLat.toFixed(5) !== cLat.toFixed(5)) {
                changes.push({
                    key: 'Position',
                    old: `${oLat.toFixed(5)}, ${oLng.toFixed(5)}`,
                    new: `${cLat.toFixed(5)}, ${cLng.toFixed(5)}`
                });
            }
        }

        // Properties
        const trackedKeys = adminDraft.pendingPois[id].changes;
        const userData = current.properties.userData || {};
        const allKeysToCheck = new Set([...trackedKeys, ...Object.keys(userData)]);

        allKeysToCheck.forEach(key => {
            if (key === 'lat' || key === 'lng') return;

            let oldVal = original ? original.properties[key] : undefined;
            let newVal = userData[key] !== undefined ? userData[key] : current.properties[key];

            if (key === 'photos') {
                const oldLen = (oldVal || []).length;
                const newLen = (newVal || []).length;
                if (oldLen !== newLen) {
                    changes.push({
                        key: 'Photos',
                        old: `${oldLen} photo(s)`,
                        new: `${newLen} photo(s)`,
                    });
                    if (newLen > oldLen) diffData.stats.photosAdded += (newLen - oldLen);
                }
                return;
            }

            if (String(oldVal) !== String(newVal)) {
                changes.push({
                    key: key,
                    old: oldVal !== undefined ? oldVal : '—',
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
            diffData.stats.poisModified++;
        }
    });

    diffData.stats.circuitsModified = Object.keys(adminDraft.pendingCircuits).length;
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

    createIcons({ icons, root: container });
}

function renderDashboard(container) {
    const { poisModified, photosAdded, circuitsModified } = diffData.stats;
    const total = poisModified + circuitsModified;

    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="stat-card">
                <div class="stat-icon"><i data-lucide="map-pin" width="36" height="36"></i></div>
                <div class="stat-value">${poisModified}</div>
                <div class="stat-label">Lieux</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i data-lucide="camera" width="36" height="36"></i></div>
                <div class="stat-value">${photosAdded}</div>
                <div class="stat-label">Photos</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i data-lucide="route" width="36" height="36"></i></div>
                <div class="stat-value">${circuitsModified}</div>
                <div class="stat-label">Circuits</div>
            </div>
        </div>

        ${total > 0 ? `
            <div class="sync-banner">
                <i data-lucide="info" width="24" height="24"></i>
                <div>
                    <h3 style="margin:0 0 5px 0; font-size:1.1rem;">Synchronisation Requise</h3>
                    <p style="margin:0; opacity:0.9;">
                        Vous avez <strong>${total} modifications</strong> en attente.
                        Ces données sont stockées localement sur votre navigateur.
                        Pour les rendre publiques, cliquez sur "Tout Publier".
                    </p>
                </div>
            </div>
        ` : `
            <div style="text-align:center; padding:40px; color:var(--ink-light); background:var(--surface); border-radius:12px; border:1px dashed var(--line);">
                <i data-lucide="check-check" width="48" height="48" style="margin-bottom:10px; opacity:0.5;"></i>
                <div>Tout est à jour. Aucune modification locale détectée.</div>
            </div>
        `}
    `;
}

function renderChanges(container) {
    if (diffData.pois.length === 0 && diffData.stats.circuitsModified === 0) {
        container.innerHTML = `<div style="text-align:center; padding:50px;">Aucune modification à afficher.</div>`;
        return;
    }

    let html = `<div class="diff-container">`;

    // POIs
    if (diffData.pois.length > 0) {
        html += diffData.pois.map(item => `
            <div class="diff-card">
                <div class="diff-card-header">
                    <div class="diff-title">
                        <i data-lucide="map-pin" width="18" style="color:var(--brand);"></i> ${item.name}
                    </div>
                    <div class="diff-id">${item.id}</div>
                </div>
                <table class="diff-table">
                    <thead>
                        <tr>
                            <th>Propriété</th>
                            <th>Ancienne Valeur</th>
                            <th></th>
                            <th>Nouvelle Valeur</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${item.changes.map(c => `
                            <tr>
                                <td class="diff-key">${c.key}</td>
                                <td class="diff-old">${c.old}</td>
                                <td class="diff-arrow">➜</td>
                                <td class="diff-new">${c.new}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `).join('');
    }

    html += `</div>`;
    container.innerHTML = html;
}

function renderSettings(container) {
    const token = getStoredToken() || '';
    container.innerHTML = `
        <div style="max-width:600px; margin:0 auto;">
            <div style="background:var(--surface); padding:30px; border-radius:16px; border:1px solid var(--line); box-shadow:0 4px 15px rgba(0,0,0,0.02);">
                <h3 style="margin-top:0;">Configuration GitHub</h3>
                <p style="color:var(--ink-soft); margin-bottom:20px;">
                    Le Token d'accès personnel (PAT) permet à l'application d'écrire sur le dépôt GitHub.
                </p>

                <label style="display:block; margin-bottom: 8px; font-weight: 600;">Personal Access Token</label>
                <input type="password" id="cc-token-input" value="${token}" class="settings-input" placeholder="ghp_...">

                <button class="custom-modal-btn primary" id="btn-save-token" style="width:100%; margin-top:20px; padding:12px;">
                    <i data-lucide="save"></i> Sauvegarder Token
                </button>
            </div>
        </div>
    `;

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
        showToast("Token manquant. Vérifiez la configuration.", "error");
        return;
    }

    if (!confirm("Publier toutes les modifications sur GitHub ?")) return;

    const btn = document.getElementById('btn-cc-publish');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Envoi...`;
        createIcons({ icons, root: btn });
    }

    try {
        const geojson = generateMasterGeoJSONData();
        if (!geojson) throw new Error("Erreur données GeoJSON");

        const mapId = state.currentMapId || 'djerba';
        const filename = `${mapId}.geojson`;
        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
        const file = new File([blob], filename, { type: 'application/geo+json' });

        await uploadFileToGitHub(file, token, 'Stefanmartin1967', 'History-Walk-V1', `public/${filename}`, `Update via Admin Center`);

        showToast("Publication réussie !", "success");
        adminDraft = { pendingPois: {}, pendingCircuits: {} };
        saveDraft();
        updateButtonBadge();

        // Clean local userData for published POIs
        diffData.pois.forEach(p => {
             if (state.userData[p.id]) delete state.userData[p.id];
        });
        await saveAppState('userData', state.userData);

        alert("Mise à jour effectuée avec succès !");
        document.getElementById('custom-modal-overlay').classList.remove('active');

    } catch (e) {
        console.error(e);
        showToast("Erreur: " + e.message, "error");
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="rocket"></i> Réessayer`;
            createIcons({ icons, root: btn });
        }
    }
}
