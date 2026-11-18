const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../dist/app.js"), "utf8");
const key = "asado-en-marcha-v1";

function harness(store = new Map()) {
  const nodes = new Map();
  const events = {};
  const alerts = [];
  const urls = new Map();
  let downloaded = null;
  let sequence = 0;
  function element(id) {
    if (!nodes.has(id)) nodes.set(id, {
      id, innerHTML: "", textContent: "", value: "", hidden: false, className: "",
      dataset: {}, files: [], data: {}, listeners: {},
      classList: {toggle() {}},
      addEventListener(name, fn) {this.listeners[name] = fn;},
      querySelectorAll() {return [];},
      reset() {this.data = {};},
      close() {},
      showModal() {}
    });
    return nodes.get(id);
  }
  const document = {
    getElementById: element,
    querySelectorAll() {return [];},
    addEventListener(name, fn) {events[name] = fn;},
    createElement() {return {href: "", download: "", click() {downloaded = this.href;}};}
  };
  const context = {
    document, localStorage: {
      getItem(k) {return store.has(k) ? store.get(k) : null;},
      setItem(k, v) {store.set(k, v);}
    },
    FormData: class {constructor(form) {this.data = form.data;} get(k) {return this.data[k] ?? null;}},
    Blob, URL: {
      createObjectURL(blob) {const url = "blob:" + (++sequence); urls.set(url, blob); return url;},
      revokeObjectURL() {}
    },
    window: {scrollTo() {}},
    setTimeout() {},
    confirm() {return true;},
    alert(message) {alerts.push(message);}
  };
  vm.runInNewContext(source, context, {filename: "app.js"});
  return {
    store, alerts, element,
    saved() {return JSON.parse(store.get(key));},
    change(target) {events.change({target: {dataset: {}, id: "", closest() {return null;}, ...target}});},
    input(target) {events.input({target: {dataset: {}, id: "", closest() {return null;}, ...target}});},
    itemChange(id, field, value) {
      this.change({value, dataset: {field}, closest(sel) {return sel === "[data-item-id]" ? {dataset: {itemId: id}} : null;}});
    },
    consumptionChange(id, field, value) {
      this.change({value, dataset: {consumption: field}, closest(sel) {return sel === "[data-item-id]" ? {dataset: {itemId: id}} : null;}});
    },
    recommendation(id) {
      const html = element("shopping-list").innerHTML;
      const match = html.match(new RegExp('data-rec-id="' + id + '">([^<]*)'));
      return match ? match[1] : null;
    },
    recommendedNumber(id) {
      const match = (this.recommendation(id) || "").match(/^Recomendado: ([\d.,]+)/);
      return match ? Number(match[1].replace(/\./g, "").replace(",", ".")) : null;
    },
    action(id, name) {
      const row = {dataset: {itemId: id}};
      const action = {dataset: {action: name}, closest(sel) {return sel === "[data-item-id]" ? row : null;}};
      events.click({target: {closest(sel) {return sel === "[data-action]" ? action : null;}}});
    },
    markBought(id) {
      this.action(id, "mark-bought");
    },
    addProduct(data) {
      const form = element("item-form"); form.data = data;
      form.listeners.submit({preventDefault() {}, currentTarget: form});
    },
    async exportData() {
      element("export-btn").listeners.click();
      return JSON.parse(await urls.get(downloaded).text());
    },
    async importData(data) {
      element("import-file").listeners.change({target: {files: [{text: async () => data}], value: "backup.json"}});
      await new Promise(resolve => setImmediate(resolve));
    }
  };
}

test("invitados y supuestos recalculan sin tocar cantidades elegidas ni compras; persisten al recargar", () => {
  const h = harness();
  assert.match(h.element("metrics").innerHTML, /<strong>99 u<\/strong><b>Empanadas recomendadas/);
  h.itemChange("vacio", "bought", "4");
  h.change({value: "11", dataset: {guest: "children"}});
  h.change({value: "12", dataset: {guest: "teens"}});
  h.change({value: "34", dataset: {guest: "adults"}});
  assert.equal(h.element("hero-guests").textContent, "57");
  assert.match(h.element("metrics").innerHTML, /<strong>57<\/strong><b>Invitados/);
  assert.match(h.element("metrics").innerHTML, /<strong>103 u<\/strong><b>Empanadas recomendadas/);
  assert.equal(h.saved().items.find(x => x.id === "emp").target, 100);
  assert.equal(h.saved().items.find(x => x.id === "vacio").bought, 4);
  const reload = harness(h.store);
  assert.equal(reload.element("hero-guests").textContent, "57");
  assert.match(reload.element("shopping-list").innerHTML, /Faltan 1 kg/);
  assert.match(reload.element("metrics").innerHTML, /<strong>103 u<\/strong><b>Empanadas recomendadas/);
});

test("Comprado nunca reemplaza compras parciales, excesos ni cero registrado", () => {
  const h = harness();
  h.itemChange("vacio", "bought", "2");
  h.markBought("vacio");
  assert.equal(h.saved().items.find(x => x.id === "vacio").bought, 2);
  h.itemChange("vacio", "bought", "8");
  h.markBought("vacio");
  assert.equal(h.saved().items.find(x => x.id === "vacio").bought, 8);
  h.itemChange("vacio", "bought", "0");
  h.markBought("vacio");
  assert.equal(h.saved().items.find(x => x.id === "vacio").bought, 0);
  h.markBought("pork");
  assert.equal(h.saved().items.find(x => x.id === "pork").bought, 2);
  assert.match(h.element("shopping-list").innerHTML, /Registrado/);
});

test("producto de parrilla nuevo y ediciones sincronizan producción, compras y panorama", () => {
  const h = harness();
  h.addProduct({name: "Nuevo corte", category: "Parrilla", unit: "kg", target: "1", note: "Para probar"});
  assert.match(h.element("production-list").innerHTML, /Nuevo corte \(falta tiempo de cocción\)/);
  const added = h.saved().items.find(x => x.name === "Nuevo corte");
  h.itemChange(added.id, "duration", "50");
  assert.match(h.element("production-list").innerHTML, /Nuevo corte/);
  assert.match(h.element("shopping-list").innerHTML, /Nuevo corte/);
  assert.match(h.element("menu-overview").innerHTML, /Nuevo corte/);
  h.itemChange(added.id, "target", "3");
  assert.match(h.element("production-list").innerHTML, /3 kg/);
  h.change({id: "event-start", value: "13:00"});
  assert.match(h.element("event-summary").textContent, /13:00/);
  assert.match(h.element("decision-intro").innerHTML, /55 invitados/);
});

test("exporta JSON completo; importación inválida conserva estado y válida persiste", async () => {
  const h = harness();
  h.change({value: "35", dataset: {guest: "adults"}});
  const exported = await h.exportData();
  assert.equal(exported.format, key);
  assert.equal(exported.data.guests.adults, 35);
  const before = h.store.get(key);
  await h.importData("{no es json");
  assert.equal(h.store.get(key), before);
  await h.importData(JSON.stringify({format: key, data: {items: [], decisions: []}}));
  assert.equal(h.store.get(key), before);
  const corrupted = JSON.parse(JSON.stringify(exported));
  corrupted.data.items[0].yield = 1.5;
  await h.importData(JSON.stringify(corrupted));
  assert.equal(h.store.get(key), before);
  assert.equal(h.alerts.length, 3);
  exported.data.guests.adults = 42;
  await h.importData(JSON.stringify(exported));
  assert.equal(h.saved().guests.adults, 42);
  assert.equal(h.element("hero-guests").textContent, "53");
  assert.equal(harness(h.store).element("hero-guests").textContent, "53");
});

test("datos previos válidos no se reinician; datos dañados permanecen intactos", async () => {
  const first = harness();
  const old = (await first.exportData()).data;
  old.guests.adults = 48; old.items.find(x => x.id === "emp").target = 130;
  old.items.find(x => x.id === "vacio").bought = 9;
  const store = new Map([[key, JSON.stringify(old)]]);
  const loaded = harness(store);
  assert.equal(loaded.element("hero-guests").textContent, "59");
  assert.equal(loaded.saved().items.find(x => x.id === "emp").target, 130);
  assert.equal(loaded.saved().items.find(x => x.id === "vacio").bought, 9);
  const damaged = new Map([[key, "{incompleto"]]);
  const blocked = harness(damaged);
  blocked.change({value: "40", dataset: {guest: "adults"}});
  assert.equal(damaged.get(key), "{incompleto");
  assert.equal(blocked.element("storage-warning").hidden, false);
});

test("si el navegador rechaza la escritura, importar no reemplaza el plan en memoria", async () => {
  const original = harness();
  const oldPlan = (await original.exportData()).data;
  oldPlan.guests.adults = 39;
  const stored = JSON.stringify(oldPlan);
  const store = new Map([[key, stored]]);
  const h = harness(store);
  const next = JSON.parse(stored); next.guests.adults = 50;
  store.set = function () {throw Error("Sin espacio");};
  await h.importData(JSON.stringify({format: key, data: next}));
  assert.equal(store.get(key), stored);
  assert.equal(h.element("hero-guests").textContent, "50");
  assert.equal(h.alerts.length, 1);
});

test("sigue siendo estática y conserva respaldo visible en móvil", () => {
  const html = fs.readFileSync(path.join(__dirname, "../dist/index.html"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "../dist/styles.css"), "utf8");
  assert.match(html, /<script src="app\.js\?v=20261117\.6"><\/script>/);
  assert.doesNotMatch(html, /<script[^>]+https?:/);
  assert.match(css, /@media\(max-width:760px\)\{\.rail-bottom\{display:flex/);
  assert.match(css, /@import url\('https:\/\/fonts\.googleapis\.com/);
});

const foodIds = ["vacio","punta","ribs","pork","chor","morc","rusa","tomato","lettuce","bread","emp","bonbon"];

test("nueve tarjetas comparten el motor y mantienen metas y compras", () => {
  const h=harness(),initial=h.element("metrics").innerHTML;
  h.change({value:"44",dataset:{guest:"adults"}});
  assert.equal((initial.match(/class="metric"/g)||[]).length,9);
  for(const [number,label] of [
    ["55","Invitados"],["99 u","Empanadas recomendadas"],
    ["9 kg","Carne vacuna recomendada"],["5 kg","Carne de cerdo recomendada"],
    ["30 u","Chorizos recomendados"],["12 u","Morcillas recomendadas"],
    ["5 kg","Ensalada rusa recomendada"],["55 u","Palitos bombón recomendados"]
  ])assert.ok(initial.includes("<strong>"+number+"</strong><b>"+label),label);
  assert.match(initial,/3,5 kg tomate · 6 plantas lechuga/);
  const before=h.saved().items.map(x=>[x.id,x.target,x.bought]);
  for(const adults of [10,49,100]){
    h.change({value:String(adults),dataset:{guest:"adults"}});
    const html=h.element("metrics").innerHTML;
    assert.equal((html.match(/class="metric"/g)||[]).length,9);
    assert.equal(h.recommendedNumber("emp"),adults*2+11);
    assert.match(html,/Carne vacuna recomendada/);
    assert.match(html,/Ensalada mixta recomendada/);
    assert.deepEqual(h.saved().items.map(x=>[x.id,x.target,x.bought]),before);
  }
  h.change({value:"44",dataset:{guest:"adults"}});
  assert.equal(h.element("metrics").innerHTML,initial);
  assert.match(h.element("shopping-list").innerHTML,/planificado:/);
  assert.ok(h.element("production-list").innerHTML.length>0);
});

test("Caso A: Navidad 2026, recomendaciones por corte, acompañamientos y totales coherentes", () => {
  const h = harness();
  assert.equal(h.element("hero-guests").textContent, "55");
  assert.match(h.element("metrics").innerHTML, /<strong>55<\/strong><b>Invitados/);
  const expected = {vacio:5,punta:4,ribs:3,pork:2,chor:30,morc:12,rusa:5,tomato:3.5,lettuce:6,bread:4,emp:99,bonbon:55};
  for (const [id, value] of Object.entries(expected)) assert.equal(h.recommendedNumber(id),value,id);
  assert.match(h.element("metrics").innerHTML, /<strong>9 kg<\/strong><b>Carne vacuna recomendada/);
  assert.match(h.element("metrics").innerHTML, /<strong>5 kg<\/strong><b>Carne de cerdo recomendada/);
  assert.match(h.recommendation("emp"), /planificado: 100 u/);
  assert.match(h.recommendation("bonbon"), /planificado: 60 u/);
});

test("Caso B: cinco adultos más aumentan o mantienen todas las recomendaciones", () => {
  const h = harness();
  const before = Object.fromEntries(foodIds.map(id => [id,h.recommendedNumber(id)]));
  h.input({value:"49",dataset:{guest:"adults"}});
  assert.equal(h.element("hero-guests").textContent,"60");
  assert.equal(h.recommendedNumber("emp"),109);
  for(const id of foodIds)assert.ok(h.recommendedNumber(id)>=before[id],id);
  assert.equal(h.saved().items.find(x => x.id==="emp").target,100);
});

test("Casos C y D: quitar invitados reduce recomendaciones; cero no divide por cero", () => {
  const h = harness();
  const before = Object.fromEntries(foodIds.map(id => [id,h.recommendedNumber(id)]));
  h.change({value:"20",dataset:{guest:"adults"}});
  h.change({value:"0",dataset:{guest:"children"}});
  for(const id of foodIds)assert.ok(h.recommendedNumber(id)>=0 && h.recommendedNumber(id)<=before[id],id);
  h.change({value:"0",dataset:{guest:"adults"}});
  assert.equal(h.element("hero-guests").textContent,"0");
  for(const id of foodIds)assert.equal(h.recommendedNumber(id),0,id);
  assert.doesNotMatch(h.element("metrics").innerHTML,/NaN|Infinity/);
});

test("Caso E: compra y plan no cambian hasta adoptar una recomendación", () => {
  const h = harness();
  h.itemChange("emp","bought","40");
  h.change({value:"49",dataset:{guest:"adults"}});
  assert.equal(h.recommendedNumber("emp"),109);
  assert.equal(h.saved().items.find(x=>x.id==="emp").target,100);
  assert.equal(h.saved().items.find(x=>x.id==="emp").bought,40);
  assert.match(h.element("shopping-list").innerHTML,/Faltan 60 u/);
  h.action("emp","accept-recommendation");
  assert.equal(h.saved().items.find(x=>x.id==="emp").target,109);
  assert.equal(h.saved().items.find(x=>x.id==="emp").bought,40);
  assert.match(h.element("shopping-list").innerHTML,/Faltan 69 u/);
});

test("Caso F: cambios sucesivos vuelven exactamente a las mismas recomendaciones", () => {
  const h = harness();
  const original = Object.fromEntries(foodIds.map(id=>[id,h.recommendedNumber(id)]));
  for(const adults of ["49","12","68","44"])h.change({value:adults,dataset:{guest:"adults"}});
  for(const id of foodIds)assert.equal(h.recommendedNumber(id),original[id],id);
});

test("Caso G: editar una tasa modifica sólo ese alimento y sus totales; chorizo chico sustituye al grande", () => {
  const h = harness();
  const tomato=h.recommendedNumber("tomato");
  h.consumptionChange("vacio","rate","120");
  assert.equal(h.recommendedNumber("vacio"),6);
  assert.equal(h.recommendedNumber("punta"),4);
  assert.equal(h.recommendedNumber("tomato"),tomato);
  assert.match(h.element("metrics").innerHTML,/<strong>10 kg<\/strong><b>Carne vacuna recomendada/);
  h.consumptionChange("chor","size","chico");
  assert.match(h.recommendation("chor"),/falta configurar tasa/);
  h.consumptionChange("chor","chorizoRate","0.8");
  assert.equal(h.recommendedNumber("chor"),40);
  assert.equal(h.saved().items.filter(x=>x.id==="chor").length,1);
  assert.equal(h.saved().items.find(x=>x.id==="chor").consumption.largeRate,0.6);
  h.input({value:"140",dataset:{consumption:"rate"},closest(sel){return sel==="[data-item-id]"?{dataset:{itemId:"vacio"}}:null;}});
  assert.match(h.element("metrics").innerHTML,/<strong>11 kg<\/strong><b>Carne vacuna recomendada/);
  assert.equal(harness(h.store).recommendedNumber("vacio"),7);
});

test("respaldo anterior conserva personas, compras y plan, mientras nuevas referencias se agregan sin metas", async () => {
  const baseline=harness(),old=(await baseline.exportData()).data;
  old.guests={adults:30,teens:10,children:10};
  old.items=old.items.filter(x=>["ribs","pork","chor","morc","emp","rusa"].includes(x.id)||x.category==="Bebidas");
  old.items.unshift({id:"beef",name:"Vacuno por definir",category:"Parrilla",unit:"kg",target:12,bought:4,prepared:null,basis:"confirmed",note:"Sin distribuir",yield:0.75,duration:180,lead:180,footWidth:null,footDepth:null});
  delete old.recommendationVersion;
  delete old.assumptions.adultWeight;
  for(const x of old.items){delete x.consumption;delete x.meatGroup;}
  old.items.find(x=>x.id==="emp").target=80;
  const original=JSON.stringify(old),store=new Map([[key,original]]),h=harness(store);
  assert.equal(store.get(key),original);
  assert.equal(h.element("hero-guests").textContent,"50");
  assert.equal(h.recommendedNumber("vacio"),4.3);
  assert.equal(h.saved().items.find(x=>x.id==="beef").bought,4);
  h.change({value:"31",dataset:{guest:"adults"}});
  assert.equal(h.saved().items.find(x=>x.id==="emp").target,80);
  assert.equal(h.saved().items.find(x=>x.id==="beef").target,12);
  assert.equal(h.saved().items.find(x=>x.id==="beef").bought,4);
  assert.equal(h.saved().items.find(x=>x.id==="vacio").target,null);
  assert.equal(h.saved().assumptions.adultWeight,1);
  assert.match(h.element("menu-overview").innerHTML,/Vacuno por definir .* pendiente de revisión/);
});

test("un producto eliminado no reaparece al recargar", () => {
  const h=harness();
  h.action("vacio","remove-item");
  assert.equal(h.saved().items.some(x=>x.id==="vacio"),false);
  const reload=harness(h.store);
  assert.equal(reload.element("shopping-list").innerHTML.includes('data-item-id="vacio"'),false);
  assert.equal(reload.recommendedNumber("vacio"),null);
});

test("migrar un plan anterior respeta alimentos que ya habían sido eliminados", async () => {
  const base=harness(),old=(await base.exportData()).data;
  delete old.recommendationVersion;
  old.items=old.items.filter(x=>x.id!=="emp");
  const store=new Map([[key,JSON.stringify(old)]]),h=harness(store);
  assert.equal(h.recommendedNumber("emp"),null);
  h.change({value:"45",dataset:{guest:"adults"}});
  assert.equal(h.saved().items.some(x=>x.id==="emp"),false);
});

test("equivalencias editables afectan sólo productos por equivalente", () => {
  const h=harness();
  const emp=h.recommendedNumber("emp"),postre=h.recommendedNumber("bonbon");
  h.input({value:"1",dataset:{assumption:"childWeight"}});
  assert.equal(h.recommendedNumber("vacio"),5.5);
  assert.equal(h.recommendedNumber("emp"),emp);
  assert.equal(h.recommendedNumber("bonbon"),postre);
  assert.equal(h.saved().assumptions.childWeight,1);
  h.input({value:"0.9",dataset:{assumption:"adultWeight"}});
  assert.equal(h.recommendedNumber("vacio"),5.1);
  assert.equal(h.recommendedNumber("emp"),emp);
  assert.equal(h.saved().assumptions.adultWeight,0.9);
});

test("menú y compras agrupan los cuatro cortes sin duplicarlos y dejan el plan sin definir", async () => {
  const h=harness(),plan=(await h.exportData()).data,menu=h.element("menu-overview").innerHTML,shopping=h.element("shopping-list").innerHTML;
  assert.match(menu,/<h3>Carne vacuna<\/h3>/);
  assert.match(menu,/<h3>Carne de cerdo<\/h3>/);
  assert.match(menu,/Vacío \(5 kg\).*Punta de espalda \(4 kg\)/);
  assert.match(menu,/Subtotal recomendado:<\/strong> 9 kg crudos<br><strong>Subtotal planificado:<\/strong> 9 kg crudos/);
  assert.match(menu,/Pechito con manta \(3 kg\).*Matambrito \(2 kg\)/);
  assert.match(menu,/Subtotal recomendado:<\/strong> 5 kg crudos<br><strong>Subtotal planificado:<\/strong> 5 kg crudos/);
  assert.match(shopping,/>Carne vacuna<small>2 productos/);
  assert.match(shopping,/>Carne de cerdo<small>2 productos/);
  for(const id of ["vacio","punta","ribs","pork"]){
    assert.equal((shopping.match(new RegExp('data-item-id="'+id+'"','g'))||[]).length,1,id);
    assert.equal(plan.items.filter(x=>x.id===id).length,1,id);
  }
  assert.equal(plan.items.some(x=>x.id==="tapa"),false);
  h.itemChange("punta","target","");
  assert.equal(h.saved().items.find(x=>x.id==="punta").target,null);
  assert.match(h.element("menu-overview").innerHTML,/Subtotal planificado:<\/strong> por definir/);
  h.itemChange("vacio","bought","2");
  h.change({value:"49",dataset:{guest:"adults"}});
  assert.match(h.element("metrics").innerHTML,/<strong>9,9 kg<\/strong><b>Carne vacuna recomendada/);
  assert.match(h.element("menu-overview").innerHTML,/Subtotal recomendado:<\/strong> 9,9 kg crudos/);
  assert.equal(h.saved().items.find(x=>x.id==="punta").target,null);
  assert.equal(h.saved().items.find(x=>x.id==="vacio").bought,2);
  assert.ok(h.element("metrics").innerHTML.length>0);
  assert.ok(h.element("shopping-list").innerHTML.length>0);
  assert.ok(h.element("production-list").innerHTML.length>0);
});

test("Vacuno y Tapa de asado anteriores quedan pendientes sin duplicar compras ni subtotales", async () => {
  const base=harness(),old=(await base.exportData()).data;
  old.recommendationVersion=1;
  old.items.push(
    {id:"beef",name:"Vacuno",category:"Parrilla",unit:"kg",target:12,bought:4,prepared:null,basis:"confirmed",note:"Sin distribuir",meatType:"beef",meatGroup:"beef",consumption:{mode:"none"},yield:0.75,duration:180,lead:180,footWidth:null,footDepth:null},
    {id:"tapa",name:"Tapa de asado",category:"Parrilla",unit:"kg",target:3,bought:2,prepared:null,basis:"confirmed",note:"Compra anterior",meatType:"beef",meatGroup:"beef",consumption:{mode:"none"},yield:0.75,duration:180,lead:180,footWidth:null,footDepth:null}
  );
  const raw=JSON.stringify(old),store=new Map([[key,raw]]),h=harness(store);
  assert.equal(store.get(key),raw);
  const menu=h.element("menu-overview").innerHTML,shopping=h.element("shopping-list").innerHTML;
  assert.match(menu,/Vacuno \(planificado 12 kg · comprado 4 kg\) — pendiente de revisión/);
  assert.match(menu,/Tapa de asado \(planificado 3 kg · comprado 2 kg\) — pendiente de revisión/);
  assert.match(menu,/Subtotal recomendado:<\/strong> 9 kg crudos/);
  assert.match(menu,/Subtotal recomendado:<\/strong> 5 kg crudos/);
  assert.match(shopping,/registro anterior pendiente de revisión; fuera de subtotales/);
  assert.equal((shopping.match(/data-item-id="beef"/g)||[]).length,1);
  assert.equal((shopping.match(/data-item-id="tapa"/g)||[]).length,1);
  h.change({value:"45",dataset:{guest:"adults"}});
  for(const [id,target,bought] of [["beef",12,4],["tapa",3,2]]){
    const saved=h.saved().items.find(x=>x.id===id);
    assert.equal(saved.target,target,id);
    assert.equal(saved.bought,bought,id);
  }
  assert.equal(h.saved().items.filter(x=>x.id==="beef"||x.id==="tapa").length,2);
});

test("panorama 25/115: encabezado recomendado, plan 80 fijo y regla general alternativa", () => {
  const h=harness();
  h.itemChange("emp","target","80");
  h.change({value:"2",dataset:{guest:"teens"}});
  h.change({value:"13",dataset:{guest:"children"}});
  h.change({value:"10",dataset:{guest:"adults"}});
  const cooked=h.element("cooked-note").textContent;
  assert.match(h.element("metrics").innerHTML,/<strong>37 u<\/strong><b>Empanadas recomendadas/);
  assert.match(h.element("metrics").innerHTML,/<strong>25<\/strong><b>Invitados/);
  assert.doesNotMatch(h.element("metrics").innerHTML,/Planificadas:|promedio disponible:|Planificado crudo:/);
  assert.match(h.element("cooked-note").textContent,/Planificado crudo: 14 kg/);
  h.input({value:"100",dataset:{guest:"adults"}});
  assert.match(h.element("metrics").innerHTML,/<strong>217 u<\/strong><b>Empanadas recomendadas/);
  assert.match(h.element("metrics").innerHTML,/<strong>115<\/strong><b>Invitados/);
  assert.doesNotMatch(h.element("metrics").innerHTML,/Planificadas:|promedio disponible:/);
  assert.equal(h.saved().items.find(x=>x.id==="emp").target,80);
  assert.equal(h.element("cooked-note").textContent.split(" kg cocidos")[0],cooked.split(" kg cocidos")[0]);
  h.consumptionChange("emp","mode","guest");
  h.consumptionChange("emp","rate","1.5");
  assert.equal(h.recommendedNumber("emp"),173);
  assert.match(h.element("metrics").innerHTML,/<strong>173 u<\/strong><b>Empanadas recomendadas/);
  h.change({value:"10",dataset:{guest:"adults"}});
  assert.equal(h.recommendedNumber("emp"),38);
  assert.match(h.element("metrics").innerHTML,/<strong>38 u<\/strong><b>Empanadas recomendadas/);
});
