importScripts('selection-core.js?v='+encodeURIComponent(new URL(location.href).searchParams.get('v')||'1'));
onmessage=e=>{try{const p=e.data;let mask=p.task==='color'?MomotusSelection.color(p.data,p.width,p.height,p.x,p.y,p.tolerance,p.connected):MomotusSelection.refine(p.mask,p.width,p.height,p.operation,p.radius);postMessage({mask},[mask.buffer]);}catch(e){postMessage({error:e.message});}};
