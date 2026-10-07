(() => {
 'use strict';
 const names={quality:'Calidad y color',background:'Rango de color',halftone:'Semitonos',effects:'Efectos',vector:'Vectorización',production:'Producción DTF',mockup:'Mockup'};
 const panels={quality:'mejorar-calidad',background:'eliminar-fondo',halftone:'semitonos',effects:'efectos-dtf',vector:'vectorizacion'};
 const history=[];let pending=null,previousFocus=null;
 const modal=document.createElement('section');modal.id='tools-transfer-review';modal.hidden=true;modal.className='tools-transfer-review';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','tools-transfer-title');
 modal.innerHTML='<div class="tools-transfer-card"><h2 id="tools-transfer-title">Revisar envío</h2><p id="tools-transfer-path"></p><div class="tools-transfer-preview"><canvas id="tools-transfer-canvas" width="480" height="300"></canvas></div><p id="tools-transfer-metrics"></p><p>Se enviará una copia del resultado. El documento de origen se conserva en su herramienta durante esta sesión.</p><div><button id="tools-transfer-cancel" type="button">Volver a ajustar</button><button id="tools-transfer-confirm" type="button">Enviar copia</button></div></div>';document.body.append(modal);
 const close=value=>{if(!pending)return;modal.hidden=true;const resolve=pending;pending=null;previousFocus?.focus();resolve(value);};
 document.getElementById('tools-transfer-confirm').addEventListener('click',()=>close(true));document.getElementById('tools-transfer-cancel').addEventListener('click',()=>close(false));
 modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(false);}if(e.key==='Tab'){const a=document.getElementById('tools-transfer-cancel'),b=document.getElementById('tools-transfer-confirm');if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}}});
 window.MomotusReviewTransfer=(canvas,target,filename='momotus',from=window.MomotusToolsAPI?.getActiveType())=>{
  if(pending)return Promise.resolve(false);if(!canvas?.width||!canvas.height)return Promise.resolve(false);
  previousFocus=document.activeElement;document.getElementById('tools-transfer-path').textContent=`${names[from]||from||'Documento'} → ${names[target]||target}`;
  document.getElementById('tools-transfer-metrics').textContent=`${filename} · ${canvas.width} × ${canvas.height} px · ${(canvas.width/300*2.54).toFixed(1)} × ${(canvas.height/300*2.54).toFixed(1)} cm a 300 DPI`;
  const preview=document.getElementById('tools-transfer-canvas'),ctx=preview.getContext('2d'),ratio=Math.min(preview.width/canvas.width,preview.height/canvas.height);ctx.clearRect(0,0,preview.width,preview.height);ctx.drawImage(canvas,(preview.width-canvas.width*ratio)/2,(preview.height-canvas.height*ratio)/2,canvas.width*ratio,canvas.height*ratio);
  modal.hidden=false;document.getElementById('tools-transfer-confirm').focus();return new Promise(resolve=>pending=resolve);
 };
 const button=document.createElement('button');button.type='button';button.className='tools-previous-step';button.textContent='← Paso anterior';button.disabled=true;
 button.addEventListener('click',()=>{const entry=history.pop();if(!entry)return;if(entry==='production')document.querySelector('.production-launch')?.click();else{const panel=panels[entry];document.querySelector(`[data-tool-target="${panel}"], [data-extra-tool="${panel}"]`)?.click();}button.disabled=!history.length;});
 window.MomotusRememberTransfer=(from,to)=>{if(!from||from===to||to==='mockup')return;history.push(from);if(history.length>20)history.shift();button.disabled=false;};
 window.addEventListener('momotus:tools-api-ready',()=>document.querySelector('.tool-history-actions')?.append(button),{once:true});
})();
