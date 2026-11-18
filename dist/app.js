(function () {
  "use strict";
  var KEY = "asado-en-marcha-v1";
  var defaults = {
    guests: { children: 11, teens: 0, adults: 44 },
    assumptions: { adultWeight: 1, childWeight: 0.5, teenWeight: 0.8, meatGrams: 300 },
    eventStart: "12:00", serveTime: "14:00", grillWidth: null, grillDepth: null,
    items: [
      {id:"fernet",name:"Fernet",category:"Bebidas",unit:"L",target:null,bought:null,prepared:null,basis:"review",note:"Cantidad por definir."},
      {id:"gancia",name:"Gancia",category:"Bebidas",unit:"L",target:null,bought:null,prepared:null,basis:"review",note:"Cantidad por definir."},
      {id:"beer",name:"Cerveza",category:"Bebidas",unit:"L",target:null,bought:null,prepared:null,basis:"review",note:"Cantidad por definir."},
      {id:"cola",name:"Coca-Cola",category:"Bebidas",unit:"L",target:null,bought:null,prepared:null,basis:"review",note:"Para bebidas mezcladas y gaseosa."},
      {id:"sprite",name:"Sprite",category:"Bebidas",unit:"L",target:null,bought:null,prepared:null,basis:"review",note:"Para bebidas mezcladas y gaseosa."},
      {id:"soft",name:"Gaseosas sin alcohol / agua",category:"Bebidas",unit:"L",target:null,bought:null,prepared:null,basis:"review",note:"Definir opciones y cantidades para todos."}
    ],
    decisions: [
      {id:"d1",title:"Confirmar fecha del evento",note:"Horario acordado: 12:00 a 20:00.",done:false},
      {id:"d2",title:"Elegir cortes y distribución de los 12 kg de vacuno",note:"Vacío, tapa de asado o punta de espalda fueron opciones; falta decidir cantidades.",done:false},
      {id:"d3",title:"Averiguar tamaño de chorizos y definir cantidad",note:"Si son grandes se evaluó medio por persona; si son chicos, uno por persona.",done:false},
      {id:"d4",title:"Medir superficie útil de la parrilla y huella de cada tanda",note:"Con esos datos se puede detectar solapamiento.",done:false},
      {id:"d5",title:"Definir cantidades de morcilla, ensaladas, bebidas y helado",note:"Registrar unidades y tamaño real antes de comprar.",done:false},
      {id:"d6",title:"Definir receta y lista de ingredientes de empanadas al horno",note:"Confirmar tamaño, relleno y cantidad final.",done:false},
      {id:"d7",title:"Resolver cómo mantener caliente lo que salga en tandas",note:"Especialmente si la parrilla no alcanza y hay que adelantar cortes.",done:false}
    ]
  };
  function clone(x){return JSON.parse(JSON.stringify(x));}
  var foodCatalog = [
    {id:"vacio",name:"Vacío",category:"Parrilla",unit:"kg",target:5,meatGroup:"beef",rate:0.10,duration:180,yield:0.75},
    {id:"punta",name:"Punta de espalda",category:"Parrilla",unit:"kg",target:4,meatGroup:"beef",rate:0.08,duration:180,yield:0.75},
    {id:"ribs",name:"Pechito con manta",category:"Parrilla",unit:"kg",target:3,meatGroup:"pork",rate:0.06,duration:240,yield:0.65},
    {id:"pork",name:"Matambrito",category:"Parrilla",unit:"kg",target:2,meatGroup:"pork",rate:0.04,duration:75,yield:0.8},
    {id:"chor",name:"Chorizos",category:"Parrilla",unit:"u",target:30,rate:0.6,duration:40},
    {id:"morc",name:"Morcillas",category:"Parrilla",unit:"u",target:12,rate:0.24,duration:25},
    {id:"rusa",name:"Ensalada rusa",category:"Ensaladas",unit:"kg",target:5,rate:0.10},
    {id:"tomato",name:"Tomate",category:"Ensaladas",unit:"kg",target:3.5,rate:0.07},
    {id:"lettuce",name:"Lechuga",category:"Ensaladas",unit:"planta",target:6,rate:0.11},
    {id:"bread",name:"Pan",category:"Otros",unit:"kg",target:4,rate:0.08},
    {id:"emp",name:"Empanadas caseras al horno",category:"Entrada",unit:"u",target:100,groupRates:{adults:2,teens:2,children:1}},
    {id:"bonbon",name:"Palitos bombón",category:"Postre",unit:"u",target:60,guestRate:1}
  ];
  function catalogItem(spec,legacy){
    var consumption=spec.groupRates?{mode:"groups",rates:clone(spec.groupRates)}:
      spec.guestRate!==undefined?{mode:"guest",rate:spec.guestRate}:
      spec.id==="chor"?{mode:"chorizo",size:"grande",largeRate:spec.rate,smallRate:null}:
      {mode:"equivalent",rate:spec.rate};
    return {id:spec.id,name:spec.name,category:spec.category,unit:spec.unit,
      target:legacy?null:spec.target,bought:null,prepared:null,basis:legacy?"review":"estimated",
      note:legacy?"Referencia nueva: elegí la cantidad planificada.":"Tasa inicial editable según invitados.",
      meatType:spec.meatGroup||null,meatGroup:spec.meatGroup||null,consumption:consumption,
      yield:spec.yield===undefined?null:spec.yield,duration:spec.duration===undefined?null:spec.duration,
      lead:spec.duration===undefined?null:spec.duration,footWidth:null,footDepth:null};
  }
  function newPlan(){
    var plan=clone(defaults);
    plan.recommendationVersion=2;
    plan.items=foodCatalog.map(function(x){return catalogItem(x,false);}).concat(plan.items.filter(function(x){return x.category==="Bebidas";}));
    return plan;
  }
  function enrichPlan(plan){
    var upToDate=plan.recommendationVersion===2;
    if(plan.assumptions.adultWeight===undefined)plan.assumptions.adultWeight=1;
    var oldCatalogIds=["ribs","pork","chor","morc","rusa","emp"];
    foodCatalog.forEach(function(spec){
      var current=plan.items.find(function(x){return x.id===spec.id;});
      var reference=catalogItem(spec,true);
      if(!current){if(!upToDate&&!oldCatalogIds.includes(spec.id))plan.items.push(reference);return;}
      if(current.consumption===undefined)current.consumption=reference.consumption;
      if(current.meatGroup===undefined && reference.meatGroup)current.meatGroup=reference.meatGroup;
    });
    plan.recommendationVersion=2;
    return plan;
  }
  function record(x){return x!==null && typeof x==="object" && !Array.isArray(x);}
  function numberOrNull(x,allowZero,max){return x===null || (typeof x==="number" && Number.isFinite(x) && (allowZero?x>=0:x>0) && (max===undefined || x<=max));}
  function time(x){return typeof x==="string" && (x==="" || /^([01]\d|2[0-3]):[0-5]\d$/.test(x));}
  function validPlan(x,legacy){
    if(!record(x) || !record(x.guests) || !record(x.assumptions) || !Array.isArray(x.items) || !Array.isArray(x.decisions))return false;
    if(x.recommendationVersion!==undefined && ![1,2].includes(x.recommendationVersion))return false;
    if(!["children","teens","adults"].every(function(k){return Number.isSafeInteger(x.guests[k]) && x.guests[k]>=0;}))return false;
    if(!["childWeight","teenWeight","meatGrams"].every(function(k){return numberOrNull(x.assumptions[k],true) && x.assumptions[k]!==null;}))return false;
    if(x.assumptions.adultWeight!==undefined && !numberOrNull(x.assumptions.adultWeight,true))return false;
    if(x.assumptions.empanadasPerGuest!==undefined && !numberOrNull(x.assumptions.empanadasPerGuest,true))return false;
    if(!time(x.eventStart) || !time(x.serveTime) || !numberOrNull(x.grillWidth,!!legacy) || !numberOrNull(x.grillDepth,!!legacy))return false;
    var ids=new Set(),decisionIds=new Set();
    if(!x.items.every(function(p){
      if(!record(p) || typeof p.id!=="string" || !p.id || ids.has(p.id) || typeof p.name!=="string" || !p.name.trim() || !["Parrilla","Entrada","Ensaladas","Bebidas","Postre","Otros"].includes(p.category) || !["kg","u","L","paq","planta"].includes(p.unit))return false;
      ids.add(p.id);
      if(!["confirmed","estimated","review"].includes(p.basis) || typeof p.note!=="string")return false;
      if(!["target","bought","prepared"].every(function(k){return Object.prototype.hasOwnProperty.call(p,k) && numberOrNull(p[k],true);}))return false;
      if(p.meatType!==undefined && p.meatType!==null && !["beef","pork","other"].includes(p.meatType))return false;
      if(p.meatGroup!==undefined && p.meatGroup!==null && !["beef","pork"].includes(p.meatGroup))return false;
      if(p.consumption!==undefined && p.consumption!==null){
        var c=p.consumption;
        if(!record(c) || !["none","equivalent","guest","groups","chorizo"].includes(c.mode))return false;
        if(["equivalent","guest"].includes(c.mode) && !numberOrNull(c.rate,true))return false;
        if(c.mode==="groups" && (!record(c.rates) || !["adults","teens","children"].every(function(k){return numberOrNull(c.rates[k],true); })))return false;
        if(c.mode==="chorizo" && (!["grande","chico"].includes(c.size) || !numberOrNull(c.largeRate,true) || !numberOrNull(c.smallRate,true)))return false;
      }
      if(p.yield!==undefined && !numberOrNull(p.yield,true,legacy?undefined:1))return false;
      if(p.duration!==undefined && !numberOrNull(p.duration,!!legacy))return false;
      if(p.lead!==undefined && !numberOrNull(p.lead,true))return false;
      if(p.footWidth!==undefined && !numberOrNull(p.footWidth,!!legacy))return false;
      if(p.footDepth!==undefined && !numberOrNull(p.footDepth,!!legacy))return false;
      return true;
    }))return false;
    return x.decisions.every(function(d){
      if(!record(d) || typeof d.id!=="string" || !d.id || decisionIds.has(d.id) || typeof d.title!=="string" || typeof d.note!=="string" || typeof d.done!=="boolean")return false;
      decisionIds.add(d.id);return true;
    });
  }
  var state;
  var storageIssue=false;
  try {
    var saved=localStorage.getItem(KEY);
    state=saved===null?newPlan():JSON.parse(saved)…5948 tokens truncated…acity-banner");
    banner.className="capacity-banner"+(area&&allFoot&&peak>area?" alert":"");
    banner.innerHTML=!area?"<strong>Capacidad por medir.</strong> Registrá el ancho y el fondo útiles para evaluar las tandas.":
      !allFoot?"<strong>Parrilla: "+fmt(area,0)+" cm².</strong> Falta la huella de una o más tandas. Medí el espacio que ocupa cada tanda completa.":
      peak>area?"<strong>Solapamiento: "+fmt(peak/area*100,0)+"% de ocupación a las "+clock(peakAt)+".</strong> Ajustá el inicio, dividí una tanda o reservá otra superficie antes de dar el plan por cerrado.":
      "<strong>Solapamiento estimado: "+fmt(peak/area*100,0)+"% máximo.</strong> Queda espacio según las medidas cargadas; verificá forma de los cortes, brasas y circulación.";
    setHTML("production-list",tasks.map(function(x,i){
      var first=serve===null?null:serve-Number(x.lead||0),end=first===null?null:first+Number(x.duration||0),gap=serve===null?0:serve-end;
      return '<div class="production-card" data-item-id="'+esc(x.id)+'"><span class="order-badge">'+String(i+1).padStart(2,"0")+'</span><div class="prod-title"><h3>'+esc(x.name)+'</h3><p>'+fmt(x.target)+' '+esc(x.unit)+' · '+(first===null?'Horario por definir':clock(first)+' ('+relative(first)+') → '+clock(end))+'</p><p class="'+(gap>0?"warn-text":"")+'">'+(gap>0?"Termina "+fmt(gap,0)+" min antes de servir: resolver conservación caliente.":gap<0?"Termina "+fmt(-gap,0)+" min después del servicio previsto.":"Termina al servir.")+'</p></div>'+
        '<label>Cocción (min)<input type="number" min="1" step="5" data-field="duration" value="'+esc(x.duration)+'"></label>'+
        '<label>Inicio antes de servir (min)<input type="number" min="0" step="5" data-field="lead" value="'+esc(x.lead)+'"></label>'+
        '<label>Huella ancho (cm)<input type="number" min="1" step="1" data-field="footWidth" placeholder="Medir" value="'+(x.footWidth==null?"":esc(x.footWidth))+'"></label>'+
        '<label>Huella fondo (cm)<input type="number" min="1" step="1" data-field="footDepth" placeholder="Medir" value="'+(x.footDepth==null?"":esc(x.footDepth))+'"></label></div>';
    }).join("")+'<div class="note-box"><strong>Por configurar:</strong> '+(state.items.filter(function(x){return x.category==="Parrilla" && !tasks.includes(x);}).map(function(x){return esc(x.name)+" ("+(n(x.target)===null?"falta cantidad":n(x.duration)===null?"falta tiempo de cocción":"cantidad cero")+")";}).join(", ")||"Ningún producto pendiente")+'.</div>');
  }
  function renderDecisions(){
    document.getElementById("decision-intro").innerHTML="<strong>Sin datos inventados.</strong> "+fmt(guests(),0)+" invitados previstos · "+state.decisions.filter(function(x){return !x.done;}).length+" decisiones abiertas. Las notas se conservan hasta que las edites o elimines.";
    setHTML("decision-list",state.decisions.map(function(x){
      return '<div class="decision-card '+(x.done?"done":"")+'" data-decision-id="'+esc(x.id)+'"><input type="checkbox" aria-label="Marcar resuelta" data-decision-field="done" '+(x.done?"checked":"")+ '><div><input class="decision-title" aria-label="Decisión" data-decision-field="title" value="'+esc(x.title)+'"><textarea aria-label="Notas" data-decision-field="note" placeholder="Anotá opciones o datos a averiguar">'+esc(x.note||"")+'</textarea></div><button class="remove-btn" data-action="remove-decision" aria-label="Eliminar decisión">×</button></div>';
    }).join("") || '<div class="empty">No hay decisiones abiertas.</div>');
  }
  function render(){renderStorageNotice();renderOverview();renderShopping();renderProduction();renderDecisions();}
  function go(view){document.querySelectorAll(".view").forEach(function(x){x.classList.toggle("active",x.id==="view-"+view);});document.querySelectorAll(".nav").forEach(function(x){x.classList.toggle("active",x.dataset.view===view);});var titles={resumen:["Panorama del evento","Todo lo importante en un solo lugar, sin dar por comprado lo que todavía no está registrado."],compras:["Lista de compras","Cantidades, avances y dudas en una lista que se actualiza con tu plan."],produccion:["Producción y parrilla","Tandas y espacio para llegar al servicio sin improvisar."],decisiones:["Decisiones pendientes","Lo que falta averiguar tiene su lugar y no se confunde con lo confirmado."]};document.getElementById("page-title").textContent=titles[view][0];document.getElementById("page-subtitle").textContent=titles[view][1];window.scrollTo({top:0,behavior:"smooth"});}
  document.addEventListener("click",function(e){
    var nav=e.target.closest("[data-view], [data-goto]");if(nav){go(nav.dataset.view||nav.dataset.goto);return;}
    var f=e.target.closest("[data-filter]");if(f){filter=f.dataset.filter;renderShopping();return;}
    if(e.target.closest("#add-item")){document.getElementById("item-dialog").showModal();return;}
    if(e.target.closest("[data-close]")){document.getElementById("item-dialog").close();return;}
    if(e.target.closest("#add-decision")){state.decisions.push({id:"d"+Date.now(),title:"Nueva decisión",note:"",done:false});save();renderDecisions();return;}
    var act=e.target.closest("[data-action]");if(!act)return;
    var row=act.closest("[data-item-id]"),x=row&&item(row.dataset.itemId),decision=act.closest("[data-decision-id]");
    if(act.dataset.action==="mark-bought"&&x&&x.bought===null&&n(x.target)!==null){x.bought=x.target;}
    if(act.dataset.action==="accept-recommendation"&&x&&recommended(x)!==null){x.target=recommended(x);}
    if(act.dataset.action==="remove-item"&&x){if(!confirm("¿Quitar "+x.name+" de la lista?"))return;state.items=state.items.filter(function(y){return y.id!==x.id;});}
    if(act.dataset.action==="remove-decision"&&decision){state.decisions=state.decisions.filter(function(y){return y.id!==decision.dataset.decisionId;});}
    save();render();
  });
  document.addEventListener("input",function(e){
    var el=e.target,k=el.dataset.guest,a=el.dataset.assumption,row=el.closest("[data-item-id]");
    if(k)state.guests[k]=Math.floor(n(el.value)||0);
    else if(a)state.assumptions[a]=n(el.value)||0;
    else if(row&&el.dataset.consumption)updateConsumption(item(row.dataset.itemId),el.dataset.consumption,el.value);
    else return;
    save();renderStorageNotice();renderOverview(true);renderDecisions();
    if(row)refreshRecommendationLabels();
    else renderShopping();
  });
  document.addEventListener("change",function(e){
    var el=e.target,k=el.dataset.guest,a=el.dataset.assumption,row=el.closest("[data-item-id]"),de=el.closest("[data-decision-id]");
    if(k){state.guests[k]=Math.floor(n(el.value)||0);}
    else if(a){state.assumptions[a]=n(el.value)||0;}
    else if(row&&el.dataset.consumption){updateConsumption(item(row.dataset.itemId),el.dataset.consumption,el.value);}
    else if(row&&el.dataset.field){var x=item(row.dataset.itemId),field=el.dataset.field;x[field]=["name","note","basis","meatType"].includes(field)?el.value:n(el.value);if(field==="duration"&&x.lead==null)x.lead=x.duration;if(field==="meatType"&&x.category==="Parrilla"&&x.unit==="kg")x.meatGroup=el.value==="other"?null:el.value;}
    else if(de&&el.dataset.decisionField){var d=state.decisions.find(function(x){return x.id===de.dataset.decisionId;});d[el.dataset.decisionField]=el.dataset.decisionField==="done"?el.checked:el.value;}
    else if(el.id==="event-start")state.eventStart=el.value;
    else if(el.id==="serve-time")state.serveTime=el.value;
    else if(el.id==="grill-width")state.grillWidth=n(el.value);
    else if(el.id==="grill-depth")state.grillDepth=n(el.value);
    else return;
    save();render();
  });
  document.getElementById("item-form").addEventListener("submit",function(e){
    e.preventDefault();var form=e.currentTarget,data=new FormData(form);
    var cat=data.get("category"),unit=data.get("unit"),meatGroup=cat==="Parrilla"&&unit==="kg"?"beef":null;
    state.items.push({id:"i"+Date.now(),name:String(data.get("name")).trim(),category:cat,meatType:meatGroup,meatGroup:meatGroup,unit:unit,target:n(data.get("target")),bought:null,prepared:null,basis:n(data.get("target"))===null?"review":"estimated",note:String(data.get("note")||""),consumption:cat==="Bebidas"?null:{mode:"none"},yield:null,duration:null,lead:null,footWidth:null,footDepth:null});
    save();form.reset();document.getElementById("item-dialog").close();render();
  });
  document.getElementById("export-btn").addEventListener("click",function(){var blob=new Blob([JSON.stringify({format:KEY,data:state},null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="asado-en-marcha-respaldo.json";a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);});
  document.getElementById("import-file").addEventListener("change",function(e){
    var file=e.target.files[0];if(!file)return;
    file.text().then(function(t){
      var parsed=JSON.parse(t);
      if(!record(parsed) || parsed.format!==KEY || !validPlan(parsed.data))throw Error("Formato inválido");
      if(!confirm("¿Reemplazar el plan actual por este respaldo?"))return;
      var imported=enrichPlan(parsed.data);
      localStorage.setItem(KEY,JSON.stringify(imported));
      state=imported;storageIssue=false;render();
    }).catch(function(){alert("No se pudo importar el respaldo. El plan actual se conservó.");});
    e.target.value="";
  });
  render();
})();
