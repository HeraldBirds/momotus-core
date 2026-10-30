/* Sleeve state and geometry. The supplied mockup files remain unchanged. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MomotusSleevesCore=api;})(globalThis,()=>{
  'use strict';
  const sides=Object.freeze(['left','right']);
  const garments=Object.freeze(['hoodie','sudadera']);
  const labels=Object.freeze({left:'Manga izquierda',right:'Manga derecha'});
  const manifest=Object.freeze({
    hoodie:Object.freeze({
      black:Object.freeze({src:'img/mockups/mangas/hoodie-negro.webp',width:1536,height:1024,left:[307,7,316,1000],right:[914,7,313,1000]}),
      white:Object.freeze({src:'img/mockups/mangas/hoodie-blanco.webp',width:1536,height:1024,left:[328,11,366,1013],right:[888,11,366,1013]})
    }),
    sudadera:Object.freeze({black:Object.freeze({src:'img/mockups/mangas/sudadera-negro.webp',width:1448,height:1086,left:[317,6,348,1075],right:[783,5,350,1076]})})
  });
  const area=Object.freeze({x:.14,y:.16,width:.72,height:.66});
  const finite=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.min(max,Math.max(min,Number(n))):fallback;
  const safeSource=src=>typeof src==='string'&&src.length<=24*1024*1024&&/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(src);
  const empty=()=>({src:null,name:'',width:0,height:0,x:50,y:50,scale:1,rotation:0,widthCm:null});
  function slot(value){
    const out=empty();if(!value||!safeSource(value.src))return out;
    const width=Number(value.width),height=Number(value.height);
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||Math.max(width,height)>16384||width*height>40000000)return out;
    return {...out,src:value.src,name:String(value.name||'Diseño').replace(/[\x00-\x1f]/g,'').slice(0,120),width,height,
      x:finite(value.x,0,100,50),y:finite(value.y,0,100,50),scale:finite(value.scale,.1,3,1),rotation:finite(value.rotation,-180,180,0),
      widthCm:value.widthCm==null||value.widthCm===''?null:finite(value.widthCm,.5,30,null)};
  }
  const emptySide=()=>({layers:[],activeId:null});
  const blank=()=>({version:2,garments:Object.fromEntries(garments.map(g=>[g,Object.fromEntries(sides.map(s=>[s,emptySide()]))]))});
  let sequence=0;
  const newId=()=>globalThis.crypto?.randomUUID?.()||`layer-${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
  function layer(value,id){const normalized=slot(value);return normalized.src?{...normalized,id:validId(id)?id:validId(value?.id)?value.id:newId(),revision:Number.isSafeInteger(value?.revision)&&value.revision>=0?value.revision:0}:null;}
  function restore(value){
    const out=blank();if(![1,2].includes(value?.version))return out;
    for(const g of garments)for(const side of sides){
      const old=value.garments?.[g]?.[side],target=out.garments[g][side],seen=new Set();
      const entries=value.version===1?[old]:Array.isArray(old?.layers)?old.layers:[];
      for(const entry of entries){const v=layer(entry);if(!v)continue;if(seen.has(v.id))v.id=newId();seen.add(v.id);target.layers.push(v);}
      target.activeId=target.layers.some(v=>v.id===old?.activeId)?old.activeId:target.layers.at(-1)?.id||null;
    }
    return out;
  }
  const supported=g=>garments.includes(g);
  const asset=(g,color)=>manifest[g]?.[color]||null;
  const selectedLayer=side=>side?.layers?.find(v=>v.id===side.activeId)||null;
  function append(side,value){if(!side?.layers)return null;const v=layer(value,newId());if(!v)return null;side.layers.push(v);side.activeId=v.id;return v;}
  function replace(side,id,value,revision){const index=side?.layers?.findIndex(v=>v.id===id)??-1;if(index<0)return false;const current=side.layers[index];if(revision!==undefined&&revision!==current.revision)return false;const v=layer({...current,...value,revision:current.revision+1},id);if(!v)return false;side.layers[index]=v;return true;}
  function remove(side,id){const index=side?.layers?.findIndex(v=>v.id===id)??-1;if(index<0)return false;side.layers.splice(index,1);if(side.activeId===id)side.activeId=side.layers[Math.min(index,side.layers.length-1)]?.id||null;return true;}
  function move(side,id,delta){const index=side?.layers?.findIndex(v=>v.id===id)??-1;if(index<0)return false;const target=Math.max(0,Math.min(side.layers.length-1,index+delta));if(target===index)return false;const [value]=side.layers.splice(index,1);side.layers.splice(target,0,value);return true;}
  const hasDesign=(state,g)=>supported(g)&&sides.some(s=>Boolean(state?.garments?.[g]?.[s]?.layers?.length));
  function fit(value,width,height){
    if(!value?.src||!value.width||!value.height||width<=0||height<=0)return {width:0,height:0};
    const ratio=Math.min(width*.88/value.width,height*.88/value.height)*value.scale;
    return {width:value.width*ratio,height:value.height*ratio};
  }
  function outside(value,width,height){
    if(!value?.src)return false;const d=fit(value,width,height),a=value.rotation*Math.PI/180;
    const w=Math.abs(d.width*Math.cos(a))+Math.abs(d.height*Math.sin(a));
    const h=Math.abs(d.height*Math.cos(a))+Math.abs(d.width*Math.sin(a));
    const x=value.x/100*width,y=value.y/100*height;
    return x-w/2<-.01||y-h/2<-.01||x+w/2>width+.01||y+h/2>height+.01;
  }
  function summary(state,g){return supported(g)?sides.map(side=>{const rows=state.garments[g][side].layers;return labels[side]+': '+(!rows.length?'No agregado':`${rows.length} diseño${rows.length===1?'':'s'}`+rows.map((v,i)=>`\n  ${i+1}. ${v.name} · Tamaño ${Math.round(v.scale*100)}% · Posición ${Math.round(v.x)}%, ${Math.round(v.y)}% · Giro ${Math.round(v.rotation)}°${v.widthCm?` · Ancho solicitado ${v.widthCm} cm (alto proporcional ${(v.widthCm*v.height/v.width).toFixed(1)} cm)`:''}`).join(''));}).join('\n'):'';}
  return Object.freeze({sides,garments,labels,manifest,area,empty,slot,blank,restore,supported,asset,hasDesign,fit,outside,summary,safeSource,emptySide,newId,layer,selectedLayer,append,replace,remove,move});
});
