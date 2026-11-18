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
    state=saved===null?newPlan():JSON.parse(saved);
    if(!validPlan(state,true))throw Error("Saved plan is incomplete");
    state=enrichPlan(state);
  } catch(e) { state=newPlan();storageIssue=true; }
  var filter="todos";
  function save(){
    if(storageIssue)return;
    try {localStorage.setItem(KEY,JSON.stringify(state));}
    catch(e){storageIssue=true;}
  }
  function renderStorageNotice(){
    var el=document.getElementById("storage-warning");
    el.hidden=!storageIssue;
    if(storageIssue)el.textContent="No se pudieron leer o guardar los datos de este navegador. El registro anterior no se reemplazó. Importá un respaldo válido para recuperar el guardado.";
  }
  function esc(x){return String(x == null ? "" : x).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function n(v){if(v===null || v===undefined || v==="")return null;var x=Number(v);return Number.isFinite(x) && x>=0?x:null;}
  function fmt(v,d){return Number(v).toLocaleString("es-AR",{maximumFractionDigits:d==null?1:d});}
  function item(id){return state.items.find(function(x){return x.id===id;});}
  function guests(){return Number(state.guests.children||0)+Number(state.guests.teens||0)+Number(state.guests.adults||0);}
  function equivalents(){return Number(state.guests.children||0)*Number(state.assumptions.childWeight||0)+Number(state.guests.teens||0)*Number(state.assumptions.teenWeight||0)+Number(state.guests.adults||0)*Number(state.assumptions.adultWeight===undefined?1:state.assumptions.adultWeight);}
  function recommended(x){
    var c=x&&x.consumption,raw;
    if(!c || c.mode==="none")return null;
    if(c.mode==="equivalent")raw=c.rate===null?null:equivalents()*c.rate;
    if(c.mode==="guest")raw=c.rate===null?null:guests()*c.rate;
    if(c.mode==="groups")raw=["adults","teens","children"].reduce(function(sum,k){return sum===null || c.rates[k]===null?null:sum+state.guests[k]*c.rates[k];},0);
    if(c.mode==="chorizo"){var rate=c.size==="chico"?c.smallRate:c.largeRate;raw=rate===null?null:equivalents()*rate;}
    if(raw===null || !Number.isFinite(raw))return null;
    if(raw<=0)return 0;
    return x.unit==="kg" || x.unit==="L" ? Math.max(1,Math.ceil(raw*10-1e-9))/10 : Math.max(1,Math.ceil(raw-1e-9));
  }
  function legacyMeat(x){
    if(!x)return false;
    var name=String(x.name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
    return ["beef","tapa"].includes(x.id)||/^(vacuno|tapa de asado)(?:\b|$)/.test(name);
  }
  function legacyHasAmounts(x){return ["target","bought","prepared"].some(function(k){return n(x[k])!==null;});}
  function legacyNeedsReview(x){return legacyMeat(x)&&legacyHasAmounts(x);}
  function meatCuts(group){
    return state.items.filter(function(x){return x.category==="Parrilla"&&x.unit==="kg"&&x.meatGroup===group&&!legacyMeat(x);});
  }
  function dashboardMeat(group){
    var cuts=meatCuts(group);
    if(!cuts.length)return null;
    var amounts=cuts.map(recommended);
    return amounts.some(function(v){return v===null;})?null:Math.round(amounts.reduce(function(a,b){return a+b;},0)*10)/10;
  }
  function plannedMeatGroup(group){
    var cuts=meatCuts(group);
    return cuts.length&&cuts.every(function(x){return n(x.target)!==null;})?
      Math.round(cuts.reduce(function(sum,x){return sum+Number(x.target);},0)*10)/10:null;
  }
  function hasLegacyReview(){return state.items.some(legacyNeedsReview);}
  function dashboardCard(label,value,planned,unit){
    var amount=value===null?"Sin estimación":fmt(value,unit==="u"?0:1)+(unit?" "+unit:"");
    return '<div class="metric"><div class="icon">◌</div><strong>'+esc(amount)+'</strong><b>'+esc(label)+'</b>'+
      (planned===null?"":'<small>Planificado: '+esc(fmt(planned)+(unit?" "+unit:""))+'</small>')+'</div>';
  }
  function plannedMeat(){
    if(hasLegacyReview())return null;
    var beef=plannedMeatGroup("beef"),pork=plannedMeatGroup("pork");
    return beef===null||pork===null?null:beef+pork;
  }
  function unitText(x,amount){return x.unit==="planta"&&amount!==1?"plantas":x.unit;}
  function recommendationText(x){
    var rec=recommended(x),planned=n(x.target);
    if(rec===null)return "Recomendación: falta configurar tasa";
    return "Recomendado: "+fmt(rec)+" "+unitText(x,rec)+(x.consumption&&x.consumption.mode==="chorizo"?" (tamaño "+x.consumption.size+")":"")+" · planificado: "+(planned===null?"por definir":fmt(planned)+" "+unitText(x,planned))+
      (planned===null?"":" · diferencia: "+(planned-rec>0?"+":"")+fmt(planned-rec)+" "+unitText(x,Math.abs(planned-rec)));
  }
  function updateConsumption(x,field,value){
    if(field==="mode"){
      x.consumption=value==="groups"?{mode:"groups",rates:{adults:null,teens:null,children:null}}:
        value==="equivalent"||value==="guest"?{mode:value,rate:null}:{mode:"none"};
      return;
    }
    var c=x.consumption;if(!c)return;
    if(field==="size"){c.size=value;return;}
    var rate=n(value),scaled=x.unit==="kg"&&rate!==null?rate/1000:rate;
    if(field==="chorizoRate")c[c.size==="chico"?"smallRate":"largeRate"]=rate;
    else if(field==="rate")c.rate=scaled;
    else if(c.mode==="groups")c.rates[field]=scaled;
  }
  function amountText(x){return n(x.target)===null?"por definir":fmt(x.target)+" "+unitText(x,x.target);}
  function categoryText(category){return state.items.filter(function(x){return x.category===category;}).map(function(x){return esc(x.name)+" ("+amountText(x)+")";}).join(" · ") || "Sin productos cargados";}
  function cooked(){
    if(hasLegacyReview())return null;
    return state.items.filter(function(x){return x.category==="Parrilla" && x.unit==="kg" && !legacyMeat(x) && n(x.target)!==null && n(x.yield)!==null;}).reduce(function(a,x){return a+Number(x.target)*Number(x.yield);},0);
  }
  function badge(b){return b==="confirmed"?'<span class="tag confirmed">Confirmado</span>':b==="estimated"?'<span class="tag estimated">Estimación</span>':'<span class="tag review">Por revisar</span>';}
  function setHTML(id,html){document.getElementById(id).innerHTML=html;}
  function renderOverview(preserveEditors){
    var total=guests(),eq=equivalents(),emp=item("emp"),empCount=emp&&n(emp.target)!==null?emp.target:null,empRec=recommended(emp);
    var beefRec=dashboardMeat("beef"),porkRec=dashboardMeat("pork"),principalRec=(beefRec||0)+(porkRec||0);
    var planned=plannedMeat(),meatComparison=planned===null?"Plan crudo sin validar: revisá cantidades sin definir y registros anteriores pendientes.":"Planificado crudo: "+fmt(planned)+" kg · diferencia plan − recomendado: "+fmt(planned-principalRec)+" kg.";
    var cookedGoal=eq*Number(state.assumptions.meatGrams||0)/1000;
    document.getElementById("hero-guests").textContent=fmt(total,0);
    document.getElementById("event-summary").textContent="Comienza "+(state.eventStart||"por definir")+" · fecha por definir";
    document.getElementById("hero-menu").textContent=["Entrada","Parrilla","Ensaladas","Postre"].filter(function(group){return state.items.some(function(x){return x.category===group;});}).map(function(group){return group==="Parrilla"?"Asado":group;}).join(" · ") || "Sin menú cargado";
    var pending=state.items.filter(function(x){return n(x.target)===null || n(x.bought)===null || x.bought<x.target;}).length;
    var single=function(id,label,unit){var x=item(id);return dashboardCard(label,recommended(x),x?n(x.target):null,unit);};
    var tomato=item("tomato"),lettuce=item("lettuce"),tomatoRec=recommended(tomato),lettuceRec=recommended(lettuce);
    var mixed=tomatoRec===null||lettuceRec===null?"Sin estimación":fmt(tomatoRec)+" kg tomate · "+fmt(lettuceRec,0)+" plantas lechuga";
    var mixedPlan=tomato&&lettuce&&n(tomato.target)!==null&&n(lettuce.target)!==null?
      "Planificado: "+fmt(tomato.target)+" kg tomate · "+fmt(lettuce.target)+" plantas lechuga":"";
    setHTML("metrics",
      dashboardCard("Invitados",total,null,"")+
      single("emp","Empanadas recomendadas","u")+
      dashboardCard("Carne vacuna recomendada (kg crudos)",beefRec,plannedMeatGroup("beef"),"kg")+
      dashboardCard("Carne de cerdo recomendada (kg crudos)",porkRec,plannedMeatGroup("pork"),"kg")+
      single("chor","Chorizos recomendados","u")+
      single("morc","Morcillas recomendadas","u")+
      single("rusa","Ensalada rusa recomendada","kg")+
      '<div class="metric"><div class="icon">◌</div><strong class="mixed-amount">'+esc(mixed)+'</strong><b>Ensalada mixta recomendada</b>'+(mixedPlan?'<small>'+esc(mixedPlan)+'</small>':"")+'</div>'+
      single("bonbon","Palitos bombón recomendados","u"));
    if(!preserveEditors)setHTML("guest-fields",
      [['children','Niños'],['teens','Adolescentes'],['adults','Adultos']].map(function(a){return '<label>'+a[1]+'<input type="number" min="0" step="1" data-guest="'+a[0]+'" value="'+esc(state.guests[a[0]])+'"></label>';}).join(""));
    if(!preserveEditors)setHTML("assumptions",
      [['adultWeight','Peso adulto (equiv.)',0.1],['teenWeight','Peso adolescente (equiv.)',0.1],['childWeight','Peso niño (equiv.)',0.1],['meatGrams','Referencia carne cocida / equiv. (g)',10]].map(function(a){return '<label>'+a[1]+'<input type="number" min="0" step="'+a[2]+'" data-assumption="'+a[0]+'" value="'+esc(state.assumptions[a[0]])+'"></label>';}).join(""));
    var cookedAmount=cooked();
    document.getElementById("cooked-note").textContent=cookedAmount===null?
      "Cocido sin estimar: hay registros anteriores de Vacuno o Tapa de asado con cantidades guardadas. Están fuera de los subtotales nuevos hasta revisarlos, para evitar duplicaciones.":
      "Estimación separada del plan elegido: "+fmt(cookedAmount,1)+" kg cocidos según rendimiento; referencia cocida "+fmt(cookedGoal,1)+" kg. "+meatComparison+" La compra recomendada de cortes usa peso crudo.";
    var grillItems=state.items.filter(function(x){return x.category==="Parrilla";}),legacyItems=state.items.filter(legacyMeat);
    var otherGrill=grillItems.filter(function(x){return !legacyMeat(x)&&!(x.unit==="kg"&&(x.meatGroup==="beef"||x.meatGroup==="pork"));});
    var otherGrillText=otherGrill.map(function(x){return esc(x.name)+" ("+amountText(x)+")";}).join(" · ")||"Sin otros productos cargados";
    var legacyText=legacyItems.map(function(x){
      var amounts=["target","bought","prepared"].filter(function(k){return n(x[k])!==null;}).map(function(k){return {target:"planificado",bought:"comprado",prepared:"preparado"}[k]+" "+fmt(x[k])+" kg";});
      return esc(x.name)+" ("+(amounts.join(" · ")||"sin cantidades registradas")+") — "+(legacyNeedsReview(x)?"pendiente de revisión; excluido de subtotales para evitar duplicar cantidades":"registro anterior conservado, fuera de subtotales");
    }).join("<br>");
    var beefCuts=meatCuts("beef"),porkCuts=meatCuts("pork");
    function meatMenuCard(label,cuts,group){
      var rec=dashboardMeat(group),plan=plannedMeatGroup(group);
      var list=cuts.length?cuts.map(function(x){var name=x.id==="pork"&&/^Matambrito de cerdo$/i.test(x.name)?"Matambrito":x.name;return esc(name)+" ("+amountText(x)+")";}).join(" · "):"Sin cortes cargados.";
      return '<div class="menu-card"><span>♨</span><h3>'+label+'</h3><p>'+list+'</p><p><strong>Subtotal recomendado:</strong> '+(rec===null?"sin estimación":fmt(rec)+" kg crudos")+'<br><strong>Subtotal planificado:</strong> '+(plan===null?"por definir":fmt(plan)+" kg crudos")+'</p></div>';
    }
    setHTML("menu-overview",
      '<div class="menu-card"><span>🥟</span><h3>Entrada</h3><p>'+categoryText("Entrada")+'.</p></div>'+
      meatMenuCard("Carne vacuna",beefCuts,"beef")+
      meatMenuCard("Carne de cerdo",porkCuts,"pork")+
      '<div class="menu-card"><span>♨</span><h3>Otros de parrilla</h3><p>'+otherGrillText+'.</p></div>'+
      (legacyItems.length?'<div class="menu-card"><span>!</span><h3>Revisión de registros anteriores</h3><p>'+legacyText+'</p></div>':"")+
      '<div class="menu-card"><span>🥗</span><h3>Guarnición</h3><p>'+categoryText("Ensaladas")+'.</p></div>'+
      '<div class="menu-card"><span>✦</span><h3>Postre y bebidas</h3><p>'+categoryText("Postre")+'. Bebidas: '+categoryText("Bebidas")+'.</p></div>');
  }
  function consumptionFields(x){
    if(x.category==="Bebidas")return "";
    var c=x.consumption||{mode:"none"};
    if(c.mode==="chorizo"){
      var size=c.size==="chico"?"chico":"grande",rate=size==="chico"?c.smallRate:c.largeRate;
      return '<label>Tamaño de chorizo<select data-consumption="size"><option value="grande" '+(size==="grande"?"selected":"")+'>Grande</option><option value="chico" '+(size==="chico"?"selected":"")+'>Chico</option></select></label>'+
        '<label>Unidades / adulto equivalente<input type="number" min="0" step=".01" data-consumption="chorizoRate" placeholder="Definir tasa" value="'+(rate===null?"":esc(rate))+'"></label>';
    }
    var fields='<label>Regla de consumo<select data-consumption="mode"><option value="none" '+(c.mode==="none"?"selected":"")+'>Sin regla</option><option value="equivalent" '+(c.mode==="equivalent"?"selected":"")+'>Por adulto equivalente</option><option value="guest" '+(c.mode==="guest"?"selected":"")+'>Por invitado</option><option value="groups" '+(c.mode==="groups"?"selected":"")+'>Por grupo de edad</option></select></label>';
    if(c.mode==="equivalent"||c.mode==="guest"){
      var grams=x.unit==="kg";
      fields+='<label>Consumo '+(grams?"g":esc(x.unit))+' / '+(c.mode==="guest"?"invitado":"adulto equivalente")+'<input type="number" min="0" step="'+(grams?"1":".01")+'" data-consumption="rate" placeholder="Definir tasa" value="'+(c.rate===null?"":esc(grams?c.rate*1000:c.rate))+'"></label>';
    }
    if(c.mode==="groups"){
      ["adults","teens","children"].forEach(function(k){
        var label={adults:"Adulto",teens:"Adolescente",children:"Niño"}[k],grams=x.unit==="kg";
        fields+='<label>'+label+' ('+(grams?"g":esc(x.unit))+')<input type="number" min="0" step="'+(grams?"1":".01")+'" data-consumption="'+k+'" placeholder="Definir" value="'+(c.rates[k]===null?"":esc(grams?c.rates[k]*1000:c.rates[k]))+'"></label>';
      });
    }
    return fields;
  }
  function renderShopping(){
    document.getElementById("recipe-note").hidden=!item("emp");
    var expanded=Array.from(document.querySelectorAll("#shopping-list details[open]")).map(function(x){return x.closest("[data-item-id]").dataset.itemId;});
    var groups=[
      {name:"Carne vacuna",match:function(x){return x.category==="Parrilla"&&x.unit==="kg"&&x.meatGroup==="beef"&&!legacyMeat(x);}},
      {name:"Carne de cerdo",match:function(x){return x.category==="Parrilla"&&x.unit==="kg"&&x.meatGroup==="pork"&&!legacyMeat(x);}},
      {name:"Pendientes de revisión",match:legacyMeat},
      {name:"Otros de parrilla",match:function(x){return x.category==="Parrilla"&&!legacyMeat(x)&&!(x.unit==="kg"&&(x.meatGroup==="beef"||x.meatGroup==="pork"));}},
      {name:"Entrada",match:function(x){return x.category==="Entrada";}},
      {name:"Ensaladas",match:function(x){return x.category==="Ensaladas";}},
      {name:"Bebidas",match:function(x){return x.category==="Bebidas";}},
      {name:"Postre",match:function(x){return x.category==="Postre";}},
      {name:"Otros",match:function(x){return x.category==="Otros";}}
    ],visible=state.items.filter(function(x){
      if(filter==="pendientes")return n(x.target)!==null && (n(x.bought)===null || x.bought<x.target);
      if(filter==="comprados")return n(x.bought)!==null && x.bought>0;
      if(filter==="averiguar")return n(x.target)===null;
      return true;
    });
    document.querySelectorAll("#filters button").forEach(function(b){b.classList.toggle("active",b.dataset.filter===filter);});
    document.getElementById("shopping-summary").textContent=visible.length+" productos · "+state.items.filter(function(x){return n(x.target)===null;}).length+" metas sin definir";
    setHTML("shopping-list",groups.map(function(group){
      var entries=visible.filter(group.match);
      if(!entries.length)return "";
      return '<div class="group-title">'+group.name+'<small>'+entries.length+' productos</small></div>'+entries.map(function(x){
        var t=n(x.target),b=n(x.bought),p=n(x.prepared),status=t===null?'<span class="status unknown">Meta por averiguar</span>':b===null?'<span class="status unknown">Compra sin registrar</span>':b<t?'<span class="status missing">Faltan '+fmt(t-b)+' '+esc(unitText(x,t-b))+'</span>':b>t?'<span class="status missing">Exceso +'+fmt(b-t)+' '+esc(unitText(x,b-t))+'</span>':'<span class="status ok">Compra completa</span>';
        var rec=recommended(x),oldRecord=legacyMeat(x),oldStatus=oldRecord?(legacyNeedsReview(x)?" · registro anterior pendiente de revisión; fuera de subtotales":" · registro anterior conservado; fuera de subtotales"):"";
        var recommendation=x.category==="Bebidas"?"":oldRecord?'<small>Registro anterior excluido de subtotales para evitar duplicaciones.</small>':'<small data-rec-id="'+esc(x.id)+'">'+esc(recommendationText(x))+'</small>';
        return '<div class="shopping-card" data-item-id="'+esc(x.id)+'"><div class="item-name"><input aria-label="Nombre del producto" data-field="name" value="'+esc(x.name)+'"><small>'+esc(x.note||"Sin nota")+' · '+(x.basis==="confirmed"?"dato confirmado":x.basis==="estimated"?"estimación":"por revisar")+esc(oldStatus)+'</small></div>'+
          '<label>Meta ('+esc(x.unit)+')<input type="number" min="0" step="any" placeholder="Sin definir" data-field="target" value="'+(t===null?"":esc(t))+'"></label>'+
          '<label>Comprado<input type="number" min="0" step="any" placeholder="Sin registrar" data-field="bought" value="'+(b===null?"":esc(b))+'"></label>'+
          '<label>Preparado<input type="number" min="0" step="any" placeholder="Sin registrar" data-field="prepared" value="'+(p===null?"":esc(p))+'"></label>'+
          '<div><div>'+status+recommendation+'</div><div class="row-actions">'+(!oldRecord&&rec!==null&&t!==rec?'<button class="tiny-btn" data-action="accept-recommendation">Adoptar recomendado</button>':"")+'<button class="tiny-btn" data-action="mark-bought" '+(t===null||b!==null?'disabled title="Editá la cantidad comprada en el campo"':'')+'>'+(b===null?"Comprado":"Registrado")+'</button><button class="remove-btn" data-action="remove-item" aria-label="Quitar '+esc(x.name)+'">×</button></div></div>'+
          '<details class="item-details"><summary>Detalles y criterio de esta cifra</summary><div class="details-grid"><label>Estado del dato<select data-field="basis"><option value="confirmed" '+(x.basis==="confirmed"?"selected":"")+'>Confirmado</option><option value="estimated" '+(x.basis==="estimated"?"selected":"")+'>Estimación</option><option value="review" '+(x.basis==="review"?"selected":"")+'>Por revisar</option></select></label><label>Nota<input data-field="note" value="'+esc(x.note||"")+'"></label>'+
          (x.category==="Parrilla"?'<label>Tipo de carne<select data-field="meatType"><option value="beef" '+(x.meatType==="beef"?"selected":"")+'>Vacuno</option><option value="pork" '+(x.meatType==="pork"?"selected":"")+'>Cerdo</option><option value="other" '+(x.meatType==="other"?"selected":"")+'>Otro</option></select></label><label>Rendimiento cocido (0 a 1)<input type="number" min="0" max="1" step=".05" data-field="yield" placeholder="Sin estimar" value="'+(x.yield==null?"":esc(x.yield))+'"></label><label>Cocción (min)<input type="number" min="1" step="5" data-field="duration" placeholder="Por estimar" value="'+(x.duration==null?"":esc(x.duration))+'"></label>':"")+
          consumptionFields(x)+'</div></details></div>';
      }).join("");
    }).join("") || '<div class="empty">No hay productos en esta vista.</div>');
    document.querySelectorAll("#shopping-list [data-item-id]").forEach(function(row){if(expanded.includes(row.dataset.itemId))row.querySelector("details").open=true;});
  }
  function refreshRecommendationLabels(){
    document.querySelectorAll("[data-rec-id]").forEach(function(el){
      var x=item(el.dataset.recId);
      if(x)el.textContent=recommendationText(x);
    });
  }
  function minutes(s){var a=String(s||"").split(":");return a.length===2?Number(a[0])*60+Number(a[1]):null;}
  function clock(m){if(m===null)return "—";var x=((m%1440)+1440)%1440;return String(Math.floor(x/60)).padStart(2,"0")+":"+String(x%60).padStart(2,"0");}
  function relative(m){var start=minutes(state.eventStart);if(start===null)return "—";var d=m-start;return (d<0?"T−":"T+")+Math.floor(Math.abs(d)/60)+" h "+String(Math.abs(d)%60).padStart(2,"0");}
  function renderProduction(){
    document.getElementById("event-start").value=state.eventStart||"";
    document.getElementById("serve-time").value=state.serveTime||"";
    document.getElementById("grill-width").value=state.grillWidth==null?"":state.grillWidth;
    document.getElementById("grill-depth").value=state.grillDepth==null?"":state.grillDepth;
    var serve=minutes(state.serveTime),start=minutes(state.eventStart),w=n(state.grillWidth),d=n(state.grillDepth),area=w&&d?w*d:null;
    document.getElementById("time-note").textContent=serve===null?"Definí la hora de servir para ver horarios.":start===null?"Falta la hora del evento.":"Servicio "+clock(serve)+" · "+relative(serve)+" desde el comienzo del evento.";
    document.getElementById("space-note").textContent=area?"Superficie útil declarada: "+fmt(area,0)+" cm².":"Falta medir ancho y fondo útiles; la capacidad sigue sin validar.";
    var tasks=state.items.filter(function(x){return x.category==="Parrilla" && n(x.target)!==null && n(x.target)>0 && n(x.duration)!==null;}).sort(function(a,b){return b.duration-a.duration;});
    var allFoot=tasks.length>0 && tasks.every(function(x){return n(x.footWidth)>0&&n(x.footDepth)>0;});
    var peak=0,peakAt=null;
    if(area&&allFoot&&serve!==null){
      for(var at=serve-600;at<=serve+240;at+=5){
        var load=tasks.filter(function(x){return at>=serve-Number(x.lead||0)&&at<serve-Number(x.lead||0)+Number(x.duration||0);}).reduce(function(a,x){return a+x.footWidth*x.footDepth;},0);
        if(load>peak){peak=load;peakAt=at;}
      }
    }
    var banner=document.getElementById("capacity-banner");
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
