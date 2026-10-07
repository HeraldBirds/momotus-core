/* Contornos por color. Coordenadas del documento, huecos evenodd y curvas acotadas. */
(function(root){
  'use strict';
  function contours(labels,width,height,color){
    const edges=new Map(),stride=width+1;
    const add=(x,y,nx,ny,d)=>{const key=y*stride+x;if(!edges.has(key))edges.set(key,[]);edges.get(key).push({end:ny*stride+nx,d});};
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      if(labels[y*width+x]!==color)continue;
      if(y===0||labels[(y-1)*width+x]!==color)add(x,y,x+1,y,0);
      if(x===width-1||labels[y*width+x+1]!==color)add(x+1,y,x+1,y+1,1);
      if(y===height-1||labels[(y+1)*width+x]!==color)add(x+1,y+1,x,y+1,2);
      if(x===0||labels[y*width+x-1]!==color)add(x,y+1,x,y,3);
    }
    const loops=[];
    while(edges.size){
      const start=edges.keys().next().value;let key=start,direction=-1;const points=[];
      do{
        points.push([key%stride,Math.floor(key/stride)]);
        const options=edges.get(key);if(!options?.length)throw Error('Contorno incompleto. Probá el modo de bloques.');
        let index=0;
        if(direction>=0){let best=99;options.forEach((e,i)=>{const turn=(e.d-direction+4)%4,rank=({1:0,0:1,3:2,2:3})[turn];if(rank<best){best=rank;index=i;}});}
        const edge=options.splice(index,1)[0];if(!options.length)edges.delete(key);key=edge.end;direction=edge.d;
      }while(key!==start);
      // Eliminar solo puntos colineales: conserva esquinas, detalles y agujeros.
      const clean=points.filter((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];return (p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);});
      if(clean.length>=3)loops.push(clean);
    }
    return loops;
  }
  function distance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
  function simplifyOpen(points,tolerance){
    const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];
    while(stack.length){const [a,b]=stack.pop();let max=tolerance,index=-1;for(let i=a+1;i<b;i++){const d=distance(points[i],points[a],points[b]);if(d>max){max=d;index=i;}}if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}}
    return [...keep].sort((a,b)=>a-b).map(i=>points[i]);
  }
  function simplifyClosed(points,tolerance){
    if(!tolerance||points.length<=4)return points;
    let split=1,max=0;points.forEach((p,i)=>{const d=Math.hypot(p[0]-points[0][0],p[1]-points[0][1]);if(d>max){max=d;split=i;}});
    const result=[...simplifyOpen(points.slice(0,split+1),tolerance).slice(0,-1),...simplifyOpen([...points.slice(split),points[0]],tolerance).slice(0,-1)];
    return result.length>=3?result:points;
  }
  const num=v=>Number(v.toFixed(3));
  function path(points,curves){
    if(!curves)return `M${points.map(p=>p.map(num).join(' ')).join('L')}Z`;
    const corners=points.map((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length],r=Math.min(.25,Math.hypot(p[0]-a[0],p[1]-a[1])/4,Math.hypot(p[0]-b[0],p[1]-b[1])/4);const toward=q=>{const d=Math.hypot(q[0]-p[0],q[1]-p[1]);return [num(p[0]+(q[0]-p[0])*r/d),num(p[1]+(q[1]-p[1])*r/d)];};return {p,entry:toward(a),exit:toward(b)};});
    return `M${corners[0].entry.join(' ')}${corners.map(c=>`L${c.entry.join(' ')}Q${c.p.map(num).join(' ')} ${c.exit.join(' ')}`).join('')}Z`;
  }
  function build(labels,palette,width,height,widthCm,{tolerance=0,curves=false}={}){
    let runs=0,nodes=0;const body=palette.map((color,i)=>{const loops=contours(labels,width,height,i).map(p=>simplifyClosed(p,Math.max(0,Math.min(2,tolerance))));runs+=loops.length;nodes+=loops.reduce((n,p)=>n+p.length,0);const hex='#'+color.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');return loops.length?`<path data-color="${i}" fill="${hex}" fill-rule="evenodd" d="${loops.map(p=>path(p,curves)).join('')}"/>`:'';}).join('');
    const heightCm=widthCm*height/width;
    return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${widthCm}cm" height="${heightCm.toFixed(3)}cm" viewBox="0 0 ${width} ${height}"><title>Momotus · contornos por color</title>${body}</svg>`,runs,nodes,heightCm};
  }
  const api=Object.freeze({contours,build,simplifyClosed});if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MomotusVectorCore=api;
})(typeof window!=='undefined'?window:globalThis);
