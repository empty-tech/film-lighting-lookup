// Fixture Lookup — client-side search over a pre-built data.json.
// No framework, no build step: this file is served as-is.

import { loadAll, addPhoto, deletePhoto, setDisplay, prepareImage, requestPersistence } from './user-photos.js';

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
let currentPhotoIndex = 0;

// --- on-device photos (see user-photos.js) ---
// userPhotos: lightId -> [{ id, blob, url? }]; displayRefs: lightId -> ref
const userPhotos = new Map();
const displayRefs = new Map();
let userStorageOk = true;

async function loadUserPhotos() {
  try {
    const { photos, displays } = await loadAll();
    for (const p of photos.sort((a, b) => a.createdAt - b.createdAt)) {
      if (!userPhotos.has(p.lightId)) userPhotos.set(p.lightId, []);
      userPhotos.get(p.lightId).push({ id: p.id, blob: p.blob });
    }
    for (const d of displays) displayRefs.set(d.lightId, d.ref);
  } catch (err) {
    // IndexedDB blocked (private window, etc.): bundled photos still work.
    console.error('User photo storage unavailable', err);
    userStorageOk = false;
  }
}

function userPhotoUrl(p) {
  if (!p.url) p.url = URL.createObjectURL(p.blob);
  return p.url;
}

// All photos for a fixture, display photo first. Each entry:
// { ref, src, caption, isUser, id? }
function galleryFor(light) {
  const all = [
    ...(light.photos || []).map((p) => ({ ref: p.path, src: p.path, caption: p.caption, isUser: false })),
    ...(userPhotos.get(light.id) || []).map((p) => ({
      ref: `user:${p.id}`,
      src: userPhotoUrl(p),
      caption: 'Yours',
      isUser: true,
      id: p.id,
    })),
  ];
  const wanted = displayRefs.get(light.id) || light.primaryPhoto;
  const i = all.findIndex((p) => p.ref === wanted);
  if (i > 0) all.unshift(...all.splice(i, 1));
  return all;
}

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
    const haystack = `${light.brand} ${light.model} ${(light.nicknames || []).join(' ')}`.toLowerCase();
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
    const display = galleryFor(light)[0];
    if (display) {
      img.src = display.src;
      img.alt = `${light.brand} ${light.model}`;
    } else {
      img.removeAttribute('src');
      img.alt = '';
    }
    node.querySelector('.card-brand').textContent = light.brand;
    node.querySelector('.card-model').textContent = light.model;
    const nicknamesEl = node.querySelector('.card-nicknames');
    if (light.nicknames && light.nicknames.length) {
      nicknamesEl.textContent = `aka ${light.nicknames.join(', ')}`;
      nicknamesEl.hidden = false;
    }
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

  document.getElementById('detailBrand').textContent = light.brand;
  document.getElementById('detailModel').textContent = light.model;
  const detailNicknames = document.getElementById('detailNicknames');
  if (light.nicknames && light.nicknames.length) {
    detailNicknames.textContent = `Also called: ${light.nicknames.join(', ')}`;
    detailNicknames.hidden = false;
  } else {
    detailNicknames.hidden = true;
  }
  document.getElementById('detailType').textContent = light.type;
  document.getElementById('detailWattage').textContent = formatWattage(light.wattage);
  document.getElementById('detailPower').textContent =
    light.powerUnit === 'none' ? 'None — no ballast needed' : light.powerUnit === 'ballast' ? 'Ballast' : 'External driver';

  renderDetailGallery(light);

  detailView.hidden = false;
  history.pushState({ detail: lightId }, '', `#fixture-${lightId}`);
}

// Rebuilds the gallery from bundled + on-device photos. focusRef scrolls to
// that photo (used after adding); otherwise we land on the display photo.
function renderDetailGallery(light, focusRef = null) {
  currentGalleryPhotos = galleryFor(light);

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
      img.src = photo.src;
      img.alt = photo.caption || `${light.brand} ${light.model}`;
      img.loading = i === 0 ? 'eager' : 'lazy';
      detailGallery.appendChild(img);

      if (currentGalleryPhotos.length > 1) {
        const dot = document.createElement('span');
        galleryDots.appendChild(dot);
      }
    });
  }

  const focusIndex = Math.max(0, currentGalleryPhotos.findIndex((p) => p.ref === focusRef));
  currentPhotoIndex = focusIndex;
  detailGallery.scrollLeft = focusIndex * detailGallery.clientWidth;
  updatePhotoUi();
}

function updatePhotoUi() {
  [...galleryDots.children].forEach((dot, i) => dot.classList.toggle('active', i === currentPhotoIndex));

  const photo = currentGalleryPhotos[currentPhotoIndex];
  const isDisplay = currentPhotoIndex === 0;

  const tag = document.getElementById('galleryTag');
  const tagText = [isDisplay && 'Display photo', photo?.isUser && 'Yours'].filter(Boolean).join(' · ');
  tag.textContent = tagText;
  tag.hidden = !photo || !tagText;

  document.getElementById('photoAdd').hidden = !userStorageOk;
  const setBtn = document.getElementById('photoSetDisplay');
  // Nothing to choose between with 0–1 photos.
  setBtn.hidden = !userStorageOk || currentGalleryPhotos.length < 2;
  setBtn.disabled = isDisplay;
  setBtn.textContent = isDisplay ? 'Display photo ✓' : 'Set as display photo';
  document.getElementById('photoDelete').hidden = !userStorageOk || !photo?.isUser;

  const note = document.getElementById('photoNote');
  note.hidden = userStorageOk;
  note.textContent = userStorageOk ? '' : "Photo saving isn't available in this browser mode.";
}

function currentLight() {
  return state.data.lights.find((l) => l.id === currentDetailId);
}

const photoInput = document.getElementById('photoInput');
document.getElementById('photoAdd').addEventListener('click', () => photoInput.click());

photoInput.addEventListener('change', async () => {
  const files = [...photoInput.files];
  photoInput.value = ''; // allow re-picking the same file
  const light = currentLight();
  if (!light || files.length === 0) return;

  const addBtn = document.getElementById('photoAdd');
  addBtn.disabled = true;
  addBtn.textContent = 'Saving…';
  let firstRef = null;
  let failed = 0;
  for (const file of files) {
    try {
      const blob = await prepareImage(file);
      const id = await addPhoto(light.id, blob);
      if (!userPhotos.has(light.id)) userPhotos.set(light.id, []);
      userPhotos.get(light.id).push({ id, blob });
      firstRef ??= `user:${id}`;
    } catch (err) {
      console.error('Could not save photo', err);
      failed++;
    }
  }
  addBtn.disabled = false;
  addBtn.textContent = '＋ Add photos';

  if (firstRef) {
    requestPersistence();
    renderDetailGallery(light, firstRef);
    renderGrid(); // fixtures with no display photo yet pick up the new one
  }
  if (failed) alert(`${failed} photo${failed === 1 ? '' : 's'} couldn't be saved.`);
});

document.getElementById('photoSetDisplay').addEventListener('click', async () => {
  const light = currentLight();
  const photo = currentGalleryPhotos[currentPhotoIndex];
  if (!light || !photo) return;
  try {
    await setDisplay(light.id, photo.ref);
  } catch (err) {
    console.error('Could not set display photo', err);
    alert("Couldn't save that choice.");
    return;
  }
  displayRefs.set(light.id, photo.ref);
  renderDetailGallery(light); // display photo moves to the front
  renderGrid();
});

document.getElementById('photoDelete').addEventListener('click', async () => {
  const light = currentLight();
  const photo = currentGalleryPhotos[currentPhotoIndex];
  if (!light || !photo?.isUser || !confirm('Delete this photo?')) return;
  try {
    await deletePhoto(photo.id, light.id);
  } catch (err) {
    console.error('Could not delete photo', err);
    alert("Couldn't delete that photo.");
    return;
  }
  const list = userPhotos.get(light.id) || [];
  const entry = list.find((p) => p.id === photo.id);
  if (entry?.url) URL.revokeObjectURL(entry.url);
  userPhotos.set(light.id, list.filter((p) => p.id !== photo.id));
  if (displayRefs.get(light.id) === photo.ref) displayRefs.delete(light.id);
  renderDetailGallery(light);
  renderGrid();
});

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
  currentPhotoIndex = Math.round(detailGallery.scrollLeft / detailGallery.clientWidth);
  updatePhotoUi();
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

  await loadUserPhotos();

  renderOptionChips(document.getElementById('typeOptions'), state.data.types, state.types, 'type', renderGrid);
  renderOptionChips(document.getElementById('brandOptions'), state.data.brands, state.brands, 'brand', renderGrid);

  renderGrid();
}

init();
