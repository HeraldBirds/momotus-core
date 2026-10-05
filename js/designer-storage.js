(() => {
  'use strict';

  const DB_NAME = 'momotus-designer';
  const STORE_NAME = 'designs';
  const RECORD_KEY = 'current';
  const LOCAL_KEY = 'momotusCurrentDesign';

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
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('No se pudo completar el almacenamiento'));
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error('Falló la transacción'));
      };
    });
  };

  const readLocal = () => {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
    } catch {
      try { localStorage.removeItem(LOCAL_KEY); } catch { /* almacenamiento bloqueado */ }
      return null;
    }
  };

  const save = async data => {
    const record = { ...data, savedAt: Date.now() };
    await transact('readwrite', store => store.put(record, RECORD_KEY));
    try {
      const metadata = { ...record, frontDesign: null, backDesign: null };
      localStorage.setItem(LOCAL_KEY, JSON.stringify(metadata));
    } catch { /* IndexedDB sigue siendo la fuente principal */ }
    return true;
  };

  const load = async () => {
    try {
      const record = await transact('readonly', store => store.get(RECORD_KEY));
      if (record) return record;
    } catch { /* se usa compatibilidad local */ }
    return readLocal();
  };

  const clear = async () => {
    try { localStorage.removeItem(LOCAL_KEY); } catch { /* almacenamiento bloqueado */ }
    try { await transact('readwrite', store => store.delete(RECORD_KEY)); } catch { /* limpieza local suficiente */ }
  };

  window.MomotusDesignerStorage = Object.freeze({ save, load, clear });
})();
