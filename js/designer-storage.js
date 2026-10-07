(() => {
  'use strict';

  const DB_NAME = 'momotus-designer';
  const STORE_NAME = 'designs';
  const RECORD_KEY = 'current';
  const LOCAL_KEY = 'momotusCurrentDesign';
  let pendingWrite = Promise.resolve();

  const enqueueWrite = operation => {
    const result = pendingWrite.then(operation, operation);
    pendingWrite = result.catch(() => {});
    return result;
  };

  const openDatabase = () => new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB no disponible'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento'));
  });

  const transact = async (mode, operation) => {
    const database = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        let result;
        const request = operation(transaction.objectStore(STORE_NAME));
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(request.error || new Error('No se pudo completar el almacenamiento'));
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error || new Error('Falló la transacción'));
        transaction.onabort = () => reject(transaction.error || new Error('El guardado fue cancelado'));
      });
    } finally {
      database.close();
    }
  };

  const readLocal = () => {
    try {
      const record = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
      return record?.metadataOnly ? null : record;
    } catch {
      try { localStorage.removeItem(LOCAL_KEY); } catch { /* almacenamiento bloqueado */ }
      return null;
    }
  };

  const save = data => {
    const record = { ...data, savedAt: Date.now() };
    return enqueueWrite(async () => {
      try {
        await transact('readwrite', store => store.put(record, RECORD_KEY));
      } catch (error) {
        // Conservar también las imágenes cuando IndexedDB no esté disponible.
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(record)); }
        catch { throw error; }
        return true;
      }
      try {
        const metadata = { ...record, frontDesign: null, backDesign: null, metadataOnly: true };
        localStorage.setItem(LOCAL_KEY, JSON.stringify(metadata));
      } catch { /* IndexedDB sigue siendo la fuente principal */ }
      return true;
    });
  };

  const load = async () => {
    await pendingWrite;
    const local = readLocal();
    try {
      const record = await transact('readonly', store => store.get(RECORD_KEY));
      if (record && (!local || Number(record.savedAt || 0) > Number(local.savedAt || 0))) return record;
    } catch { /* se usa compatibilidad local */ }
    return local;
  };

  const clear = () => enqueueWrite(async () => {
    try { localStorage.removeItem(LOCAL_KEY); } catch { /* almacenamiento bloqueado */ }
    if ('indexedDB' in window) await transact('readwrite', store => store.delete(RECORD_KEY));
  });

  window.MomotusDesignerStorage = Object.freeze({ save, load, clear });
})();
