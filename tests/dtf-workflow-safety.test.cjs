const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const effects = require('../herramientas/js/tools-effects-core.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const source = read('herramientas/js/tools.js');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));

test('Efectos rechaza PNG de 16 bits antes de convertir y conserva cabeceras de 8 bits o menos', () => {
  const original = png.slice();
  for (const depth of [1, 2, 4, 8]) {
    const bytes = png.slice(); bytes[24] = depth;
    assert.equal(effects.validateSourceHeader(bytes), true);
  }
  const sixteen = png.slice(); sixteen[24] = 16;
  assert.throws(() => effects.validateSourceHeader(sixteen), /8 bits/);
  assert.equal(effects.validateSourceHeader(new Uint8Array([255, 216, 255])), true);
  assert.deepEqual(png, original);
});

function effectsLoadContext() {
  const source = read('herramientas/js/tools-effects.js');
  const calls = { installs: 0, schedules: 0, urls: 0, notices: [] };
  const context = {
    Uint8Array, Error, core: effects, console,
    cancel() {}, clearTimeout() {}, ready() {},
    setBusy(value) { vm.runInContext('busy = ' + value, context); },
    status: message => calls.notices.push(message),
    schedule() { calls.schedules++; },
    checkSource() {}, install(canvas) { calls.installs++; context.installed = canvas; },
    document: { createElement: () => ({ getContext: () => ({ drawImage() {} }) }) },
    URL: { createObjectURL() { calls.urls++; return 'blob:source'; }, revokeObjectURL() {} },
    FileReader: class {readAsDataURL(){this.result='data:image/png;base64,'+Buffer.from(png).toString('base64');this.onload();}},
    Image: class { constructor() { this.naturalWidth = 10; this.naturalHeight = 20; } decode() { return new Promise(resolve => { calls.decode = resolve; }); } }
  };
  vm.createContext(context);
  vm.runInContext('let busy = false, loadGeneration = 0, generation = 0, timer = null, originalData = null, source = { original: true }, previewResult = {};\n' +
    source.slice(source.indexOf('  async function loadFile('), source.indexOf("  byId('effects-file').addEventListener")) +
    '\nthis.load = loadFile; this.isBusy = () => busy; this.original = () => source;', context);
  return { context, calls };
}

test('cargar un PNG de 16 bits conserva el documento actual de Efectos y recupera los controles', async () => {
  const { context, calls } = effectsLoadContext(), original = context.original();
  const bytes = png.slice(); bytes[24] = 16;
  await context.load(new File([bytes], 'original-16.png', { type: 'image/png' }));
  assert.equal(context.original(), original);
  assert.equal(calls.installs, 0);
  assert.equal(calls.urls, 0);
  assert.equal(context.isBusy(), false);
  assert.match(calls.notices.at(-1), /8 bits/);
});

test('la carga de Efectos bloquea operaciones simultáneas hasta terminar la decodificación', async () => {
  const { context, calls } = effectsLoadContext();
  const file = new File([png], 'diseno.png', { type: 'image/png' });
  const loading = context.load(file);
  await flush();
  assert.equal(context.isBusy(), true);
  await context.load(file);
  assert.equal(calls.urls, 1);
  assert.equal(calls.installs, 0);
  calls.decode(); await loading;
  assert.equal(context.isBusy(), false);
  assert.equal(calls.installs, 1);
  assert.equal(calls.schedules, 1);
});

test('un fallo al enviar píxeles al trabajador de Zonas libera el proceso y permite reintentar', async () => {
  const source = read('herramientas/js/tools-color-zones.js');
  let terminated = 0;
  const context = {
    URL, Error, Promise, options: () => ({}), say() {},
    document: { baseURI: 'http://localhost/' },
    Worker: class { terminate() { terminated++; } postMessage() { throw Error('Sin memoria para transferir'); } }
  };
  vm.createContext(context);
  vm.runInContext('let job = null; const doc = { data: new Uint8Array(4), width: 1, height: 1 }; const state = { alpha: new Uint8Array(1), allowed: new Uint8Array(1), protect: new Uint8Array(1) };\n' +
    source.slice(source.indexOf(' function run(task)'), source.indexOf(' async function operation(fn)')) +
    '\nthis.run = run; this.hasJob = () => Boolean(job);', context);
  for (let i = 0; i < 2; i++) {
    await assert.rejects(context.run('analyze'), /Sin memoria/);
    assert.equal(context.hasJob(), false);
  }
  assert.equal(terminated, 2);
});

function exportContext(binaryCanvas) {
  const links = [], blobs = [], notices = [];
  const context = {
    Blob, Uint8Array, Promise, Error,
    prepareBinaryAlphaCanvas: async canvas => binaryCanvas || canvas,
    add300DpiMetadata: effects.png300,
    showToast: message => notices.push(message),
    console: { error() {} }, setTimeout() {},
    URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:test'; }, revokeObjectURL() {} },
    document: { body: { appendChild() {} }, createElement() { return { click() { links.push(this); }, remove() {} }; } }
  };
  vm.createContext(context);
  vm.runInContext(section('  const downloadCanvas =', '  const analyzeCanvasAlpha =') + '\nthis.exportPNG = downloadCanvas;', context);
  return { context, links, blobs, notices };
}

test('descargar espera la codificación completa, respeta el nombre y añade una sola resolución de 300 DPI', async () => {
  const { context, links, blobs } = exportContext();
  let callback, settled = false;
  const canvas = { width: 1, height: 1, toBlob(fn) { callback = fn; } };
  const result = context.exportPNG(canvas, 'prueba-300dpi.png', true).then(value => { settled = true; return value; });
  await flush();
  assert.equal(settled, false);
  assert.equal(links.length, 0);
  callback(new Blob([png], { type: 'image/png' }));
  assert.equal(await result, true);
  assert.equal(links[0].download, 'prueba-300dpi.png');
  const bytes = new Uint8Array(await blobs[0].arrayBuffer());
  assert.deepEqual(bytes, effects.png300(png));
  assert.equal(canvas.width, 1);
});

test('una codificación fallida permite reintentar sin anunciar una descarga inexistente', async () => {
  const { context, links, notices } = exportContext();
  assert.equal(await context.exportPNG({ toBlob(fn) { fn(null); } }, 'fallo.png', true), false);
  assert.equal(links.length, 0);
  assert.equal(notices.length, 1);
  assert.equal(await context.exportPNG({ toBlob(fn) { fn(new Blob([png])); } }, 'reintento.png', true), true);
  assert.equal(links.length, 1);
});

test('la copia de alfa sólido se libera después de descargar, sin redimensionar el original', async () => {
  const binary = { width: 8, height: 9, toBlob(fn) { fn(new Blob([png])); } };
  const original = { width: 8, height: 9 };
  const { context } = exportContext(binary);
  assert.equal(await context.exportPNG(original, 'solido.png'), true);
  assert.deepEqual([original.width, original.height], [8, 9]);
  assert.deepEqual([binary.width, binary.height], [1, 1]);
});

function preflightContext() {
  const elements = new Map(), listeners = new Map();
  const canvas = () => ({ width: 2, height: 2, pixels: [10, 20, 30, 128], getContext() { return {
    drawImage: image => { this.pixels = [...image.pixels]; }, clearRect() {}
  }; } });
  const byId = id => {
    if (!elements.has(id)) elements.set(id, Object.assign(canvas(), {
      hidden: true, value: id === 'background-scope' ? 'zones' : '', innerHTML: '',
      focus() {}, addEventListener(type, fn) { listeners.set(id + ':' + type, fn); }
    }));
    return elements.get(id);
  };
  const context = { document: { createElement: canvas }, byId, renderPreflightChecks: () => 0, showToast() {}, Math };
  vm.createContext(context);
  vm.runInContext('let pendingPreflightDownload = null;\n' +
    section('  const closePreflight =', '  const renderPreflightChecks =') +
    section('  const openPreflight =', '  const drawHalftoneShape =') +
    section("    byId('dtf-preflight-download').addEventListener", '    let previewResizeFrame =') +
    '\nthis.open = openPreflight; this.close = closePreflight; this.pending = () => pendingPreflightDownload;', context);
  return { context, byId, canvas, confirm: () => listeners.get('dtf-preflight-download:click')() };
}

test('la descarga conserva los píxeles y dimensiones revisados aunque se actualice el lienzo del editor', () => {
  const { context, canvas } = preflightContext(), original = canvas();
  context.open('background', original, 'zonas.png');
  const pending = context.pending();
  assert.notEqual(pending.canvas, original);
  original.pixels[3] = 0; original.width = 999;
  assert.deepEqual(pending.canvas.pixels, [10, 20, 30, 128]);
  assert.equal(pending.canvas.width, 2);
  context.close();
  assert.equal(pending.canvas.width, 1);
  assert.equal(original.width, 999);
});

test('confirmar dos veces o cerrar durante la exportación no duplica ni destruye la salida', async () => {
  const { context, byId, canvas, confirm } = preflightContext();
  let finish, calls = 0;
  context.downloadCanvas = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  context.open('background', canvas(), 'zonas.png');
  const pending = context.pending(), saving = confirm();
  await confirm(); context.close();
  assert.equal(calls, 1);
  assert.equal(pending.canvas.width, 2);
  assert.equal(byId('dtf-preflight-download').disabled, true);
  finish(false); await saving;
  assert.equal(context.pending(), pending);
  assert.equal(byId('dtf-preflight-download').disabled, false);
  context.downloadCanvas = async () => true;
  await confirm();
  assert.equal(context.pending(), null);
  assert.equal(byId('dtf-preflight-modal').hidden, true);
});

test('un fallo opcional de Zonas no bloquea reglas, calidad ni Efectos y admite reintento', async () => {
  const loaded = [], events = {}, elements = new Map(); let failures = 1, opened = 0;
  class Element {
    constructor(id) { this.id = id; this.classList = { add() {}, remove() {}, contains() { return false; } }; }
    closest(selector) { return selector === '#' + this.id ? this : null; }
    remove() {}
    click() { const event = { target: this, preventDefault() {}, stopImmediatePropagation() { this.stopped = true; } }; events.click(event); if (!event.stopped) this.onclick?.(); }
  }
  const zoneButton = new Element('background-zones-open'); elements.set(zoneButton.id, zoneButton);
  const append = element => { queueMicrotask(() => {
    const url = element.src || element.href; loaded.push(url);
    if (url.includes('tools-color-zones-core.js') && failures-- > 0) return element.onerror();
    if (url.includes('/tools-color-zones.js')) zoneButton.onclick = () => { opened++; };
    element.onload?.();
  }); };
  const context = {
    Element, Promise, URLSearchParams, encodeURIComponent, queueMicrotask, setTimeout() {},
    console: { error() {}, warn() {} }, location: { hash: '', search: '' },
    window: { MOMOTUS_TOOLS_DESKTOP: true, requestIdleCallback() {}, addEventListener(name, fn) { events[name] = fn; } },
    document: { createElement: () => new Element(), body: { appendChild: append }, head: { appendChild: append },
      addEventListener(name, fn) { events[name] = fn; }, getElementById: id => elements.get(id), querySelector: () => null }
  };
  vm.runInNewContext(read('herramientas/js/tools-loader.js'), context);
  for(let i=0;i<4;i++)await flush();
  assert.ok(loaded.some(url => url.includes('tools-precision.js')));
  assert.equal(opened, 0);
  zoneButton.click(); await flush();
  assert.equal(opened, 1);
  assert.equal(zoneButton.disabled, false);
  assert.equal(loaded.filter(url => url.includes('tools-color-zones-core.js')).length, 2);
});


test('Calidad local ofrece conservar alfa y lo elige por defecto para no solidificar zonas ajenas',()=>{const {context,byId,canvas}=preflightContext();context.states={quality:{qualityLocalVersion:1,qualityLocalVersions:new Map([[1,{mask:new Uint8Array([255])}]])}};context.open('quality',canvas(),'calidad-local.png');assert.equal(context.pending().canChooseAlpha,true);assert.equal(byId('dtf-export-alpha').value,'preserve');assert.equal(byId('dtf-export-alpha-control').hidden,false);});
