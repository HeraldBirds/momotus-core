const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const catalog=require('../tienda/js/catalogo.js'),selection=require('../tienda/js/store-selection.js'),images=require('../tienda/js/product-images.js'),core=require('../tienda/js/store-config-core.js');
const labels={fauna:'Fauna Nica',anime:'Anime',urbano:'Urbanas',games:'Games',unica:'Únicas'};
test('Todos presenta dos diseños distintos por categoría, aun con todas las prendas',()=>{
 const groups=selection.groups(catalog.products,labels);assert.equal(groups.length,5);assert.equal(groups.flatMap(g=>g.products).length,10);
 for(const g of groups){assert.equal(g.products.length,2);assert.equal(new Set(g.products.map(p=>p.baseDesignId)).size,2);assert.ok(g.products.every(p=>p.category===g.category&&p.published!==false&&p.featured===true));}
});
test('cada prenda tiene representación de las cinco categorías',()=>{for(const garment of catalog.garmentOrder){const groups=selection.groups(catalog.products.filter(p=>p.garment===garment),labels);assert.equal(groups.length,5);assert.ok(groups.every(g=>g.products.every(p=>p.garment===garment)));}});
test('la selección respeta destacados personalizados y nunca incluye borradores',()=>{const groups=selection.groups([{id:1,category:'nueva',published:false,featured:true},{id:2,category:'nueva'},{id:3,category:'nueva',featured:true}],{nueva:'Nueva'});assert.deepEqual(groups[0].products.map(p=>p.id),[3,2]);assert.deepEqual(selection.groups([],{nueva:'Nueva'}),[]);});
test('los treinta nuevos espacios conservan los IDs previos y permanecen sin stock',()=>{
 const added=catalog.products.filter(p=>p.baseDesignId>=79);assert.equal(added.length,120);assert.equal(catalog.products.length,432);assert.equal(catalog.products.filter(p=>p.published!==false).length,264);assert.equal(new Set(catalog.products.map(p=>p.id)).size,432);
 for(const topic of Object.keys(catalog.urbanSubcategories))for(const garment of [...catalog.garmentOrder,'all']){const slots=selection.slots(catalog.products,topic,garment);assert.equal(slots.length,0);const visible=added.filter(p=>p.subcategory===topic&&(garment==='all'||p.garment===garment));assert.equal(new Set(visible.map(p=>p.baseDesignId)).size,5);assert.ok(visible.every(p=>p.published===true&&Object.values(p.stock).every(v=>v===0)));}
});
test('los cinco espacios habilitados se pueden ocultar por prenda sin afectar otros temas',()=>{const data=core.blank();data.products[79]={published:false};const next=core.apply(catalog.originalProducts,data);assert.equal(selection.slots(next,'musica','camiseta').length,1);assert.equal(selection.slots(next,'motor','camiseta').length,0);assert.equal(next.find(p=>p.id===79).published,false);assert.equal(next.find(p=>p.id===1079).published,true);});
test('rutas históricas de configuraciones migran a las carpetas sin afectar rutas personalizadas',()=>{
 const data=core.blank();data.products[17]={img:'img/products/urbano-3.webp',images:['img/products/variants/17-hoodie.webp','img/personal/otra.webp']};const next=core.apply(catalog.originalProducts,data).find(p=>p.id===17);assert.equal(next.img,'img/products/urbano/musica/urbano-3.webp');assert.deepEqual(next.images,['img/products/urbano/musica/variants/17-hoodie.webp','img/personal/otra.webp']);assert.equal(images.legacy(next.img),next.img);assert.equal(images.legacy('img/products/variants/2-hoodie.webp'),'img/products/fauna/variants/2-hoodie.webp');
});
test('todos los productos tienen rutas por categoría, y los previews apuntan a archivos reales',()=>{
 for(const p of catalog.products){assert.ok(p.img.startsWith(images.folder(p)+'/'));assert.ok(fs.existsSync(path.join(__dirname,'..',images.folder(p),'README.md')));}
 const vm=require('node:vm'),ctx={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../tienda/js/photo-previews.js'),'utf8'),ctx);for(const [full,preview]of Object.entries(ctx.MomotusPhotoPreviews)){assert.ok(fs.existsSync(path.join(__dirname,'..',full)));assert.ok(fs.existsSync(path.join(__dirname,'..',preview)));}
});
test('las temporadas aceptan sus carpetas nuevas y conservan su calendario y decoración',()=>{
 let sectionReads=0;const vm=require('node:vm'),ctx={document:{getElementById:id=>id==='seasonal-event'&&sectionReads++>0?{hidden:true}:null,querySelector:()=>null},console};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../tienda/js/temporadas.js'),'utf8'),ctx);
 const api=ctx.MomotusSeasonal;assert.equal(api.validate(api.events),true);assert.equal(api.eventState(api.events[0],new Date(2026,9,7)).visible,true);assert.equal(api.eventState(api.events[0],new Date(2026,10,7)).visible,false);assert.equal(api.events[0].decorations.length,3);
});
