const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { IDBFactory } = require('fake-indexeddb');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

function storageContext(database = new IDBFactory(), localBlocked = false) {
  const records = new Map();
  const localStorage = {
    getItem: key => { if (localBlocked) throw Error('blocked'); return records.get(key) || null; },
    setItem: (key, value) => { if (localBlocked) throw Error('blocked'); records.set(key, value); },
    removeItem: key => { if (localBlocked) throw Error('blocked'); records.delete(key); }
  };
  const context = { window: database ? { indexedDB: database } : {}, indexedDB: database, localStorage, Date, Error, Promise };
  vm.runInNewContext(read('js/designer-storage.js'), context);
  return { api: context.window.MomotusDesignerStorage, records };
}

test('el proyecto recupera ambas imágenes y las transformaciones guardadas', async () => {
  const { api } = storageContext();
  await api.save({ frontDesign: 'data:image/png;base64,front', backDesign: 'data:image/png;base64,back', rotationFront: 45, scaleBack: 1.5 });
  const result = await api.load();
  assert.equal(result.frontDesign, 'data:image/png;base64,front');
  assert.equal(result.backDesign, 'data:image/png;base64,back');
  assert.equal(result.rotationFront, 45);
  assert.equal(result.scaleBack, 1.5);
});

test('borrar después de varios guardados pendientes no resucita el diseño', async () => {
  const { api } = storageContext();
  await Promise.all([api.save({ frontDesign: 'first' }), api.save({ frontDesign: 'second' }), api.clear()]);
  assert.equal(await api.load(), null);
});

test('IndexedDB bloqueado conserva las imágenes completas en el respaldo', async () => {
  const { api } = storageContext(null);
  await api.save({ frontDesign: 'front', backDesign: 'back' });
  assert.equal((await api.load()).frontDesign, 'front');
  assert.equal((await api.load()).backDesign, 'back');
});

test('una transacción abortada después de put no confirma el guardado', async () => {
  const indexedDB = new IDBFactory();
  const originalOpen = indexedDB.open.bind(indexedDB);
  indexedDB.open = (...args) => {
    const request = originalOpen(...args);
    request.addEventListener('success', () => {
      const database = request.result;
      const originalTransaction = database.transaction.bind(database);
      database.transaction = (...transactionArgs) => {
        const transaction = originalTransaction(...transactionArgs);
        const originalStore = transaction.objectStore.bind(transaction);
        transaction.objectStore = (...storeArgs) => {
          const store = originalStore(...storeArgs);
          const originalPut = store.put.bind(store);
          store.put = (...putArgs) => {
            const putRequest = originalPut(...putArgs);
            putRequest.addEventListener('success', () => transaction.abort());
            return putRequest;
          };
          return store;
        };
        return transaction;
      };
    });
    return request;
  };
  const { api } = storageContext(indexedDB, true);
  await assert.rejects(api.save({ frontDesign: 'front' }));
});

test('almacenamiento del carrito bloqueado o corrupto devuelve un estado limpio', () => {
  const source = read('js/script.js').match(/const readStoredJSON = \(key, fallback\) => \{[\s\S]*?\n\};/)[0];
  for (const getItem of [() => { throw Error('blocked'); }, () => '{broken']) {
    const context = { localStorage: { getItem, removeItem() { throw Error('blocked'); } }, console: { warn() {} } };
    vm.runInNewContext(source + '\nthis.readStoredJSON = readStoredJSON;', context);
    const fallback = [];
    assert.equal(context.readStoredJSON('momotusCart', fallback), fallback);
  }
});

test('el eliminador conserva un detalle interior del mismo color que el fondo', () => {
  const messages = [];
  const self = { postMessage: message => messages.push(message) };
  vm.runInNewContext(read('herramientas/js/tools-worker.js'), { self, Uint8ClampedArray, Uint8Array, Uint32Array, Math, Error });
  const pixels = new Uint8ClampedArray(5 * 5 * 4);
  for (let i = 0; i < 25; i++) pixels.set([255, 255, 255, 255], i * 4);
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) pixels.set([0, 0, 0, 255], (y * 5 + x) * 4);
  pixels.set([255, 255, 255, 255], 12 * 4);
  self.onmessage({ data: { kind: 'background', payload: { buffer: pixels.buffer, width: 5, height: 5, target: { r: 255, g: 255, b: 255 }, tolerance: 32, softness: 22, mode: 'remove', scope: 'connected' } } });
  const result = messages.find(message => message.type === 'result').result;
  const output = new Uint8ClampedArray(result.buffer);
  assert.equal(result.affected, 16);
  assert.equal(output[12 * 4 + 3], 255);
  assert.equal(output[3], 0);
});

test('los cuatro diseños WebP son archivos WebP reales', () => {
  for (const name of ['D1', 'D2', 'D3', 'D4']) {
    const bytes = fs.readFileSync(path.join(root, 'img/ready-designs', name + '.webp'));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
});
