// Fixture Lookup — client-side search over a pre-built data.json.
// No framework, no build step: this file is served as-is.

const state = {
  data: null,
  search: '',
  brands: new Set(),
  types: new Set(),
  ballast: 'any', // any | yes | no
  wattageMode: 'any', // any | exact | range
  wattageExact: '',
  wattageMin: '',
  wattageMax: '',
};

let currentDetailId = null;
let currentGalleryPhotos = [];

// --- wattage shorthand parsing (mirrors scripts/lib/wattage.js) ---
function parseWattage(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === '') return null;
  const kMatch = s.match(/^(\d+(?:\.\d+)?)\s*k$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const plain = s.match(/^(\d+(?:\.\d+)?)\s*w?$/);
  if (plain) return Math.round(parseFloat(plain[1]));
  return undefined; // undefined = unparseable, distinct from null = empty
}

function formatWattage(w) {
  return `${w.toLocaleString('en-US')}W`;
}

// --- data loading ---
async function loadData() {
  const res = await fetch('data.json', { cache: 'no-cache' }).catch(() => null);
  if (res && res.ok) {
    return res.json();
  }
  // Offline and not yet cached by the service worker on first-ever load.
  throw new Error('Could not load fixture data. Connect once to install the app, then it works offline.');
}

// --- filter option rendering ---
function renderOptionChips(container, values, selectedSet, name, onChange) {
  container.innerHTML = '';
  for (const value of values) {
    const label = document.createElement('label');
    label.className = 'chip';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = name;
    input.value = value;
    input.checked = selectedSet.has(value);
    input.addEventListener('change', () => {
      if (input.checked) selectedSet.add(value);
      else selectedSet.delete(value);
      onChange();
    });
    const span = document.createElement('span');
    span.textContent = value;
    label.append(input, span);
    container.appendChild(label);
  }
}

// --- filtering ---
function matchesFilters(light) {
  const { search, brands, types, ballast, wattageMode, wattageExact, wattageMin, wattageMax } = state;

  if (search) {
    const haystack = `${light.brand} ${light.model}`.toLowerCase();
    if (!haystack.includes(search)) return false;
  }
  if (brands.size > 0 && !brands.has(light.brand)) return false;
  if (types.size > 0 && !types.has(light.type)) return false;
  if (ballast === 'yes' && !light.needsBallast) return false;
  if (ballast === 'no' && light.needsBallast) return false;

  if (wattageMode === 'exact') {
    const target = parseWattage(wattageExact);
    if (target) {
      if (light.wattage !== target) return false;
    }
  } else if (wattageMode === 'range') {
    const min = parseWattage(wattageMin);
    const max = parseWattage(wattageMax);
    if (min && light.wattage < min) return false;
    if (max && light.wattage > max) return false;
  }

  return true;
}

function activeFilterCount() {
  let n = state.brands.size + state.types.size;
  if (state.ballast !== 'any') n += 1;
  if (state.wattageMode !== 'any') n += 1;
  return n;
}

// --- grid rendering ---
const grid = document.getElementById('grid');
const cardTemplate = document.getElementById('cardTemplate');
const resultCount = document.getElementById('resultCount');
const emptyState = document.getElementById('emptyState');

function renderGrid() {
  const results = state.data.lights.filter(matchesFilters);

  grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const light of results) {
    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector('.card');
    const img = node.querySelector('.card-photo img');
    if (light.primaryPhoto) {
      img.src = light.primaryPhoto;
      img.alt = `${light.brand} ${light.model}`;
    } else {
      img.removeAttribute('src');
      img.alt = '';
    }
    node.querySelector('.card-brand').textContent = light.brand;
    node.querySelector('.card-model').textContent = light.model;
    node.querySelector('.card-wattage').textContent = formatWattage(light.wattage);
    node.querySelector('.card-badge').textContent = light.type;
    card.addEventListener('click', () => openDetail(light.id));
    frag.appendChild(node);
  }
  grid.appendChild(frag);

  resultCount.textContent = `${results.length} fixture${results.length === 1 ? '' : 's'}`;
  emptyState.hidden = results.length !== 0;

  const badge = document.getElementById('filterCount');
  const count = activeFilterCount();
  badge.hidden = count === 0;
  badge.textContent = String(count);
}

// --- detail view ---
const detailView = document.getElementById('detailView');
const detailGallery = document.getElementById('detailGallery');
const galleryDots = document.getElementById('galleryDots');

function openDetail(lightId) {
  const light = state.data.lights.find((l) => l.id === lightId);
  if (!light) return;

  currentDetailId = lightId;
  currentGalleryPhotos = light.photos || [];

  document.getElementById('detailBrand').textContent = light.brand;
  document.getElementById('detailModel').textContent = light.model;
  document.getElementById('detailType').textContent = light.type;
  document.getElementById('detailWattage').textContent = formatWattage(light.wattage);
  document.getElementById('detailPower').textContent =
    light.powerUnit === 'none' ? 'None — no ballast needed' : light.powerUnit === 'ballast' ? 'Ballast' : 'External driver';

  detailGallery.innerHTML = '';
  galleryDots.innerHTML = '';
  if (currentGalleryPhotos.length === 0) {
    const div = document.createElement('div');
    div.className = 'gallery-empty';
    div.textContent = 'No photos yet';
    detailGallery.appendChild(div);
  } else {
    currentGalleryPhotos.forEach((photo, i) => {
      const img = document.createElement('img');
      img.src = photo.path;
      img.alt = photo.caption || `${light.brand} ${light.model}`;
      img.loading = i === 0 ? 'eager' : 'lazy';
      detailGallery.appendChild(img);

      if (currentGalleryPhotos.length > 1) {
        const dot = document.createElement('span');
        if (i === 0) dot.classList.add('active');
        galleryDots.appendChild(dot);
      }
    });
  }

  detailView.hidden = false;
  history.pushState({ detail: lightId }, '', `#fixture-${lightId}`);
}

function closeDetail({ fromPopstate = false } = {}) {
  if (detailView.hidden) return;
  detailView.hidden = true;
  currentDetailId = null;
  if (!fromPopstate && history.state && history.state.detail) {
    history.back();
  }
}

detailGallery.addEventListener('scroll', () => {
  if (currentGalleryPhotos.length < 2) return;
  const idx = Math.round(detailGallery.scrollLeft / detailGallery.clientWidth);
  [...galleryDots.children].forEach((dot, i) => dot.classList.toggle('active', i === idx));
});

document.getElementById('detailClose').addEventListener('click', () => closeDetail());

window.addEventListener('popstate', (e) => {
  if (!detailView.hidden) {
    closeDetail({ fromPopstate: true });
    return;
  }
  if (!filterSheet.hidden) closeFilterSheet();
});

// --- filter sheet ---
const filterSheet = document.getElementById('filterSheet');
const filterBackdrop = document.getElementById('filterBackdrop');

function openFilterSheet() {
  filterSheet.hidden = false;
  filterBackdrop.hidden = false;
  document.getElementById('filterToggle').setAttribute('aria-expanded', 'true');
}

function closeFilterSheet() {
  filterSheet.hidden = true;
  filterBackdrop.hidden = true;
  document.getElementById('filterToggle').setAttribute('aria-expanded', 'false');
}

document.getElementById('filterToggle').addEventListener('click', openFilterSheet);
document.getElementById('filterClose').addEventListener('click', closeFilterSheet);
filterBackdrop.addEventListener('click', closeFilterSheet);
document.getElementById('applyFilters').addEventListener('click', closeFilterSheet);

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!detailView.hidden) closeDetail();
  else if (!filterSheet.hidden) closeFilterSheet();
});

// ballast radios
for (const input of document.querySelectorAll('input[name="ballast"]')) {
  input.addEventListener('change', () => {
    state.ballast = input.value;
    renderGrid();
  });
}

// wattage mode
const wattageExactRow = document.getElementById('wattageExactRow');
const wattageRangeRow = document.getElementById('wattageRangeRow');
const wattageError = document.getElementById('wattageError');

function updateWattageRows() {
  wattageExactRow.hidden = state.wattageMode !== 'exact';
  wattageRangeRow.hidden = state.wattageMode !== 'range';
}

for (const input of document.querySelectorAll('input[name="wattageMode"]')) {
  input.addEventListener('change', () => {
    state.wattageMode = input.value;
    updateWattageRows();
    validateAndRenderWattage();
  });
}

function validateAndRenderWattage() {
  wattageError.hidden = true;
  if (state.wattageMode === 'exact') {
    const parsed = parseWattage(state.wattageExact);
    if (parsed === undefined) {
      wattageError.textContent = `Can't read "${state.wattageExact}" — try 4000 or 4k.`;
      wattageError.hidden = false;
      return;
    }
  } else if (state.wattageMode === 'range') {
    const min = parseWattage(state.wattageMin);
    const max = parseWattage(state.wattageMax);
    if (min === undefined || max === undefined) {
      wattageError.textContent = 'Use plain numbers or "4k" style shorthand.';
      wattageError.hidden = false;
      return;
    }
  }
  renderGrid();
}

document.getElementById('wattageExact').addEventListener('input', (e) => {
  state.wattageExact = e.target.value;
  validateAndRenderWattage();
});
document.getElementById('wattageMin').addEventListener('input', (e) => {
  state.wattageMin = e.target.value;
  validateAndRenderWattage();
});
document.getElementById('wattageMax').addEventListener('input', (e) => {
  state.wattageMax = e.target.value;
  validateAndRenderWattage();
});

document.getElementById('clearFilters').addEventListener('click', () => {
  state.brands.clear();
  state.types.clear();
  state.ballast = 'any';
  state.wattageMode = 'any';
  state.wattageExact = '';
  state.wattageMin = '';
  state.wattageMax = '';

  document.querySelectorAll('#brandOptions input, #typeOptions input').forEach((i) => (i.checked = false));
  document.querySelector('input[name="ballast"][value="any"]').checked = true;
  document.querySelector('input[name="wattageMode"][value="any"]').checked = true;
  document.getElementById('wattageExact').value = '';
  document.getElementById('wattageMin').value = '';
  document.getElementById('wattageMax').value = '';
  wattageError.hidden = true;
  updateWattageRows();

  renderGrid();
});

// search
document.getElementById('searchInput').addEventListener('input', (e) => {
  state.search = e.target.value.trim().toLowerCase();
  renderGrid();
});

// --- offline indicator ---
function updateOfflineBadge() {
  document.getElementById('offlineBadge').hidden = navigator.onLine;
}
window.addEventListener('online', updateOfflineBadge);
window.addEventListener('offline', updateOfflineBadge);

// --- service worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.error('SW registration failed', err));
  });
}

// --- init ---
async function init() {
  updateOfflineBadge();
  try {
    state.data = await loadData();
  } catch (err) {
    resultCount.textContent = '';
    emptyState.hidden = false;
    emptyState.textContent = err.message;
    return;
  }

  renderOptionChips(document.getElementById('typeOptions'), state.data.types, state.types, 'type', renderGrid);
  renderOptionChips(document.getElementById('brandOptions'), state.data.brands, state.brands, 'brand', renderGrid);

  renderGrid();
}

init();
