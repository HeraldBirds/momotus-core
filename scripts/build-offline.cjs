/* Rebuild after changing tool assets: npm run build:offline */
const fs=require('node:fs'),path=require('node:path'),root=path.join(__dirname,'..'),version='20261030-categories-1';
const paths=new Set(['herramientas/','herramientas/tipografias/','herramientas/preparacion/','herramientas/pliegos/','css/tailwind.css','css/style.css','js/performance.js','js/motion-core.js','js/site-motion.js','css/site-motion.css','js/workflow-bridge.js','herramientas/manifest.webmanifest','herramientas/icons/app-192.png','herramientas/icons/app-512.png']);
function walk(folder,exts){for(const e of fs.readdirSync(path.join(root,folder),{withFileTypes:true})){const p=folder+'/'+e.name;if(e.isDirectory())walk(p,exts);else if(exts.includes(path.extname(e.name)))paths.add(p);}}
for(const folder of ['herramientas/js','herramientas/css','herramientas/preparacion','herramientas/pliegos','herramientas/tipografias'])walk(folder,['.js','.css','.ttf','.otf','.woff','.woff2']);
for(const folder of ['herramientas/vendor','vendor/fontawesome'])walk(folder,['.js','.css','.woff2']);walk('herramientas/tipografias/references-new',['.png']);
walk('herramientas/cursors',['.svg']);
const files=[...paths].sort().map(url=>({url,bytes:fs.statSync(path.join(root,url.endsWith('/')?url+'index.html':url)).size}));
if(files.length>400||files.some(f=>f.bytes>8*1048576)||files.reduce((n,f)=>n+f.bytes,0)>80*1048576)throw Error('El paquete sin conexión excede su presupuesto.');
fs.writeFileSync(path.join(root,'herramientas/offline-resources.json'),JSON.stringify({version,files},null,2)+'\n');console.log(files.length+' archivos · '+(files.reduce((n,f)=>n+f.bytes,0)/1048576).toFixed(1)+' MiB');
