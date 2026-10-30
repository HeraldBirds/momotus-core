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
  const blank=()=>({version:1,garments:Object.fromEntries(garments.map(g=>[g,Object.fromEntries(sides.map(s=>[s,empty()]))]))});
  function restore(value){const out=blank();if(value?.version!==1)return out;for(const g of garments)for(const s of sides)out.garments[g][s]=slot(value.garments?.[g]?.[s]);return out;}
  const supported=g=>garments.includes(g);
  const asset=(g,color)=>manifest[g]?.[color]||null;
  const hasDesign=(state,g)=>supported(g)&&sides.some(s=>Boolean(state?.garments?.[g]?.[s]?.src));
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
  function summary(state,g){return supported(g)?sides.map(side=>{const v=state.garments[g][side];return labels[side]+': '+(!v.src?'No agregado':`Sí · ${v.name} · Tamaño ${Math.round(v.scale*100)}% · Posición ${Math.round(v.x)}%, ${Math.round(v.y)}% · Giro ${Math.round(v.rotation)}°${v.widthCm?` · Ancho solicitado ${v.widthCm} cm (alto proporcional ${(v.widthCm*v.height/v.width).toFixed(1)} cm)`:''}`);}).join('\n'):'';}
  return Object.freeze({sides,garments,labels,manifest,area,empty,slot,blank,restore,supported,asset,hasDesign,fit,outside,summary,safeSource});
});
