/* Petit Pavé — logique de l'application
   Les signalements sont stockés côté serveur (Cloudflare D1) via /api/reports,
   et donc visibles par tout le monde. */

const CATEGORIES = [
  { id: 'voirie', label: 'Voirie', emoji: '🕳️', color: '#1f8bc7' },
  { id: 'eclairage', label: 'Éclairage public', emoji: '💡', color: '#f0b25e' },
  { id: 'dechets', label: 'Déchets & propreté', emoji: '🗑️', color: '#5c8a52' },
  { id: 'mobilier', label: 'Mobilier urbain', emoji: '🪑', color: '#a15c3e' },
  { id: 'espaces-verts', label: 'Espaces verts', emoji: '🌳', color: '#3f9142' },
  { id: 'eau', label: 'Eau & assainissement', emoji: '💧', color: '#1f8bc7' },
  { id: 'signalisation', label: 'Signalisation', emoji: '🚧', color: '#e8734a' },
  { id: 'accessibilite', label: 'Accessibilité', emoji: '♿', color: '#6a5c9e' },
  { id: 'autre', label: 'Autre', emoji: '✨', color: '#7a7a7a' },
];

const MARSEILLE_CENTER = [43.2965, 5.3698];
const API_URL = '/api/reports';
const REFRESH_INTERVAL_MS = 45000;

const DEMO_REPORTS = [
  { id: 'demo-1', category: 'voirie', comment: 'Nid-de-poule assez large au milieu de la chaussée.', lat: 43.2951, lng: 5.3739, createdAt: '2026-07-14T09:12:00Z', status: 'ouvert', demo: true },
  { id: 'demo-2', category: 'eclairage', comment: "Lampadaire éteint depuis plusieurs jours, la rue est sombre le soir.", lat: 43.2971, lng: 5.3790, createdAt: '2026-07-15T20:41:00Z', status: 'ouvert', demo: true },
  { id: 'demo-3', category: 'dechets', comment: 'Dépôt sauvage de sacs poubelle sur le trottoir.', lat: 43.2732, lng: 5.3856, createdAt: '2026-07-16T08:05:00Z', status: 'resolu', demo: true },
  { id: 'demo-4', category: 'mobilier', comment: 'Banc public cassé, planche manquante.', lat: 43.2853, lng: 5.3872, createdAt: '2026-07-12T15:30:00Z', status: 'ouvert', demo: true },
  { id: 'demo-5', category: 'espaces-verts', comment: "Une branche est tombée et bloque l'allée du parc.", lat: 43.2865, lng: 5.3557, createdAt: '2026-07-17T11:00:00Z', status: 'ouvert', demo: true },
  { id: 'demo-6', category: 'signalisation', comment: 'Panneau stop couché depuis un accrochage.', lat: 43.2977, lng: 5.3822, createdAt: '2026-07-13T18:20:00Z', status: 'ouvert', demo: true },
];

let map, miniMap, miniMarker, selectedCategory = null;
let activeFilters = new Set(CATEGORIES.map(c => c.id));
let showDemo = false;
let markerLayer;
let latestReports = [];
let apiUnavailable = false;

// ---------- Accès à l'API ----------
async function fetchReports() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('bad status');
    apiUnavailable = false;
    return await res.json();
  } catch (e) {
    apiUnavailable = true;
    return [];
  }
}

async function createReport(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function patchReportStatus(id, status) {
  try {
    const res = await fetch(`${API_URL}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// ---------- Rendu des catégories ----------
function renderCategoryGrid() {
  const grid = document.getElementById('category-grid');
  grid.innerHTML = CATEGORIES.map(c => `
    <div class="category-card">
      <div class="emoji" style="background:${hexToSoft(c.color)}">${c.emoji}</div>
      <div class="label">${c.label}</div>
    </div>
  `).join('');
}

function renderFilterChips() {
  const wrap = document.getElementById('filter-chips');
  wrap.innerHTML = CATEGORIES.map(c => `
    <button type="button" class="chip active" data-filter="${c.id}">${c.emoji} ${c.label}</button>
  `).join('');
  wrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.filter;
      if (activeFilters.has(id)) {
        activeFilters.delete(id);
        chip.classList.remove('active');
      } else {
        activeFilters.add(id);
        chip.classList.add('active');
      }
      paintMarkers();
    });
  });
}

function renderCategoryPicker() {
  const wrap = document.getElementById('category-picker');
  wrap.innerHTML = CATEGORIES.map(c => `
    <button type="button" class="cat-btn" data-cat="${c.id}">${c.emoji} ${c.label}</button>
  `).join('');
  wrap.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedCategory = btn.dataset.cat;
    });
  });
}

function hexToSoft(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},0.16)`;
}

function categoryById(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

// ---------- Carte principale ----------
function initMap() {
  map = L.map('map', { scrollWheelZoom: false }).setView(MARSEILLE_CENTER, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  refreshReports();
  setInterval(refreshReports, REFRESH_INTERVAL_MS);
}

async function refreshReports() {
  latestReports = await fetchReports();
  paintMarkers();
}

function pinIcon(cat, status) {
  const c = categoryById(cat);
  const resolvedClass = status === 'resolu' ? ' resolved' : '';
  return L.divIcon({
    className: '',
    html: `<div class="marue-pin${resolvedClass}" style="background:${c.color}"><span>${c.emoji}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30],
  });
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function popupHtml(report) {
  const c = categoryById(report.category);
  const photo = report.photo ? `<img src="${report.photo}" alt="Photo du signalement">` : '';
  const resolved = report.status === 'resolu';
  const demoTag = report.demo ? ' · <em>exemple</em>' : '';
  return `
    <div class="popup-content">
      ${photo}
      <div class="popup-cat">${c.emoji} ${c.label}${demoTag}</div>
      ${report.comment ? `<div class="popup-comment">${escapeHtml(report.comment)}</div>` : ''}
      <div class="popup-date">Signalé le ${formatDate(report.createdAt)}</div>
      <label class="popup-resolve">
        <input type="checkbox" data-resolve="${report.id}" ${resolved ? 'checked' : ''} ${report.demo ? 'disabled' : ''}>
        ${resolved ? 'Marqué comme résolu' : 'Marquer comme résolu'}
      </label>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function paintMarkers() {
  if (!markerLayer) return;
  markerLayer.clearLayers();
  const all = showDemo ? latestReports.concat(DEMO_REPORTS) : latestReports;
  const visible = all.filter(r => activeFilters.has(r.category));

  visible.forEach(report => {
    const marker = L.marker([report.lat, report.lng], { icon: pinIcon(report.category, report.status) });
    marker.bindPopup(popupHtml(report));
    marker.on('popupopen', () => {
      const checkbox = document.querySelector(`[data-resolve="${report.id}"]`);
      if (checkbox && !report.demo) {
        checkbox.addEventListener('change', () => toggleResolved(report.id));
      }
    });
    markerLayer.addLayer(marker);
  });

  const emptyState = document.getElementById('empty-state');
  if (apiUnavailable && !showDemo) {
    emptyState.hidden = false;
    emptyState.textContent = "Impossible de charger les signalements partagés pour l'instant (le site doit être publié en ligne pour que cette fonctionnalité marche). Cliquez sur \"Afficher des exemples\" pour voir un aperçu.";
  } else {
    emptyState.textContent = "Aucun signalement pour l'instant. Soyez la première ou le premier à en ajouter un 🌱";
    emptyState.hidden = visible.length > 0;
  }
}

async function toggleResolved(id) {
  const report = latestReports.find(r => r.id === id);
  if (!report) return;
  const newStatus = report.status === 'resolu' ? 'ouvert' : 'resolu';
  const ok = await patchReportStatus(id, newStatus);
  if (ok) {
    report.status = newStatus;
    paintMarkers();
  } else {
    showToast("Impossible de mettre à jour ce signalement pour le moment.");
  }
}

// ---------- Démo toggle ----------
function initDemoToggle() {
  const btn = document.getElementById('demo-toggle');
  btn.addEventListener('click', () => {
    showDemo = !showDemo;
    btn.textContent = showDemo ? 'Masquer les exemples' : 'Afficher des exemples';
    paintMarkers();
  });
}

function initRefreshButton() {
  const btn = document.getElementById('refresh-btn');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    await refreshReports();
    btn.disabled = false;
    showToast('Carte actualisée.');
  });
}

// ---------- Modal & formulaire ----------
function openModal() {
  const modal = document.getElementById('report-modal');
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(initMiniMap, 50);
}

function closeModalFn() {
  const modal = document.getElementById('report-modal');
  modal.hidden = true;
  document.body.style.overflow = '';
  resetForm();
}

function resetForm() {
  document.getElementById('report-form').reset();
  document.getElementById('photo-preview').innerHTML = '';
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
  selectedCategory = null;
  window.__photoData = null;
}

function initMiniMap() {
  if (miniMap) { miniMap.invalidateSize(); return; }
  miniMap = L.map('mini-map').setView(MARSEILLE_CENTER, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(miniMap);
  miniMarker = L.marker(MARSEILLE_CENTER, { draggable: true }).addTo(miniMap);
  miniMap.on('click', (e) => miniMarker.setLatLng(e.latlng));
}

function handleGeolocate() {
  if (!navigator.geolocation) {
    showToast("La géolocalisation n'est pas disponible sur cet appareil.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const latlng = [pos.coords.latitude, pos.coords.longitude];
      miniMap.setView(latlng, 16);
      miniMarker.setLatLng(latlng);
    },
    () => showToast("Impossible de récupérer votre position. Placez le repère manuellement."),
    { timeout: 8000 }
  );
}

function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 700;
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL('image/jpeg', 0.65));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function initForm() {
  document.getElementById('photo-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    compressImage(file, (dataUrl) => {
      window.__photoData = dataUrl;
      document.getElementById('photo-preview').innerHTML = `<img src="${dataUrl}" alt="Aperçu">`;
    });
  });

  document.getElementById('locate-btn').addEventListener('click', handleGeolocate);

  document.getElementById('report-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedCategory) {
      showToast('Choisissez un type de problème pour continuer.');
      return;
    }
    const latlng = miniMarker.getLatLng();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const payload = {
      category: selectedCategory,
      comment: document.getElementById('comment').value.trim(),
      photo: window.__photoData || null,
      lat: latlng.lat,
      lng: latlng.lng,
      website: document.getElementById('website').value, // piège à robots
    };

    const { ok, data } = await createReport(payload);
    submitBtn.disabled = false;

    if (ok) {
      closeModalFn();
      showToast('Merci ! Votre signalement a été ajouté. 🌊');
      await refreshReports();
      document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      showToast(data.error || "Une erreur est survenue. Réessayez dans un instant.");
    }
  });
}

function initModalControls() {
  document.querySelectorAll('[data-open-report]').forEach(btn => btn.addEventListener('click', openModal));
  document.getElementById('close-modal').addEventListener('click', closeModalFn);
  document.getElementById('report-modal').addEventListener('click', (e) => {
    if (e.target.id === 'report-modal') closeModalFn();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('report-modal').hidden) closeModalFn();
  });
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  renderCategoryGrid();
  renderFilterChips();
  renderCategoryPicker();
  initMap();
  initDemoToggle();
  initRefreshButton();
  initModalControls();
  initForm();
});
