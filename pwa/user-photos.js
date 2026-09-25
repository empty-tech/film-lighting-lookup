// On-device photo storage (IndexedDB) for photos taken on the job.
//
// The PWA is static, so these never leave the phone. Two stores:
//   photos:    { id, lightId, blob, createdAt }
//   displays:  { lightId, ref } — which photo is the display photo for a
//              fixture. ref is either "user:<id>" or a bundled photo path
//              (e.g. "photos/arri-m40-front.jpg"), so you can also promote a
//              bundled shot without touching the repo.

const DB_NAME = 'fixtures-user';
const DB_VERSION = 1;
const MAX_WIDTH = 1000; // matches scripts/resize-photos.js
const JPEG_QUALITY = 0.82;

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        const photos = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
        photos.createIndex('lightId', 'lightId');
        db.createObjectStore('displays', { keyPath: 'lightId' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAll() {
  const db = await openDb();
  const tx = db.transaction(['photos', 'displays'], 'readonly');
  const [photos, displays] = await Promise.all([
    request(tx.objectStore('photos').getAll()),
    request(tx.objectStore('displays').getAll()),
  ]);
  return { photos, displays };
}

export async function addPhoto(lightId, blob) {
  const db = await openDb();
  const tx = db.transaction('photos', 'readwrite');
  const id = await request(tx.objectStore('photos').add({ lightId, blob, createdAt: Date.now() }));
  await done(tx);
  return id;
}

// Deleting a photo also clears the display choice if it pointed at it.
export async function deletePhoto(id, lightId) {
  const db = await openDb();
  const tx = db.transaction(['photos', 'displays'], 'readwrite');
  tx.objectStore('photos').delete(id);
  const displays = tx.objectStore('displays');
  const current = await request(displays.get(lightId));
  if (current && current.ref === `user:${id}`) displays.delete(lightId);
  await done(tx);
}

export async function setDisplay(lightId, ref) {
  const db = await openDb();
  const tx = db.transaction('displays', 'readwrite');
  tx.objectStore('displays').put({ lightId, ref });
  await done(tx);
}

// Downscale to MAX_WIDTH and re-encode as JPEG. Phone photos are 3–5MB; this
// keeps them ~150KB so dozens fit comfortably in on-device storage.
// createImageBitmap applies EXIF orientation, so portrait shots stay upright.
export async function prepareImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_WIDTH / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', JPEG_QUALITY)
    );
  } finally {
    bitmap.close();
  }
}

// Ask the browser not to evict our storage under pressure (best effort).
export function requestPersistence() {
  return navigator.storage?.persist?.().catch(() => false);
}
