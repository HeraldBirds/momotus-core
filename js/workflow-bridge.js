(() => {
  'use strict';

  const DATABASE_NAME = 'momotus-workflow';
  const DATABASE_VERSION = 1;
  const STORE_NAME = 'transfers';
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const WINDOW_TRANSFER_PREFIX = 'momotus-workflow-transfer:';

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
        let requestResult;
        request.onsuccess = () => { requestResult = request.result; };
        request.onerror = () => reject(request.error || new Error('No se pudo completar la transferencia.'));
        transaction.oncomplete = () => resolve(requestResult);
        transaction.onerror = () => reject(transaction.error || new Error('La transferencia local no pudo finalizar.'));
        transaction.onabort = () => reject(transaction.error || new Error('La transferencia fue cancelada.'));
      });
    } finally {
      database.close();
    }
  };

  const blobToDataURL = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('No se pudo preparar la imagen.'));
    reader.readAsDataURL(blob);
  });

  const writeWindowTransfer = async record => {
    const dataUrl = await blobToDataURL(record.blob);
    window.name = `${WINDOW_TRANSFER_PREFIX}${JSON.stringify({
      key: record.key,
      dataUrl,
      metadata: record.metadata,
      updatedAt: record.updatedAt
    })}`;
  };

  const readWindowTransfer = async key => {
    if (!String(window.name || '').startsWith(WINDOW_TRANSFER_PREFIX)) return null;
    try {
      const payload = JSON.parse(window.name.slice(WINDOW_TRANSFER_PREFIX.length));
      if (payload.key !== key || !payload.updatedAt || Date.now() - payload.updatedAt > MAX_AGE_MS || !String(payload.dataUrl || '').startsWith('data:image/')) {
        window.name = '';
        return null;
      }
      const blob = await sourceToBlob(payload.dataUrl);
      return { key, blob, metadata: { ...(payload.metadata || {}) }, updatedAt: payload.updatedAt };
    } catch (error) {
      window.name = '';
      console.warn('No se pudo recuperar el canal directo de transferencia.', error);
      return null;
    }
  };

  const put = async (key, blob, metadata = {}) => {
    if (typeof key !== 'string' || !key || !(blob instanceof Blob) || !blob.size) {
      throw new Error('El diseño no es válido para transferirlo.');
    }
    const record = { key, blob, metadata: { ...metadata }, updatedAt: Date.now() };
    const results = await Promise.allSettled([
      runTransaction('readwrite', store => store.put(record)),
      writeWindowTransfer(record)
    ]);
    if (results.every(result => result.status === 'rejected')) {
      throw new Error('El navegador bloqueó la transferencia local del diseño.');
    }
    return record;
  };

  const get = async key => {
    const directRecord = await readWindowTransfer(key);
    if (directRecord) return directRecord;
    let record = null;
    try {
      record = await runTransaction('readonly', store => store.get(key));
    } catch (error) {
      console.warn('IndexedDB no está disponible para recuperar la transferencia.', error);
    }
    if (!record) return null;
    if (!record.updatedAt || Date.now() - record.updatedAt > MAX_AGE_MS) {
      await remove(key);
      return null;
    }
    return record;
  };

  const remove = async key => {
    if (String(window.name || '').startsWith(WINDOW_TRANSFER_PREFIX)) window.name = '';
    const result = await Promise.allSettled([runTransaction('readwrite', store => store.delete(key))]);
    return result[0].status === 'fulfilled';
  };

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
