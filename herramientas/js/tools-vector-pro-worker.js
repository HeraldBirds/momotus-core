'use strict';
importScripts('tools-vector-core.js'+self.location.search,'tools-vector-pro-core.js'+self.location.search,'tools-vector-network.js'+self.location.search,'../vendor/paper/paper-core.min.js');
paper.setup([1,1]);
const V=MomotusVectorPro;
const toRing=p=>p.segments.map(s=>[s.point.x,s.point.y,s.handleIn.x,s.handleIn.y,s.handleOut.x,s.handleOut.y]);
function fitLoop(points,fitTolerance,curves,tolerance=fitTolerance,closed=true){
 const original=new paper.Path({segments:points,closed,insert:false});
 if(!fitTolerance||points.length>2000||points.length<=(closed?4:2))return original;
 const candidate=curves?original.clone({insert:false}):new paper.Path({segments:closed?MomotusVectorCore.simplifyClosed(points,fitTolerance):MomotusVectorNetwork.simplifyOpen(points,fitTolerance),closed,insert:false});
 // Paper 0.12 PathFitter compares squared distances. UI tolerance is linear pixels.
 if(curves)candidate.simplify(fitTolerance*fitTolerance);
 // Reject intersections, large area changes and displaced corners before raster proof.
 let valid=candidate.segments.length>=(closed?3:2)&&(!closed||Math.sign(candidate.area)===Math.sign(original.area)&&Math.abs(candidate.area-original.area)<=Math.max(1,Math.abs(original.area)*.03))&&(!closed?candidate.firstSegment.point.equals(original.firstSegment.point)&&candidate.lastSegment.point.equals(original.lastSegment.point):true);
 if(valid&&candidate.getIntersections().some(l=>l.isCrossing()))valid=false;
 if(valid){for(let i=closed?0:1;i<(closed?points.length:points.length-1);i++){const p=original.segments[i].point,a=p.subtract(original.segments[(i+points.length-1)%points.length].point),b=original.segments[(i+1)%points.length].point.subtract(p);const bound=a.length>=3&&b.length>=3&&Math.abs(a.getDirectedAngle(b))>60?.02:tolerance;if(p.getDistance(candidate.getNearestPoint(p))>bound+.0001){valid=false;break;}}}
 // Distance to a closed set is 1-Lipschitz. Reserve half the arc-length
 // sample spacing on BOTH boundaries, giving a conservative deviation bound.
 if(valid){const step=Math.min(.5,tolerance/2);let budget=16000;
  for(const [from,to] of [[candidate,original],[original,candidate]]){
   const length=from.length,count=Math.max(1,Math.ceil(length/step)),margin=length/count/2+1e-6;
   budget-=count;if(budget<0){valid=false;break;}
   for(let i=0;i<=count;i++){const p=from.getPointAt(length*i/count);if(p&&p.getDistance(to.getNearestPoint(p))+margin>tolerance){valid=false;break;}}
   if(!valid)break;
  }
 }
 if(valid){original.remove();return candidate;}candidate.remove();original.data.failedFit=true;return original;
}
onmessage=event=>{try{
 const {rgba,width,height,settings,filename,widthCm}=event.data;V.dimensions(width,height);const progress=value=>postMessage({progress:value}),analyzed=V.analyze(new Uint8ClampedArray(rgba),width,height,settings,progress),raw=[];let rawNodes=0;
 for(const r of V.regions(analyzed.labels,width,height,progress)){const loops=MomotusVectorCore.contours(r.labels,r.width,r.height,0).map(ring=>ring.map(p=>[p[0]+r.x,p[1]+r.y]));rawNodes+=loops.reduce((n,r)=>n+r.length,0);if(rawNodes>V.MAX_NODES*2)throw Error('El diseño supera el presupuesto de contornos. Procesá un recorte o reducí el detalle.');raw.push({id:'o'+raw.length,color:r.color,area:r.area,x:r.x,y:r.y,width:r.width,height:r.height,loops});}
 let network=null,chains=null,rejected=0,protectedEdges=0;
 if(settings.tolerance){try{network=MomotusVectorNetwork.build(analyzed.labels,width,height);}catch(error){if(error.message!=='NETWORK_BUDGET')throw error;}}
 if(network){chains=network.chains.map((c,index)=>{let p;for(let attempt=0;attempt<5;attempt++){p=fitLoop(c.points,settings.tolerance/2**attempt,settings.curves,settings.tolerance,c.closed);if(!p.data.failedFit)break;p.remove();p=null;}const exact=c.points.map(p=>[...p,0,0,0,0]),segments=p?toRing(p):exact;p?.remove();return {...c,segments,exact,fitted:JSON.stringify(segments)!==JSON.stringify(exact)};});
  for(const o of raw)o.refs=o.loops.map(network.ringRefs);
  const assemble=o=>o.refs.map(refs=>MomotusVectorNetwork.assemble(refs,chains));
  const proof=o=>{const pad=Math.ceil(settings.tolerance)+1,w=o.width+pad*2,h=o.height+pad*2;if(w*h>4000000||typeof OffscreenCanvas==='undefined')return false;const c=new OffscreenCanvas(w,h),ctx=c.getContext('2d',{willReadFrequently:true});ctx.translate(pad-o.x,pad-o.y);ctx.fill(new Path2D(V.pathData(o.loops.map(r=>r.map(p=>[...p,0,0,0,0])))),'evenodd');const a=ctx.getImageData(0,0,w,h).data;ctx.clearRect(o.x-pad,o.y-pad,w,h);ctx.fill(new Path2D(V.pathData(assemble(o))),'evenodd');const b=ctx.getImageData(0,0,w,h).data;let ok=true;for(let i=3;i<a.length;i+=4)if((a[i]>=128)!==(b[i]>=128)){ok=false;break;}c.width=c.height=1;return ok;};
  let settled=false;for(let pass=0;pass<5;pass++){let changed=false;for(let i=0;i<raw.length;i++){const o=raw[i],ids=new Set(o.refs.flat().map(r=>r.chain));if([...ids].some(id=>chains[id].fitted)&&!proof(o)){rejected++;for(const id of ids){chains[id].segments=chains[id].exact;chains[id].fitted=false;}changed=true;}if(i%100===0)progress(80+Math.round(15*i/Math.max(1,raw.length)));}if(!changed){settled=true;break;}}
  if(!settled){for(const c of chains){c.segments=c.exact;c.fitted=false;}}
  for(const o of raw)o.rings=assemble(o);protectedEdges=network.edges;
 }else{for(const o of raw)o.rings=o.loops.map(r=>r.map(p=>[...p,0,0,0,0]));if(settings.tolerance)rejected=raw.length;}
 const objects=raw.map(o=>({id:o.id,name:'Objeto '+(Number(o.id.slice(1))+1),color:o.color,visible:true,locked:false,area:o.area,rings:o.rings})),nodes=objects.reduce((n,o)=>n+o.rings.reduce((n,r)=>n+r.length,0),0);
 if(nodes>V.MAX_NODES)throw Error('Más de 180.000 nodos. Procesá un recorte o reducí el detalle; no se descartaron detalles.');
 const doc={version:1,width,height,widthCm,filename,palette:analyzed.palette,objects,settings};V.validate(doc);postMessage({doc,metrics:{error:analyzed.error,rejected,nodes,protectedEdges,sharedCurves:chains?.filter(c=>c.fitted).length||0,exactFallback:!!settings.tolerance&&!network}});
}catch(error){postMessage({error:error.message});}};
