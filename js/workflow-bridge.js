(() => {
  'use strict';

  const DATABASE_NAME = 'momotus-workflow';
  const DATABASE_VERSION = 1;
  const STORE_NAME = 'transfers';
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;

  const openDatabase = () => new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('Este navegador no permite transferencias locales.'));
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento local.'));
  });

  const runTransaction = async (mode, operation) => {
    const database = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = operation(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('No se pudo completar la transferencia.'));
        transaction.onabort = () => reject(transaction.error || new Error('La transferencia fue cancelada.'));
      });
    } finally {
      database.close();
    }
  };

  const put = async (key, blob, metadata = {}) => {
    if (typeof key !== 'string' || !key || !(blob instanceof Blob) || !blob.size) {
      throw new Error('El diseño no es válido para transferirlo.');
    }
    const record = { key, blob, metadata: { ...metadata }, updatedAt: Date.now() };
    await runTransaction('readwrite', store => store.put(record));
    return record;
  };

  const get = async key => {
    const record = await runTransaction('readonly', store => store.get(key));
    if (!record) return null;
    if (!record.updatedAt || Date.now() - record.updatedAt > MAX_AGE_MS) {
      await remove(key);
      return null;
    }
    return record;
  };

  const remove = key => runTransaction('readwrite', store => store.delete(key));

  const sourceToBlob = async source => {
    if (typeof source !== 'string' || !source) throw new Error('No hay un diseño activo para transferir.');
    if (source.startsWith('data:')) {
      const separator = source.indexOf(',');
      if (separator < 0) throw new Error('El diseño activo no tiene un formato válido.');
      const header = source.slice(5, separator);
      const mimeType = header.split(';')[0] || 'application/octet-stream';
      const payload = source.slice(separator + 1);
      const binary = /;base64/i.test(header) ? atob(payload) : decodeURIComponent(payload);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const blob = new Blob([bytes], { type: mimeType });
      if (!blob.type.startsWith('image/')) throw new Error('El archivo activo no es una imagen válida.');
      return blob;
    }
    const response = await fetch(source);
    if (!response.ok && !source.startsWith('data:') && !source.startsWith('blob:')) {
      throw new Error('No se pudo leer el diseño activo.');
    }
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('El archivo activo no es una imagen válida.');
    return blob;
  };

  const blobToDataURL = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('No se pudo preparar la imagen.'));
    reader.readAsDataURL(blob);
  });

  window.MomotusWorkflowBridge = Object.freeze({
    put,
    get,
    remove,
    sourceToBlob,
    blobToDataURL,
    keys: Object.freeze({
      designerToTools: 'designer-to-tools',
      toolsToDesigner: 'tools-to-designer'
    })
  });
})();
