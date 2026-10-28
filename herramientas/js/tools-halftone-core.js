(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MomotusHalftone=api;})(globalThis,()=>{
'use strict';
const clampUnit=n=>Math.max(0,Math.min(1,n));
const perceptualColorDistance=(r,g,b,t)=>{const m=(r+t.r)/2;return Math.sqrt((2+m/256)*(r-t.r)**2+4*(g-t.g)**2+(2+(255-m)/256)*(b-t.b)**2)/1.5;};
const nextFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
  const sampleHalftoneCell = (state, x, y, cellSize) => {
    const data = state.imageData.data;
    const radius = Math.max(1, cellSize * 0.34);
    let red = 0, green = 0, blue = 0;
    let redSquared = 0, greenSquared = 0, blueSquared = 0;
    let alpha = 0, samples = 0;
    for (let row = -1; row <= 1; row++) {
      for (let column = -1; column <= 1; column++) {
        const sampleX = Math.min(state.width - 1, Math.max(0, Math.round(x + column * radius)));
        const sampleY = Math.min(state.height - 1, Math.max(0, Math.round(y + row * radius)));
        const index = (sampleY * state.width + sampleX) * 4;
        const pixelAlpha = data[index + 3] / 255;
        red += data[index] * pixelAlpha;
        green += data[index + 1] * pixelAlpha;
        blue += data[index + 2] * pixelAlpha;
        redSquared += data[index] * data[index] * pixelAlpha;
        greenSquared += data[index + 1] * data[index + 1] * pixelAlpha;
        blueSquared += data[index + 2] * data[index + 2] * pixelAlpha;
        alpha += pixelAlpha;
        samples++;
      }
    }
    const averageRed = alpha > 0 ? red / alpha : 0;
    const averageGreen = alpha > 0 ? green / alpha : 0;
    const averageBlue = alpha > 0 ? blue / alpha : 0;
    const channelVariance = alpha > 0
      ? Math.max(0,
        redSquared / alpha - averageRed * averageRed
        + greenSquared / alpha - averageGreen * averageGreen
        + blueSquared / alpha - averageBlue * averageBlue) / 3
      : 0;
    return {
      r: averageRed,
      g: averageGreen,
      b: averageBlue,
      a: alpha / samples,
      variation: Math.sqrt(channelVariance)
    };
  };

  const getHueAndSaturation = (red, green, blue) => {
    const r = red / 255, g = green / 255, b = blue / 255;
    const maximum = Math.max(r, g, b), minimum = Math.min(r, g, b);
    const delta = maximum - minimum;
    let hue = 0;
    if (delta > 0) {
      if (maximum === r) hue = 60 * (((g - b) / delta) % 6);
      else if (maximum === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
    }
    if (hue < 0) hue += 360;
    return { hue, saturation: maximum === 0 ? 0 : delta / maximum };
  };

  const halftoneColorStrength = (hueRange, red, green, blue, stats) => {
    if (hueRange === 'all') return 1;
    const color = getHueAndSaturation(red, green, blue);
    if (hueRange === 'neutral') return clampUnit((0.32 - color.saturation) / 0.18);
    if (hueRange === 'vivid') return clampUnit((color.saturation - 0.12) / 0.35);
    if (color.saturation < 0.08) return 0;
    const centers = { reds: 0, oranges: 30, yellows: 60, greens: 120, cyans: 180, blues: 225, purples: 300 };
    const targetHue = hueRange === 'dominant' ? stats.dominantHue : centers[hueRange];
    if (!Number.isFinite(targetHue)) return 1;
    const distance = Math.min(Math.abs(color.hue - targetHue), 360 - Math.abs(color.hue - targetHue));
    return clampUnit((65 - distance) / 35) * clampUnit(color.saturation / 0.22);
  };

  const halftoneSelectionStrength = (range, luminance, variation, protection, edgeProtection, amount, colorStrength = 1) => {
    const shadowWeight = clampUnit((175 - luminance) / 145);
    const highlightWeight = clampUnit((luminance - 80) / 155);
    const midtoneWeight = clampUnit(1 - Math.abs(luminance - 128) / 105);
    const detailWeight = clampUnit((variation - 3) / 40);
    let rangeWeight = 1;
    if (range === 'transitions') rangeWeight = Math.max(detailWeight, shadowWeight * 0.35);
    else if (range === 'shadows') rangeWeight = shadowWeight;
    else if (range === 'midtones') rangeWeight = midtoneWeight;
    else if (range === 'highlights') rangeWeight = highlightWeight;
    const solidProtection = (1 - protection) + protection * Math.max(0.15, detailWeight);
    const fineDetailProtection = 1 - edgeProtection * clampUnit((variation - 18) / 55) * 0.72;
    return clampUnit(rangeWeight * solidProtection * fineDetailProtection * amount * colorStrength);
  };

  // Bayer 64 × 64: 4096 niveles espaciales, sin bandas de 1/16.
  const halftoneGridThreshold = (x,y) => {
    x=((x%64)+64)%64;y=((y%64)+64)%64;
    let rank=0;for(let bit=0;bit<6;bit++){const a=(x>>bit)&1,b=(y>>bit)&1;rank=rank*4+((a^b)*2+b);}
    return (rank+.5)/4096;
  };

  // Independent from the minimum-dot distribution: reusing its threshold
  // correlates selection with highlight dots and overstates light coverage.
  const selectionThreshold=(x,y)=>{
    let n=Math.imul(x|0,0x1f123bb5)^Math.imul(y|0,0x5f356495)^0x6a09e667;
    n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);n^=n>>>16;
    return ((n>>>0)+.5)/4294967296;
  };

  const estimateHalftoneBackground = (state, cellSize) => {
    const margin = Math.max(1, cellSize * 0.55);
    const corners = [
      sampleHalftoneCell(state, margin, margin, cellSize),
      sampleHalftoneCell(state, state.width - margin, margin, cellSize),
      sampleHalftoneCell(state, margin, state.height - margin, cellSize),
      sampleHalftoneCell(state, state.width - margin, state.height - margin, cellSize)
    ].filter(sample => sample.a > 0.25);
    if (corners.length < 2) return null;
    let closestPair = [corners[0], corners[1]];
    let closestDistance = Infinity;
    for (let first = 0; first < corners.length; first++) {
      for (let second = first + 1; second < corners.length; second++) {
        const distance = perceptualColorDistance(corners[first].r, corners[first].g, corners[first].b, corners[second]);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPair = [corners[first], corners[second]];
        }
      }
    }
    return {
      r: (closestPair[0].r + closestPair[1].r) / 2,
      g: (closestPair[0].g + closestPair[1].g) / 2,
      b: (closestPair[0].b + closestPair[1].b) / 2
    };
  };

  const getHalftoneBackgroundMask = async (state, cellSize, tolerance, mode, isCancelled = () => false) => {
    if (mode !== 'edge') return null;
    const cacheKey = `${cellSize.toFixed(3)}:${tolerance}`;
    if (state.halftoneMaskCache?.key === cacheKey) return state.halftoneMaskCache;
    const columns = Math.ceil(state.width / cellSize);
    const rows = Math.ceil(state.height / cellSize);
    const count = columns * rows;
    const candidates = new Uint8Array(count);
    const background = new Uint8Array(count);
    const target = estimateHalftoneBackground(state, cellSize);

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const sample = sampleHalftoneCell(state, (column + 0.5) * cellSize, (row + 0.5) * cellSize, cellSize);
        const transparent = sample.a < 0.08;
        const matchesEdgeColor = target && sample.a > 0.2
          && perceptualColorDistance(sample.r, sample.g, sample.b, target) <= tolerance;
        candidates[row * columns + column] = transparent || matchesEdgeColor ? 1 : 0;
      }
      if (row > 0 && row % 36 === 0) {
        await nextFrame();
        if (isCancelled()) return null;
      }
    }

    const queue = new Int32Array(count);
    let queueStart = 0;
    let queueEnd = 0;
    const enqueue = index => {
      if (!candidates[index] || background[index]) return;
      background[index] = 1;
      queue[queueEnd++] = index;
    };
    for (let column = 0; column < columns; column++) {
      enqueue(column);
      enqueue((rows - 1) * columns + column);
    }
    for (let row = 1; row < rows - 1; row++) {
      enqueue(row * columns);
      enqueue(row * columns + columns - 1);
    }
    while (queueStart < queueEnd) {
      const index = queue[queueStart++];
      const row = Math.floor(index / columns);
      const column = index - row * columns;
      if (column > 0) enqueue(index - 1);
      if (column + 1 < columns) enqueue(index + 1);
      if (row > 0) enqueue(index - columns);
      if (row + 1 < rows) enqueue(index + columns);
      if (queueStart % 120000 === 0) {
        await nextFrame();
        if (isCancelled()) return null;
      }
    }
    state.halftoneMaskCache = { key: cacheKey, background, columns, rows };
    return state.halftoneMaskCache;
  };

function geometry(shape,diameter){
 if(!['circle','ellipse','square','diamond','line'].includes(shape)||!Number.isFinite(diameter)||diameter<0)throw Error('Geometría inválida.');
 let width=diameter,height=diameter,area=Math.PI*diameter*diameter/4;
 if(shape==='ellipse'){height=diameter*.6;area=Math.PI*width*height/4;}
 if(shape==='square'){width=height=diameter/Math.SQRT2;area=width*height;}
 if(shape==='diamond')area=diameter*diameter/2;
 if(shape==='line'){width=diameter/Math.sqrt(1+.26**2);height=width*.26;area=width*height;}
 return {width,height,area,feature:shape==='diamond'?diameter/Math.SQRT2:Math.min(width,height)};
}
function curve(value,points=[25,50,75]){
 if(!Array.isArray(points)||points.length!==3||points.some((v,i)=>!Number.isFinite(v)||v<0||v>100||i&&v<points[i-1]))throw Error('La curva debe subir de luces a sombras (0–100 %).');
 const p=[0,...points.map(n=>n/100),1],x=clampUnit(value)*4,i=Math.min(3,Math.floor(x));return p[i]+(p[i+1]-p[i])*(x-i);
}
function point(shape,cell,coverage,minDiameter,maxDiameter,hole=0,gx=0,gy=0){
 const coefficient=geometry(shape,1).area,cap=Math.max(0,Math.min(maxDiameter,cell-hole));
 if(!coverage||cap<=0||minDiameter>cap)return {diameter:0,coverage:0};
 const area=clampUnit(coverage)*cell*cell,minArea=coefficient*minDiameter*minDiameter;
 if(area<minArea&&area/minArea<halftoneGridThreshold(gx,gy))return {diameter:0,coverage:0};
 const diameter=Math.min(cap,Math.max(minDiameter,Math.sqrt(area/coefficient)));
 return {diameter,coverage:coefficient*diameter*diameter/(cell*cell)};
}
function dimensions(w,h){if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>6000||h>6000||w*h>18000000)throw Error('La salida admite hasta 18 MP y 6000 px por lado.');}
function validateColorSelection(s){
 if(s==null)return true;
 if(!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).some(k=>!['enabled','include','exclude','tolerance'].includes(k))||typeof s.enabled!=='boolean'||!Number.isFinite(s.tolerance)||s.tolerance<0||s.tolerance>150||!['include','exclude'].every(k=>Array.isArray(s[k])&&s[k].length<=16&&s[k].every(v=>typeof v==='string'&&/^#[\da-f]{6}$/i.test(v))))throw Error('Selección de colores inválida. Máximo 16 muestras por lista.');
 return true;
}
function colorMatcher(s){
 validateColorSelection(s);if(!s?.enabled)return()=>1;
 const rgb=hex=>({r:parseInt(hex.slice(1,3),16),g:parseInt(hex.slice(3,5),16),b:parseInt(hex.slice(5,7),16)}),include=s.include.map(rgb),exclude=s.exclude.map(rgb),limit=s.tolerance;
 const limitSquared=limit*limit*2.25,near=(r,g,b,t)=>{const m=(r+t.r)/2;return(2+m/256)*(r-t.r)**2+4*(g-t.g)**2+(2+(255-m)/256)*(b-t.b)**2<=limitSquared;};
 return(r,g,b)=>{let found=false;for(const t of include)if(near(r,g,b,t)){found=true;break;}if(!found)return 0;for(const t of exclude)if(near(r,g,b,t))return 0;return 1;};
}
function paletteHistogram(){return{weight:new Float64Array(32768),color:new Uint32Array(32768),total:0};}
function paletteAccumulate(hist,data){
 if(!(data instanceof Uint8ClampedArray)||data.length%4)throw Error('Píxeles de paleta inválidos.');
 for(let i=0;i<data.length;i+=4){const a=data[i+3];if(!a)continue;const key=(data[i]>>3)*1024+(data[i+1]>>3)*32+(data[i+2]>>3);if(!hist.weight[key])hist.color[key]=(data[i]<<16)|(data[i+1]<<8)|data[i+2];hist.weight[key]+=a;hist.total+=a;}return hist;
}
function paletteFromHistogram(hist,detail=16){
 if(![8,16,32].includes(detail))throw Error('Detalle de paleta inválido.');
 const rows=[];for(let k=0;k<hist.weight.length;k++)if(hist.weight[k])rows.push({key:k,weight:hist.weight[k],color:hist.color[k]});rows.sort((a,b)=>b.weight-a.weight||a.key-b.key);
 const colors=[],distance={8:70,16:38,32:18}[detail];
 for(const row of rows){const r=row.color>>16,g=(row.color>>8)&255,b=row.color&255;let nearest=-1,min=Infinity;for(let i=0;i<colors.length;i++){const d=perceptualColorDistance(r,g,b,colors[i]);if(d<min){nearest=i;min=d;}}if(nearest<0||min>distance&&colors.length<detail)colors.push({r,g,b,hex:'#'+row.color.toString(16).padStart(6,'0'),weight:row.weight});else colors[nearest].weight+=row.weight;}
 return colors.sort((a,b)=>b.weight-a.weight||a.hex.localeCompare(b.hex)).map(c=>({hex:c.hex,percent:hist.total?c.weight/hist.total*100:0}));
}

function validateOptions(o){
 const range=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
 if(!o||!range(o.frequency,45,70)||!range(o.maximumDotMm,.3,.6)||!range(o.minimumDotMm,.05,.3)||o.minimumDotMm>o.maximumDotMm||!range(o.dotGain,-.2,.2)||!range(o.angleDegrees,-90,90)||!range(o.contrast,-80,100)||!range(o.holeMm,0,.3)||!['tone','alpha'].includes(o.basis)||!['original','mono'].includes(o.colorMode)||!['edge','alpha','none'].includes(o.maskMode)||!range(o.maskTolerance,5,120)||!['transitions','shadows','midtones','highlights','all'].includes(o.tonalRange)||!['all','dominant','vivid','neutral','reds','oranges','yellows','greens','cyans','blues','purples'].includes(o.hueRange)||[o.amount,o.solidProtection,o.edgeProtection].some(v=>!range(v,0,1))||[o.invert,o.transparent,o.keepSolids].some(v=>typeof v!=='boolean')||![o.inkColor,o.backgroundColor].every(v=>/^#[\da-f]{6}$/i.test(v)))throw Error('Revisá los ajustes de Semitonos.');
 validateColorSelection(o.colorSelection);geometry(o.shape,1);curve(.5,o.curve);
}
function diagnostics(o,dpi=300){
 validateOptions(o);const pitch=25.4/o.frequency,max=Math.min(o.maximumDotMm,Math.max(0,pitch-o.holeMm)),g=geometry(o.shape,o.minimumDotMm),warnings=[];
 if(g.feature/25.4*dpi<2)warnings.push('El detalle mínimo de esta forma ocupa menos de 2 píxeles; la forma digital no puede representar esa medida con exactitud a esta resolución.');
 if(o.holeMm>0&&o.holeMm/25.4*dpi<2)warnings.push('El hueco pedido ocupa menos de 2 píxeles; puede variar al rasterizar.');
 if(max<o.minimumDotMm)warnings.push('No caben el punto mínimo y el hueco con esta frecuencia. No se generarán puntos en las celdas afectadas.');
 const maxCoverage=geometry(o.shape,max).area/(pitch*pitch);
 if(maxCoverage<.9)warnings.push(`La geometría limita la cobertura por celda a ${Math.round(maxCoverage*100)} %. La curva no puede superar ese límite.`);
 return {pitchMm:pitch,minFeaturePx:g.feature/25.4*dpi,maxDiameterMm:max,maxCoverage,gapXmm:pitch-geometry(o.shape,max).width,gapYmm:pitch-geometry(o.shape,max).height,warnings};
}
function binary(data,w,h){
 for(let i=0;i<w*h;i++){const j=i*4,a=data[j+3];if(a&&a<255)data[j+3]=a>=halftoneGridThreshold(i%w,Math.floor(i/w))*255?255:0;if(!data[j+3])data[j]=data[j+1]=data[j+2]=0;}
 return data;
}
function rasterStats(data,w,h,dpi=300,minDot=.1,minHole=.1){
 let opaque=0,partial=0,narrowInk=0,narrowGap=0;const dot=Math.max(1,Math.ceil(minDot/25.4*dpi)),gap=Math.max(1,Math.ceil(minHole/25.4*dpi));
 for(let i=0;i<w*h;i++){if(data[i*4+3]===255)opaque++;else if(data[i*4+3])partial++;}
 // Carreras en ambos ejes: aviso orientativo, no medición de diámetro de componentes.
 for(let axis=0;axis<2;axis++){const lines=axis?w:h,length=axis?h:w;for(let row=0;row<lines;row++){let start=0,last=!!data[(axis?row:row*w)*4+3];for(let x=1;x<=length;x++){const value=x<length?!!data[(axis?x*w+row:row*w+x)*4+3]:!last;if(value!==last){if(last&&x-start<dot)narrowInk++;if(!last&&start>0&&x<length&&x-start<gap)narrowGap++;start=x;last=value;}}}}
 return {opaque,partial,coverage:opaque/(w*h),narrowInk,narrowGap};
}
function draw(context,shape,x,y,diameter,angle){
 const g=geometry(shape,diameter);context.save();context.translate(x,y);context.rotate(angle);context.beginPath();
 if(shape==='circle'||shape==='ellipse')context.ellipse(0,0,g.width/2,g.height/2,0,0,Math.PI*2);
 else if(shape==='diamond'){context.moveTo(0,-diameter/2);context.lineTo(diameter/2,0);context.lineTo(0,diameter/2);context.lineTo(-diameter/2,0);context.closePath();}
 else context.rect(-g.width/2,-g.height/2,g.width,g.height);context.fill();context.restore();
}
// Coordinates are anchored at the image origin. Pixel centers belong to one
// half-open rotated cell, including cells whose centers are outside the image.
function grid(width,height,cell,angle){
 const cos=Math.cos(angle),sin=Math.sin(angle),corners=[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>[x*cos+y*sin,-x*sin+y*cos]);
 return {cos,sin,minX:Math.floor(Math.min(...corners.map(p=>p[0]))/cell),maxX:Math.ceil(Math.max(...corners.map(p=>p[0]))/cell)-1,minY:Math.floor(Math.min(...corners.map(p=>p[1]))/cell),maxY:Math.ceil(Math.max(...corners.map(p=>p[1]))/cell)-1};
}
function inside(shape,x,y,g){
 if(!g.width||!g.height)return false;
 if(shape==='circle'||shape==='ellipse')return (2*x/g.width)**2+(2*y/g.height)**2<=1;
 if(shape==='diamond')return Math.abs(2*x/g.width)+Math.abs(2*y/g.height)<=1;
 return Math.abs(x)<=g.width/2&&Math.abs(y)<=g.height/2;
}
// Integrate only the boundary at 8 × 8 subpixels. Interior pixels are exact.
// The final solid pixels are ranked by geometric area, not by a Bayer texture.
function pixelArea(shape,x,y,g,cos,sin){
 const extent=(Math.abs(cos)+Math.abs(sin))*.5;
 if(Math.abs(x)>g.width/2+extent||Math.abs(y)>g.height/2+extent)return 0;
 let corners=0;for(const a of [-.5,.5])for(const b of [-.5,.5])if(inside(shape,x+a*cos+b*sin,y-a*sin+b*cos,g))corners++;
 if(corners===4)return 1;
 let n=0;for(let j=0;j<8;j++)for(let i=0;i<8;i++){const a=(i+.5)/8-.5,b=(j+.5)/8-.5;if(inside(shape,x+a*cos+b*sin,y-a*sin+b*cos,g))n++;}return n/64;
}
async function render(p,createCanvas,yieldFrame=nextFrame,isCancelled=()=>false,progress=()=>{}){
 const {width:w,height:h,data,options:o,dpi}=p;dimensions(w,h);validateOptions(o);if(!(data instanceof Uint8ClampedArray)||data.length!==w*h*4||!Number.isFinite(dpi)||dpi<=0)throw Error('Fuente de Semitonos inválida.');
 const manual=p.manual;if(manual){if(!Number.isInteger(manual.width)||!Number.isInteger(manual.height)||manual.width<1||manual.height<1||manual.width>6000||manual.height>6000||manual.width*manual.height>18000000||[manual.apply,manual.protect].some(m=>m&&(!(m instanceof Uint8Array)||m.length!==manual.width*manual.height)))throw Error('Máscaras de Semitonos inválidas.');}
 const cancelled=()=>{if(isCancelled()){const e=Error('Semitonos cancelado. Se conserva el último resultado.');e.name='AbortError';throw e;}};
 cancelled();
 const maskAt=(mask,x,y)=>mask?mask[Math.min(manual.height-1,Math.max(0,Math.floor(y/h*manual.height)))*manual.width+Math.min(manual.width-1,Math.max(0,Math.floor(x/w*manual.width)))]:255;
 const state={width:w,height:h,imageData:{data}},cell=dpi/o.frequency,angle=o.angleDegrees*Math.PI/180,G=grid(w,h,cell,angle),{cos,sin}=G,factor=259*(o.contrast+255)/(255*(259-o.contrast));
 const selective=!!o.colorSelection?.enabled,match=selective?colorMatcher(o.colorSelection):null,affected=selective?new Uint8Array(w*h):null,selectionOnly=p.selectionOnly===true;
 const output=selectionOnly?new Uint8ClampedArray(data.length):(selective||o.keepSolids||o.basis==='alpha')?data.slice():new Uint8ClampedArray(data.length);
 const bg=await getHalftoneBackgroundMask(state,cell,o.maskTolerance,o.maskMode,isCancelled);cancelled();
 const precision={selectedPixels:0,requestedArea:0,geometricArea:0,rasterArea:0,limitedCells:0,processedCells:0,clippedCells:0};
 let residual=0,visited=0;
 const rgbInk=[1,3,5].map(i=>parseInt(o.inkColor.slice(i,i+2),16)),extent=cell*(Math.abs(cos)+Math.abs(sin))/2;
 for(let row=G.minY;row<=G.maxY;row++){
  for(let col=G.minX;col<=G.maxX;col++){
   const u=(col+.5)*cell,v=(row+.5)*cell,x=u*cos-v*sin,y=u*sin+v*cos,pixels=[];
   let red=0,green=0,blue=0,squares=0,alpha=0;
   for(let yy=Math.max(0,Math.floor(y-extent));yy<Math.min(h,Math.ceil(y+extent));yy++)for(let xx=Math.max(0,Math.floor(x-extent));xx<Math.min(w,Math.ceil(x+extent));xx++){
    const dx=xx+.5-x,dy=yy+.5-y,lx=dx*cos+dy*sin,ly=-dx*sin+dy*cos;
    // Scale-aware epsilon only resolves floating point error at exact grid edges.
    if(Math.floor(((xx+.5)*cos+(yy+.5)*sin)/cell+1e-12)!==col||Math.floor((-(xx+.5)*sin+(yy+.5)*cos)/cell+1e-12)!==row)continue;
    const index=(yy*w+xx)*4,a=data[index+3]/255;if(selective&&(!a||!match(data[index],data[index+1],data[index+2])||manual&&(manual.protect&&maskAt(manual.protect,xx+.5,yy+.5)>0||maskAt(manual.apply,xx+.5,yy+.5)/255<halftoneGridThreshold(xx,yy))))continue;pixels.push({index,lx,ly,xx,yy});alpha+=a;red+=data[index]*a;green+=data[index+1]*a;blue+=data[index+2]*a;squares+=(data[index]**2+data[index+1]**2+data[index+2]**2)*a;
   }
   if(!pixels.length)continue;
   const clear=()=>{for(const q of pixels){output.fill(0,q.index,q.index+4);if(affected)affected[q.index/4]=1;}};
   const bx=Math.max(0,Math.min(w-1,x)),by=Math.max(0,Math.min(h-1,y));
   if(bg&&bg.background[Math.min(bg.rows-1,Math.floor(by/cell))*bg.columns+Math.min(bg.columns-1,Math.floor(bx/cell))]){if(!selectionOnly)clear();continue;}
   if(!alpha)continue;
   const s={r:red/alpha,g:green/alpha,b:blue/alpha,a:alpha/pixels.length};
   s.variation=Math.sqrt(Math.max(0,(squares/alpha-s.r*s.r-s.g*s.g-s.b*s.b)/3));
   if(o.basis==='alpha'&&s.a>=1-1e-12)continue;
   const r=Math.max(0,Math.min(255,factor*(s.r-128)+128)),g=Math.max(0,Math.min(255,factor*(s.g-128)+128)),b=Math.max(0,Math.min(255,factor*(s.b-128)+128)),luma=.2126*r+.7152*g+.0722*b;
   const color=selective?1:halftoneColorStrength(o.hueRange,s.r,s.g,s.b,p.stats||{dominantHue:15});
   // Manual masks are applied per output pixel below, never twice per cell.
   const strength=o.basis==='alpha'?o.amount*color:halftoneSelectionStrength(o.tonalRange,luma,s.variation,o.solidProtection,o.edgeProtection,o.amount,color);
   if(strength<selectionThreshold(col,row))continue;
   if(selectionOnly){for(const q of pixels){output[q.index]=output[q.index+1]=output[q.index+2]=255;output[q.index+3]=255;}continue;}
   let tone=o.basis==='alpha'?s.a:1-luma/255;if(o.invert)tone=1-tone;
   const coverage=clampUnit(curve(tone,o.curve)+o.dotGain)*(o.basis==='tone'?s.a:1);
   const dot=point(o.shape,cell,coverage,o.minimumDotMm/25.4*dpi,o.maximumDotMm/25.4*dpi,o.holeMm/25.4*dpi,col,row),shapeGeometry=geometry(o.shape,dot.diameter);
   clear();precision.processedCells++;precision.selectedPixels+=pixels.length;precision.requestedArea+=coverage*pixels.length;
   const cap=Math.max(0,Math.min(o.maximumDotMm/25.4*dpi,cell-o.holeMm/25.4*dpi));
   if(coverage>geometry(o.shape,cap).area/(cell*cell)+1e-12||cap<o.minimumDotMm/25.4*dpi)precision.limitedCells++;
   const candidates=[];let integrated=0;
   for(const q of pixels){q.area=pixelArea(o.shape,q.lx,q.ly,shapeGeometry,cos,sin);if(q.area>0){integrated+=q.area;q.rank=(2*q.lx/(shapeGeometry.width||1))**2+(2*q.ly/(shapeGeometry.height||1))**2;candidates.push(q);}}
   const full=!selective&&x-extent>=0&&x+extent<=w&&y-extent>=0&&y+extent<=h;
   if(!full)precision.clippedCells++;
   // Full dots use analytic area. Cropped edge cells use integrated visible area.
   const area=full?shapeGeometry.area:integrated;
   const desired=Math.max(0,Math.min(candidates.length,Math.round(area+residual)));residual+=area-desired;
   precision.geometricArea+=area;precision.rasterArea+=desired;
   candidates.sort((a,b)=>b.area-a.area||a.rank-b.rank||a.index-b.index);
   const rgb=o.colorMode==='original'?[Math.round(s.r),Math.round(s.g),Math.round(s.b)]:rgbInk;
   for(let k=0;k<desired;k++){const i=candidates[k].index;output[i]=selective&&o.colorMode==='original'?data[i]:rgb[0];output[i+1]=selective&&o.colorMode==='original'?data[i+1]:rgb[1];output[i+2]=selective&&o.colorMode==='original'?data[i+2]:rgb[2];output[i+3]=255;}
   if(++visited%512===0){await yieldFrame();cancelled();}
  }
  if((row-G.minY)%8===0){progress(Math.min(95,10+(row-G.minY)/Math.max(1,G.maxY-G.minY)*85));await yieldFrame();cancelled();}
 }
 if(manual&&!selective)for(let y=0;y<h;y++){for(let x=0;x<w;x++){const i=(y*w+x)*4,protectedPixel=manual.protect&&maskAt(manual.protect,x,y)>0,allowed=maskAt(manual.apply,x,y);if(protectedPixel||allowed/255<halftoneGridThreshold(x,y))for(let c=0;c<4;c++)output[i+c]=selectionOnly?0:data[i+c];}if(y%256===0){await yieldFrame();cancelled();}}
 // Solid alpha before compositing prevents generated gray edge fringes.
 binary(output,w,h);
 if(affected&&!selectionOnly)for(let i=0;i<w*h;i++)if(!affected[i])for(let c=0;c<4;c++)output[i*4+c]=data[i*4+c];
 if(!o.transparent&&!selectionOnly){const rgb=[1,3,5].map(i=>parseInt(o.backgroundColor.slice(i,i+2),16));for(let i=0;i<w*h;i++){const j=i*4;if(!output[j+3]){for(let c=0;c<3;c++)output[j+c]=rgb[c];output[j+3]=255;}}}
 precision.errorPixels=precision.rasterArea-precision.geometricArea;
 precision.beforeManualMasks=!!manual&&!selective;precision.colorSelection=selective;precision.selectionOnly=selectionOnly;precision.pixelMm=25.4/dpi;
 cancelled();progress(100);return {data:output,metrics:{...rasterStats(output,w,h,dpi,o.minimumDotMm,o.holeMm),precision},diagnostics:diagnostics(o,dpi)};
}
return Object.freeze({validateColorSelection,colorMatcher,paletteHistogram,paletteAccumulate,paletteFromHistogram,geometry,curve,point,dimensions,validateOptions,diagnostics,binary,rasterStats,grid,pixelArea,draw,render});
});
