// Pantallas de caja, cocina, mesero y repartidor. Cada HTML define window.ROL antes de cargar este archivo.
(function(){
const SHEET_ID = "1SkaZA4m6t6Ti7DRR4B7VbWyf49taEUTc_TKh-xkxX4Y";
const ROL = window.ROL;
const NOMBRES = {caja:"Caja", cocina:"Cocina", mesero:"Mesero", repartidor:"Repartidor"};
const CON_NOMBRE = true;                     // todos entran con su nombre: cada paso queda firmado con hora y responsable
const CLAVE_NOMBRE = ROL+"_nombre";
const $ = id => document.getElementById(id);
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let API = "", PIN = localStorage.getItem("pin_"+ROL) || "", MESERO = localStorage.getItem(CLAVE_NOMBRE) || "";
let vistos = null, audio = null, ocupado = false;

function parseCSV(t){const R=[];let r=[],c="",q=false;for(let i=0;i<t.length;i++){const x=t[i];if(q){if(x=='"'){if(t[i+1]=='"'){c+='"';i++}else q=false}else c+=x}else if(x=='"')q=true;else if(x==','){r.push(c);c=""}else if(x=='\n'){r.push(c);R.push(r);r=[];c=""}else if(x!='\r')c+=x}if(c||r.length){r.push(c);R.push(r)}return R}

function sonar(){
  try{ if(!audio) audio=new (window.AudioContext||window.webkitAudioContext)();
    [0,0.25,0.5].forEach(t=>{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=ROL=="cocina"?660:880;o.connect(g);g.connect(audio.destination);g.gain.setValueAtTime(0.3,audio.currentTime+t);g.gain.exponentialRampToValueAtTime(0.001,audio.currentTime+t+0.2);o.start(audio.currentTime+t);o.stop(audio.currentTime+t+0.22)});
  }catch(e){}
  if(navigator.vibrate) navigator.vibrate([300,150,300]);
}
const api = q => fetch(API+"?"+new URLSearchParams(q)).then(r=>r.json());

function mins(h){ if(!h) return ""; const [a,b]=h.split(":").map(Number); const d=new Date(); let m=d.getHours()*60+d.getMinutes()-(a*60+b); if(m<0)m+=1440; return m<1?"ahora":"hace "+m+" min"; }

// Línea de tiempo del pedido: hora de cada paso, quién lo hizo y cuántos minutos tardó (en rojo si pasa de LIMITE).
let LIMITE=10;
function aMin(h){ const m=String(h||"").match(/^(\d{1,2}):(\d{2})/); return m?(+m[1])*60+(+m[2]):null; }
function linea(o){
  if(o.Tipo!="pedido") return "";
  const pasos=[["📥 Pedido",o.Hora,""],["🧾 Caja",o["Hora en cocina"],o.Cajero],["👨‍🍳 Listo",o["Hora listo"],o.Cocinero],[o.Mesa?"🍽️ Entregado":"🛵 Entregado",o["Hora entregado"],o["Hora entregado"]?o.Mesero:""]];
  let ant=aMin(o.Hora), html=[];
  for(let i=0;i<pasos.length;i++){
    const [et,h,quien]=pasos[i];
    if(!h){ if(ant!=null){ let m=aMin(new Date().toTimeString().slice(0,5))-ant; if(m<0)m+=1440; html.push(`<span class="tl-esp ${m>LIMITE?"tl-tarde":""}">⏳ ${et.split(" ")[1]}: esperando ${m} min</span>`);} break; }
    let m=null; const x=aMin(h); if(i>0&&ant!=null&&x!=null){ m=x-ant; if(m<0)m+=1440; }
    html.push(`<span class="${m!=null&&m>LIMITE?"tl-tarde":""}">${et} ${esc(h)}${m!=null?" ("+m+" min)":""}${quien?" · "+esc(quien):""}</span>`);
    ant=x;
  }
  return `<div class="tl">${html.join(" → ")}</div>`;
}

// El menú guarda el delivery como "Dirección: … · nota". Se separa para que la dirección solo la vean caja y repartidor.
function partir(n){ n=String(n||""); const m=n.match(/^Dirección:\s*(.*?)(?:\s·\s([\s\S]*))?$/); return m ? {dir:m[1], nota:m[2]||""} : {dir:"", nota:n}; }

// Repartidor: su GPS para calcular la distancia hasta cada entrega antes de aceptarla.
let YO=null, gpsMsg="";
function iniciarGPS(){
  if(ROL!="repartidor"||!navigator.geolocation) return;
  navigator.geolocation.watchPosition(p=>{ YO={lat:p.coords.latitude,lng:p.coords.longitude}; gpsMsg=""; },
    e=>{ gpsMsg = e.code==1 ? "Activa la ubicación del navegador para ver distancias" : "Buscando tu GPS…"; },
    {enableHighAccuracy:true,maximumAge:15000,timeout:30000});
}
function coords(dir){ const g=String(dir||"").match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)/); return g?{lat:+g[1],lng:+g[2]}:null; }
function km(a,b){ const R=6371,r=x=>x*Math.PI/180,dLa=r(b.lat-a.lat),dLo=r(b.lng-a.lng);
  const h=Math.sin(dLa/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
function distancia(dir){
  const c=coords(dir);
  if(!c) return `<div class="dist">📏 Distancia no disponible (dirección escrita a mano)</div>`;
  if(!YO) return `<div class="dist">📏 ${gpsMsg||"Buscando tu GPS…"}</div>`;
  const d=km(YO,c), calle=d*1.3, min=Math.max(3,Math.round(calle/25*60));
  return `<div class="dist">📏 A <b>${calle.toFixed(1)} km</b> de ti por calle (aprox.) · ${d.toFixed(1)} km en línea recta · ~${min} min en moto</div>`;
}

function tarjeta(o){
  let botones="", clase="", titulo="";
  const items = esc(o.Pedido).replace(/\n/g,"<br>");
  const {dir, nota} = partir(o.Nota);
  const lugar = o.Mesa=="Kiosco" ? "🏪 Kiosco · para retirar" : o.Mesa ? "Mesa "+esc(o.Mesa) : (ROL=="cocina" ? "🛵 Para delivery" : "Delivery · "+esc(o.Cliente));
  if(o.Tipo=="mesonero"){ titulo="🙋 "+lugar+" llama al mesero"; clase="alerta"; botones=`<button data-id="${o.ID}" data-n="atendido">✓ Ya voy</button>`; }
  else if(o.Tipo=="cuenta"){ titulo="🙋 "+lugar+" solicita al mesero"; clase="alerta";
    botones= ROL=="mesero" ? `<div style="width:100%"><div><b>Consumo acumulado de la mesa:</b></div>${o.Pedido?`<div class="items">${items}</div><div class="tot">Total: $${esc(o.Total)}</div>`:"<div>Sin pedidos registrados</div>"}
      <textarea id="msg-${o.ID}" rows="2" style="width:100%;margin:6px 0;padding:6px;border-radius:8px;border:1px solid #ccc" placeholder="Mensaje para la mesa">Ya voy a tu mesa.</textarea>
      <button data-id="${o.ID}" data-n="atendido">📨 Responder a la mesa</button>
      <button data-id="${o.ID}" data-n="cobrada" style="background:#5a3a22">💵 Cuenta cobrada · cerrar mesa</button></div>` : ""; }
  else {
    titulo="🍽️ "+lugar;
    if(ROL=="caja" && o.Estado=="nuevo") botones=`<button data-id="${o.ID}" data-n="en cocina">✓ Confirmar y enviar a cocina</button><button class="no" data-id="${o.ID}" data-n="rechazado">✕ Rechazar</button>`;
    if(ROL=="cocina" && o.Estado=="en cocina") botones=`<button data-id="${o.ID}" data-n="listo">✓ Listo para servir</button>`;
    if(ROL=="repartidor" && o.Estado=="listo"){ clase="alerta"; titulo="🛵 Delivery disponible"; botones=`<button data-id="${o.ID}" data-n="en camino">🙋 Aceptar esta entrega</button>`; }
    if(ROL=="repartidor" && o.Estado=="en camino"){ titulo="🛵 "+lugar+" · tu entrega"; botones=`<button data-id="${o.ID}" data-n="entregado">✓ Entregado al cliente</button>`; }
    if(ROL=="caja" && o.Estado=="en camino" && o.Mesero) titulo+=" · 🛵 "+esc(o.Mesero);
    if(ROL=="caja" && o.Estado=="listo" && o.Mesa=="Kiosco"){ clase="alerta"; titulo="✅ N.º "+esc(o.Num)+" listo · entregar en mostrador"; botones=`<button data-id="${o.ID}" data-n="entregado">✓ Entregado en mostrador</button>`; }
    if(ROL=="mesero" && o.Estado=="listo"){ clase="alerta"; titulo="✅ "+lugar+" · listo para llevar"; botones=`<button data-id="${o.ID}" data-n="entregado">✓ Entregado</button>`; }
  }
  const precio = ROL=="caja" && o.Tipo=="pedido" ? `<div class="tot">Total: $${esc(o.Total)}</div>` : "";
  const verDatos = (ROL=="caja"||(ROL=="repartidor"&&o.Estado=="en camino")) && !o.Mesa;
  let extra = ROL=="repartidor" && !o.Mesa ? distancia(dir) : "";
  if(verDatos && o.Telefono) extra += `<div class="sub">📞 <a href="tel:${esc(o.Telefono)}">${esc(o.Telefono)}</a></div>`;
  if(verDatos && dir){
    const g = dir.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)\s*(?:\(Ref:\s*([\s\S]*)\))?$/);
    const destino = g ? g[1]+","+g[2] : dir;
    const texto = g ? "Ubicación GPS del cliente"+(g[3]?" · Ref: "+esc(g[3]):"") : esc(dir);
    extra += `<div class="dir">📍 ${texto}${ROL=="repartidor"?`<br><a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}">🧭 Cómo llegar</a>`:""}</div>`;
  }
  return `<div class="card ${clase}"><div class="top"><b>${titulo}${o.Num&&o.Tipo=="pedido"?` <span class="num-ped">N.º ${esc(o.Num)}</span>`:""}</b><span>${esc(o.Hora)} · ${mins(o.Hora)}</span></div>
    ${o.Tipo=="pedido"?`<div class="items">${items}</div>`:""}${nota?`<div class="nota">📝 ${esc(nota)}</div>`:""}${extra}${precio}${linea(o)}
    <div class="est">Estado: ${esc(o.Estado)}</div><div class="bts">${botones}</div></div>`;
}

function filtrar(ps){
  if(ROL=="caja") return ps.filter(o=>o.Tipo=="pedido");
  if(ROL=="cocina") return ps.filter(o=>o.Tipo=="pedido"&&o.Estado=="en cocina");
  if(ROL=="repartidor") return ps.filter(o=>o.Tipo=="pedido"&&!o.Mesa&&(o.Estado=="listo"||(o.Estado=="en camino"&&o.Mesero==MESERO)));
  return ps.filter(o=>o.Mesa&&o.Mesa!="Kiosco"&&((o.Tipo=="pedido"&&o.Estado=="listo")||o.Tipo=="mesonero"||o.Tipo=="cuenta"));
}
function importante(o){
  if(ROL=="caja") return o.Tipo=="pedido"&&(o.Estado=="nuevo"||(o.Estado=="listo"&&o.Mesa=="Kiosco"));
  if(ROL=="cocina") return o.Estado=="en cocina";
  if(ROL=="repartidor") return o.Estado=="listo";
  return o.Estado=="listo"||o.Tipo=="mesonero"||o.Tipo=="cuenta";
}

let ABIERTA="", ULTIMOS=[], MESAS=[];
function porMesa(ps){                       // caja: un cuadro por mesa; al tocarlo se abre y muestra sus pedidos
  ULTIMOS=ps; const g={}, orden=[];
  ps.forEach(o=>{ const k=o.Mesa=="Kiosco"?"🏪 Kiosco":o.Mesa?"Mesa "+o.Mesa:"🛵 Delivery"; if(!g[k]){g[k]=[];orden.push(k);} g[k].push(o); });
  const cons={}; if(ROL=="caja") MESAS.forEach(m=>{ const k="Mesa "+m.mesa; cons[k]=m; if(!g[k]){g[k]=[];orden.push(k);} });
  orden.sort((a,b)=>(a.startsWith("🏪")?-1:a.startsWith("🛵")?1:0)-(b.startsWith("🏪")?-1:b.startsWith("🛵")?1:0)||a.localeCompare(b,"es",{numeric:true}));
  if(ABIERTA && !g[ABIERTA]) ABIERTA="";
  const fmt=n=>"$"+n.toFixed(2).replace(/\.00$/,"");
  const cuadros=orden.map(k=>{
    const l=g[k], tot=l.reduce((s,o)=>s+(o.Tipo=="pedido"?parseFloat(String(o.Total).replace(",","."))||0:0),0);
    const nuevos=l.filter(importante).length, abierta=k==ABIERTA;
    return `<div class="mesa-celda"><button class="mesa-cuadro ${nuevos?"mesa-alerta":""} ${abierta?"mesa-abierta":""}" data-mesa="${esc(k)}">
      <span class="mc-nom">${esc(k)}</span>
      <span class="mc-est">${nuevos?`🔴 ${nuevos} ${ROL=="cocina"?"por preparar":"nuevo"+(nuevos>1?"s":"")}`:"✓ Al día"}</span>
      ${cons[k]?`<span class="mc-det">🧾 Consumo abierto: ${fmt(Number(cons[k].total))}</span>`:""}
      <span class="mc-det">${l.length} ${ROL=="mesero"?(l.length>1?"avisos":"aviso"):(l.length>1?"pedidos":"pedido")}${ROL=="caja"?" · "+fmt(tot):""}</span></button>${cons[k]?(cons[k].pendientes>0?`<button class="mesa-cerrar mesa-bloq" disabled>🔒 ${cons[k].pendientes} ${cons[k].pendientes>1?"pedidos pendientes":"pedido pendiente"} · no se puede cerrar</button>`:`<button class="mesa-cerrar" data-pos="${esc(cons[k].mesa)}">🧾 Ticket y cobrar · ${fmt(Number(cons[k].total))}</button>`):""}</div>`;
  }).join("");
  const det = ABIERTA ? `<section class="mesa-detalle"><div class="md-top"><b>${esc(ABIERTA)}</b><button class="md-cerrar" data-mesa="${esc(ABIERTA)}">✕ Cerrar</button></div>
      ${cons[ABIERTA]?`<div class="card"><b>🧾 Consumo de la ${esc(ABIERTA)} (${cons[ABIERTA].n} ${cons[ABIERTA].n>1?"pedidos":"pedido"})</b>
        <div class="items">${esc(cons[ABIERTA].pedido).replace(/\n/g,"<br>")}</div><div class="tot">Total a cobrar: ${fmt(Number(cons[ABIERTA].total))}</div>
        <div class="sub">Para cobrar, usa el botón «🧾 Ticket y cobrar» debajo del cuadro de la mesa.</div></div>`:""}
      <div style="display:grid;gap:10px">${g[ABIERTA].map(tarjeta).join("")}</div></section>` : `<p class="vacio" style="grid-column:1/-1;margin:4px 0">Toca una mesa para ver sus pedidos.</p>`;
  return `<div class="mesas-grid">${cuadros}</div>${det}`;
}
function activarMesas(){
  document.querySelectorAll("[data-mesa]").forEach(b=>b.onclick=()=>{
    ABIERTA = ABIERTA==b.dataset.mesa ? "" : b.dataset.mesa;
    $("lista").innerHTML=porMesa(ULTIMOS); activarMesas();
    $("lista").querySelectorAll("button[data-id]").forEach(x=>x.onclick=()=>cambiar(x));
    activarCierre();
    if(ABIERTA){ const d=document.querySelector(".mesa-detalle"); d&&d.scrollIntoView({behavior:"smooth",block:"start"}); }
  });
}
function activarCierre(){
  document.querySelectorAll("button[data-cerrar]").forEach(b=>b.onclick=()=>confirmarCierre(b));
  document.querySelectorAll("button[data-pos]").forEach(b=>b.onclick=()=>abrirPOS(b.dataset.pos));
}
// Ventana de alerta antes de cerrar: la cajera revisa el consumo y confirma que el cliente pagó todo.
function confirmarCierre(b){
  const m=MESAS.find(x=>x.mesa==b.dataset.cerrar); if(!m) return;
  if(m.pendientes>0){ alert("No se puede cerrar la Mesa "+m.mesa+": todavía tiene pedidos pendientes. Primero deben entregarse."); return; }
  const v=document.createElement("div"); v.className="alerta-cierre";
  v.innerHTML=`<div class="ac-caja"><div style="font-size:46px">⚠️</div><h3>¿De verdad quieres cerrar la Mesa ${esc(m.mesa)}?</h3>
    <p>Antes de cerrar, <b>verifica bien que el cliente pagó todo correctamente</b>. Al cerrarla, su consumo se archiva y la mesa queda libre para un nuevo cliente. <b>No se puede deshacer.</b></p>
    <div class="items" style="text-align:left;max-height:160px;overflow:auto">${esc(m.pedido).replace(/\n/g,"<br>")}</div>
    <div class="ac-tot">Total a cobrar: ${b.dataset.total}</div>
    <label class="ac-chk"><input type="checkbox" id="ac-ok"> Confirmo que recibí el pago completo</label>
    <button id="ac-si" disabled>💵 Sí, cerrar la mesa</button><button id="ac-no">Cancelar, revisar de nuevo</button></div>`;
  document.body.appendChild(v); sonar();
  v.querySelector("#ac-ok").onchange=e=>{ v.querySelector("#ac-si").disabled=!e.target.checked; };
  v.querySelector("#ac-no").onclick=()=>v.remove();
  v.querySelector("#ac-si").onclick=()=>{
    const si=v.querySelector("#ac-si"); si.disabled=true; si.textContent="Cerrando…";
    api({accion:"cerrarmesa",rol:ROL,pin:PIN,mesa:m.mesa,mesero:MESERO}).then(r=>{ v.remove(); if(!r.ok) alert(r.error); else ABIERTA=""; cargar(); }).catch(()=>{ v.remove(); alert("Sin conexión"); cargar(); });
  };
}
// ===== PUNTO DE VENTA (caja): ticket por mesa con líneas, subtotal, descuentos, IVA, cobro y envío por correo o WhatsApp =====
let PRODUCTOS={}, IVA=16, IVA_INCLUIDO=true;
const PAGOS=["Pago móvil","Punto de venta","Transferencia","Zelle"];
const m2=n=>"$"+(Math.round(n*100)/100).toFixed(2);
const nNum=s=>parseFloat(String(s).replace(",","."))||0;
function cargarProductos(){
  fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=Productos&t=${Date.now()}`).then(r=>r.text()).then(t=>{
    PRODUCTOS={}; parseCSV(t.trim()).slice(1).forEach(r=>{ if(r[0]&&r[0].trim()) PRODUCTOS[r[0].trim()]=nNum(String(r[2]||"").replace(/[^\d.,]/g,"")); });
  }).catch(()=>{});
}
// Convierte los pedidos de la mesa ("2 x Quesillo") en líneas de ticket con precio unitario.
function lineasDe(items){
  const acc={}, orden=[];
  const precio=n=>{ const k=Object.keys(PRODUCTOS).find(x=>x.toLowerCase()==n.toLowerCase()); return k!=null?PRODUCTOS[k]:null; };
  items.forEach(it=>{
    const ls=String(it.p||"").split("\n").map(l=>l.trim()).filter(Boolean).map(l=>{ const m=l.match(/^(\d+(?:[.,]\d+)?)\s*x\s*(.+)$/i); return m?{q:nNum(m[1]),n:m[2].trim()}:{q:1,n:l}; });
    ls.forEach(l=>l.pu=precio(l.n));
    const conocido=ls.filter(l=>l.pu!=null).reduce((s,l)=>s+l.q*l.pu,0), sin=ls.filter(l=>l.pu==null), qs=sin.reduce((s,l)=>s+l.q,0);
    sin.forEach(l=>l.pu=qs?Math.max(0,(nNum(it.t)-conocido)/qs):0);
    ls.forEach(l=>{ const k=l.n+"|"+l.pu.toFixed(2); if(!acc[k]){acc[k]={n:l.n,q:0,pu:Math.round(l.pu*100)/100,d:0};orden.push(k);} acc[k].q+=l.q; });
  });
  return orden.map(k=>acc[k]);
}
function calcular(t){
  const ls=t.lineas.map(l=>Object.assign({},l,{imp:Math.round(l.q*l.pu*(1-l.d/100)*100)/100}));
  const sub=ls.reduce((s,l)=>s+l.imp,0), desc=Math.round(sub*(t.descG||0))/100, neto=sub-desc;
  const base=IVA_INCLUIDO?neto/(1+IVA/100):neto, iva=IVA_INCLUIDO?neto-base:neto*IVA/100;
  return {ls,sub,desc,base,iva,total:Math.round((base+iva)*100)/100};
}
function waNumero(t){ let d=String(t||"").replace(/\D/g,""); if(d.startsWith("0")) d="58"+d.slice(1); return d; }
function textoTicket(num,mesa,c,pago,pdf){
  return "🧾 Ticket "+num+" · Mesa "+mesa+"\n"+c.ls.map(l=>l.q+" x "+l.n+" "+m2(l.imp)).join("\n")+
    "\nSubtotal "+m2(c.sub)+(c.desc?"\nDescuento -"+m2(c.desc):"")+"\nIVA "+IVA+"% "+m2(c.iva)+"\n*TOTAL "+m2(c.total)+"*\nPago: "+pago+(pdf?"\n📄 "+pdf:"")+"\n¡Gracias por tu visita!";
}
function abrirPOS(mesa){
  const m=MESAS.find(x=>x.mesa==mesa); if(!m) return;
  if(m.pendientes>0){ alert("No se puede cerrar la Mesa "+mesa+": todavía tiene pedidos pendientes. Primero deben entregarse."); return; }
  const firma=JSON.stringify(m.items||[]), clave="pos_"+mesa;
  let t=null; try{ t=JSON.parse(localStorage.getItem(clave)||"null"); }catch(e){}
  if(!t||t.firma!=firma){ if(t) alert("Llegaron pedidos nuevos a la Mesa "+mesa+": el ticket se armó de nuevo."); t={firma,lineas:lineasDe(m.items||[]),descG:0,pago:"",correo:"",tel:"",cambios:[],motivo:""}; }
  const guardar=()=>{ try{localStorage.setItem(clave,JSON.stringify(t))}catch(e){} };
  const v=document.createElement("div"); v.className="alerta-cierre pos"; document.body.appendChild(v);
  const anota=x=>{ t.cambios.push(x); guardar(); };
  function pintar(){
    const c=calcular(t);
    v.innerHTML=`<div class="pos-caja"><div class="pos-top"><b>🧾 Ticket · Mesa ${esc(mesa)}</b><button data-x>✕</button></div>
    <table class="pos-t"><tr><th>Producto</th><th>Cant</th><th>P. unit</th><th>Importe</th><th></th></tr>
    ${c.ls.map((l,i)=>`<tr><td>${esc(l.n)}${l.d?`<br><small class="pos-d" data-d="${i}">Desc. ${l.d}%</small>`:""}</td>
      <td class="pos-q"><button data-m="${i}">−</button><b>${l.q}</b><button data-p="${i}">+</button></td>
      <td><button class="pos-ed" data-pu="${i}">${m2(l.pu)}</button></td><td class="r">${m2(l.imp)}</td>
      <td><button class="pos-ed" data-d="${i}" title="Descuento">%</button><button class="pos-del" data-del="${i}">🗑</button></td></tr>`).join("")||`<tr><td colspan="5" class="vacio">Sin productos</td></tr>`}</table>
    <div class="pos-add"><select id="pos-prod"><option value="">➕ Agregar producto…</option>${Object.keys(PRODUCTOS).map(n=>`<option>${esc(n)}</option>`).join("")}</select></div>
    <label class="pos-fila">Descuento general % <input id="pos-dg" type="number" min="0" max="100" value="${t.descG||0}"></label>
    <div class="pos-tot"><div><span>Subtotal</span><span>${m2(c.sub)}</span></div>${c.desc?`<div><span>Descuento ${t.descG}%</span><span>−${m2(c.desc)}</span></div>`:""}
      <div><span>Base imponible</span><span>${m2(c.base)}</span></div><div><span>IVA ${IVA}%${IVA_INCLUIDO?" (incluido)":""}</span><span>${m2(c.iva)}</span></div>
      <div class="pos-g"><span>TOTAL A PAGAR</span><span>${m2(c.total)}</span></div></div>
    ${t.cambios.length?`<div class="pos-cam"><b>Cambios en caja:</b><br>${t.cambios.map(esc).join("<br>")}<input id="pos-mot" placeholder="Motivo del cambio (obligatorio)" value="${esc(t.motivo||"")}"></div>`:""}
    <div class="pos-lbl">Forma de pago</div><div class="pos-pagos">${PAGOS.map(p=>`<button data-pago="${esc(p)}" class="${t.pago==p?"sel":""}">${esc(p)}</button>`).join("")}</div>
    <div class="pos-lbl">Enviar ticket al cliente (opcional)</div>
    <input id="pos-mail" type="email" placeholder="✉️ Correo del cliente" value="${esc(t.correo)}"><input id="pos-tel" inputmode="tel" placeholder="🟢 WhatsApp del cliente (ej: 04141234567)" value="${esc(t.tel)}">
    <label class="ac-chk"><input type="checkbox" id="pos-ok"> Confirmo que recibí el pago completo</label>
    <button id="pos-cobrar" class="pos-big" disabled>💵 Cobrar ${m2(c.total)} y cerrar mesa</button><button data-x class="pos-big gris">Cancelar</button></div>`;
    const q=s=>v.querySelector(s), linea=i=>t.lineas[i];
    v.querySelectorAll("[data-x]").forEach(b=>b.onclick=()=>v.remove());
    v.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>{ const l=linea(b.dataset.m); l.q=Math.max(0,l.q-1); anota("Quitó 1 x "+l.n); if(!l.q) t.lineas.splice(b.dataset.m,1); pintar(); });
    v.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{ const l=linea(b.dataset.p); l.q+=1; anota("Agregó 1 x "+l.n); pintar(); });
    v.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{ const l=linea(b.dataset.del); if(!confirm("¿Quitar "+l.q+" x "+l.n+" del ticket?")) return; anota("Eliminó "+l.q+" x "+l.n); t.lineas.splice(b.dataset.del,1); pintar(); });
    v.querySelectorAll("[data-pu]").forEach(b=>b.onclick=()=>{ const l=linea(b.dataset.pu), x=prompt("Precio unitario de "+l.n,l.pu); if(x==null) return; const n=Math.max(0,nNum(x)); if(n!=l.pu){ anota("Precio de "+l.n+": "+m2(l.pu)+" → "+m2(n)); l.pu=n; } pintar(); });
    v.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{ const l=linea(b.dataset.d), x=prompt("Descuento % para "+l.n,l.d); if(x==null) return; const n=Math.min(100,Math.max(0,nNum(x))); if(n!=l.d){ anota("Descuento "+n+"% en "+l.n); l.d=n; } pintar(); });
    q("#pos-prod").onchange=e=>{ const n=e.target.value; if(!n) return; const l=t.lineas.find(x=>x.n==n&&x.pu==PRODUCTOS[n]&&!x.d); if(l) l.q+=1; else t.lineas.push({n,q:1,pu:PRODUCTOS[n],d:0}); anota("Agregó 1 x "+n); pintar(); };
    q("#pos-dg").onchange=e=>{ const n=Math.min(100,Math.max(0,nNum(e.target.value))); if(n!=t.descG){ anota("Descuento general "+n+"%"); t.descG=n; } pintar(); };
    v.querySelectorAll("[data-pago]").forEach(b=>b.onclick=()=>{ t.pago=b.dataset.pago; guardar(); pintar(); });
    const leer=()=>{ t.correo=q("#pos-mail").value.trim(); t.tel=q("#pos-tel").value.trim(); if(q("#pos-mot")) t.motivo=q("#pos-mot").value.trim(); guardar(); };
    ["#pos-mail","#pos-tel","#pos-mot"].forEach(s=>{ const e=q(s); if(e) e.oninput=leer; });
    q("#pos-ok").onchange=e=>{ q("#pos-cobrar").disabled=!e.target.checked; };
    q("#pos-cobrar").onclick=()=>{
      leer();
      if(!t.lineas.length) return alert("El ticket no tiene productos.");
      if(!t.pago) return alert("Elige la forma de pago.");
      if(t.cambios.length&&!t.motivo) return alert("Escribe el motivo del cambio.");
      if(t.correo&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t.correo)) return alert("El correo no es válido.");
      const b=q("#pos-cobrar"); b.disabled=true; b.textContent="Cobrando…";
      const cambios=t.cambios.length?t.cambios.join("; ")+" · Motivo: "+t.motivo:"";
      api({accion:"cerrarmesa",rol:ROL,pin:PIN,mesa,mesero:MESERO,ticket:JSON.stringify({lineas:t.lineas,descG:t.descG,pago:t.pago,correo:t.correo,tel:t.tel,cambios})}).then(r=>{
        if(!r.ok){ alert(r.error); b.disabled=false; b.textContent="💵 Cobrar y cerrar mesa"; return; }
        localStorage.removeItem(clave); ABIERTA=""; cargar();
        listo(r, c);
      }).catch(()=>{ alert("Sin conexión. Revisa si la mesa se cerró antes de cobrar de nuevo."); v.remove(); cargar(); });
    };
  }
  function listo(r,c){
    const txt=textoTicket(r.ticket,mesa,c,t.pago,r.pdf), tel=waNumero(t.tel);
    v.innerHTML=`<div class="pos-caja" style="text-align:center"><div style="font-size:46px">✅</div><h3>Ticket ${esc(r.ticket)} · Mesa ${esc(mesa)}</h3>
      <div class="ac-tot">Cobrado: ${m2(r.total)} · ${esc(t.pago)}</div>
      ${r.correo?`<p>✉️ Enviado a ${esc(r.correo)}</p>`:""}
      ${r.pdf?`<a class="pos-big azul" target="_blank" rel="noopener" href="${esc(r.pdf)}">📄 Ver ticket PDF</a>`:""}
      <a class="pos-big wa" target="_blank" rel="noopener" href="https://wa.me/${tel}?text=${encodeURIComponent(txt)}">🟢 Enviar por WhatsApp${tel?"":" (elegir contacto)"}</a>
      <button data-x class="pos-big gris">Listo</button></div>`;
    v.querySelector("[data-x]").onclick=()=>v.remove();
  }
  pintar();
}
// Tickets de hoy: volver a ver, reenviar por correo o por WhatsApp.
function verTickets(){
  const v=document.createElement("div"); v.className="alerta-cierre pos"; document.body.appendChild(v);
  v.innerHTML=`<div class="pos-caja"><div class="pos-top"><b>🧾 Tickets de hoy</b><button data-x>✕</button></div><p>Cargando…</p></div>`;
  v.querySelector("[data-x]").onclick=()=>v.remove();
  api({accion:"tickets",pin:PIN}).then(r=>{
    if(!r.ok) return alert(r.error);
    const lista=r.tickets.map(o=>{ const pdf=String(o.PDF||"").split(" ")[0], tel=waNumero(o.WhatsApp);
      const txt="🧾 Ticket "+o.Ticket+" · Mesa "+o.Mesa+"\n"+String(o.Detalle).replace(/ @ [^=]+=/g,"")+"\n*TOTAL $"+o.Total+"*\nPago: "+o.Pago+(pdf?"\n📄 "+pdf:"")+"\n¡Gracias por tu visita!";
      return `<div class="card"><div class="top"><b>${esc(o.Ticket)} · Mesa ${esc(o.Mesa)}</b><span>${esc(o.Hora)} · ${esc(o.Cajero)}</span></div>
        <div class="items" style="font-size:.95rem">${esc(o.Detalle).replace(/\n/g,"<br>")}</div><div class="tot">Total: $${esc(o.Total)} · ${esc(o.Pago)}</div>
        ${o.Cambios?`<div class="nota">✏️ ${esc(o.Cambios)}</div>`:""}
        <div class="bts">${pdf?`<a class="pos-mini" target="_blank" rel="noopener" href="${esc(pdf)}">📄 PDF</a>`:""}
        <a class="pos-mini wa" target="_blank" rel="noopener" href="https://wa.me/${tel}?text=${encodeURIComponent(txt)}">🟢 WhatsApp</a>
        <button class="pos-mini" data-mail="${esc(o.Ticket)}" data-c="${esc(o.Correo)}">✉️ Correo</button></div></div>`; }).join("");
    v.querySelector(".pos-caja").innerHTML=`<div class="pos-top"><b>🧾 Tickets de hoy</b><button data-x>✕</button></div>${lista||`<p class="vacio">Todavía no hay tickets hoy.</p>`}`;
    v.querySelector("[data-x]").onclick=()=>v.remove();
    v.querySelectorAll("[data-mail]").forEach(b=>b.onclick=()=>{ const c=prompt("Correo del cliente",b.dataset.c||""); if(!c) return; b.textContent="Enviando…";
      api({accion:"reenviar",pin:PIN,ticket:b.dataset.mail,correo:c.trim()}).then(x=>{ b.textContent=x.ok?"✅ Enviado":"✉️ Correo"; if(!x.ok) alert(x.error); }).catch(()=>{ b.textContent="✉️ Correo"; alert("Sin conexión"); }); });
  }).catch(()=>alert("Sin conexión"));
}
(function(){ const st=document.createElement("style"); st.textContent=`
.pos{align-items:flex-start;overflow:auto}.pos-caja{background:#fff;color:#222;border-radius:18px;padding:16px;max-width:520px;width:100%;margin:auto}
.pos-top{display:flex;justify-content:space-between;align-items:center;font-size:1.15em;margin-bottom:10px}.pos-top button{background:#eee;border:0;border-radius:20px;padding:6px 12px;font:inherit}
.pos-t{width:100%;border-collapse:collapse;font-size:.92em}.pos-t th{text-align:left;font-size:.8em;color:#777;border-bottom:2px solid #ddd;padding:4px 2px}
.pos-t td{border-bottom:1px dashed #ddd;padding:6px 2px;vertical-align:middle}.pos-t .r{text-align:right;font-weight:700;white-space:nowrap}
.pos-q{white-space:nowrap}.pos-q button{width:28px;height:28px;border-radius:50%;border:1.5px solid #5a3825;background:#fff;color:#5a3825;font-weight:800}.pos-q b{display:inline-block;min-width:22px;text-align:center}
.pos-ed{background:#f3ece4;border:0;border-radius:8px;padding:5px 7px;font:inherit;font-size:.95em}.pos-del{background:none;border:0;font-size:1.1em}.pos-d{color:#c0392b}
.pos-add select,.pos-caja input[type=email],.pos-caja input[inputmode],.pos-cam input{width:100%;padding:10px;border:1.5px solid #ddd;border-radius:10px;font:inherit;margin-top:8px}
.pos-fila{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-weight:600}.pos-fila input{width:80px;padding:8px;border:1.5px solid #ddd;border-radius:10px;font:inherit;text-align:center}
.pos-tot{background:#faf5ef;border-radius:12px;padding:10px;margin-top:10px}.pos-tot div{display:flex;justify-content:space-between;padding:2px 0}
.pos-g{font-size:1.35em;font-weight:800;color:#5a3825;border-top:2px solid #5a3825;margin-top:6px;padding-top:6px!important}
.pos-cam{background:#fff1c9;border-radius:10px;padding:8px;margin-top:10px;font-size:.9em}
.pos-lbl{font-weight:700;margin-top:12px}.pos-pagos{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}
.pos-pagos button{padding:11px;border:2px solid #5a3825;background:#fff;color:#5a3825;border-radius:10px;font:inherit;font-weight:700}.pos-pagos button.sel{background:#5a3825;color:#fff}
.pos-big{display:block;width:100%;margin-top:8px;padding:14px;border:0;border-radius:12px;font:inherit;font-weight:800;color:#fff;background:#1e7a3c;text-align:center;text-decoration:none}
.pos-big:disabled{background:#9bbfa6}.pos-big.gris{background:#7a7a7a}.pos-big.wa{background:#25a244}.pos-big.azul{background:#1a5fa8}
.pos-mini{flex:1;min-width:90px;text-align:center;background:#5a3825;color:#fff;border:0;border-radius:10px;padding:10px;font:inherit;font-weight:700;text-decoration:none}.pos-mini.wa{background:#25a244}
.num-ped{background:#5a3825;color:#fff;border-radius:12px;padding:1px 8px;font-size:.8em;margin-left:4px}`; document.head.appendChild(st); })();

(function(){ const st=document.createElement("style"); st.textContent=`
#lista:has(.mesas-grid){display:block}
.mesas-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:14px}
.mesa-cuadro{display:flex;flex-direction:column;gap:4px;align-items:flex-start;text-align:left;background:#3a2a1e;color:#fff;border:3px solid #5a4330;border-radius:16px;padding:14px;font:inherit;cursor:pointer;min-height:100px}
.mesa-cuadro .mc-nom{font-size:1.3em;font-weight:800}.mesa-cuadro .mc-est{font-weight:700}.mesa-cuadro .mc-det{opacity:.85;font-size:.9em}
.mesa-celda{display:flex;flex-direction:column;gap:6px}.mesa-celda .mesa-cuadro{flex:1}
.mesa-cerrar{background:#1e7a3c;color:#fff;border:0;border-radius:12px;padding:10px;font:inherit;font-weight:700}
.mesa-bloq{background:#7a6a5a;font-size:.85em}
.mesa-alerta{background:#c0392b;border-color:#ff6b5b;animation:mesaLuz 1s ease-in-out infinite}
.mesa-abierta{outline:4px solid #f0b93a;outline-offset:2px}
@keyframes mesaLuz{0%,100%{background:#c0392b;box-shadow:0 0 0 0 rgba(231,76,60,.7)}50%{background:#e74c3c;box-shadow:0 0 18px 4px rgba(231,76,60,.8)}}
.mesa-detalle{background:#3a2a1e;border-radius:16px;padding:12px}
.md-top{display:flex;justify-content:space-between;align-items:center;color:#fff;font-size:1.2em;margin-bottom:10px}
.md-cerrar{background:#5a4330;color:#fff;border:0;border-radius:20px;padding:8px 14px;font:inherit;font-size:.8em}
.alerta-cierre{position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}
.ac-caja{background:#fff;color:#222;border-radius:18px;padding:20px;max-width:380px;width:100%;text-align:center;border:4px solid #e67e22}
.ac-caja h3{margin:6px 0 10px}.ac-caja p{line-height:1.45}.ac-tot{font-size:1.3em;font-weight:800;margin:10px 0}
.ac-chk{display:flex;gap:8px;align-items:center;justify-content:center;margin:10px 0;font-weight:700}.ac-chk input{width:22px;height:22px}
.ac-caja button{display:block;width:100%;margin-top:8px;padding:14px;border:0;border-radius:12px;font:inherit;font-weight:700;color:#fff;background:#1e7a3c}
.ac-caja button:disabled{background:#9bbfa6}.ac-caja #ac-no{background:#7a7a7a}
.tl{font-size:.85em;line-height:1.5;margin-top:6px;padding:6px 8px;background:rgba(0,0,0,.06);border-radius:8px}
.tl-tarde{color:#c0392b;font-weight:700}.tl-esp{opacity:.9}
@media (prefers-reduced-motion:reduce){.mesa-alerta{animation:none}}`; document.head.appendChild(st); })();

function cargar(){
  if(ocupado) return; ocupado=true;
  api({accion:"lista",rol:ROL,pin:PIN}).then(r=>{
    if(!r.ok){ if(r.error=="PIN"){ localStorage.removeItem("pin_"+ROL); PIN=""; pedirPin("PIN incorrecto"); } else $("estado").textContent="⚠️ "+r.error; return; }
    $("estado").textContent="🟢 Conectado · "+new Date().toLocaleTimeString("es-VE",{hour:"2-digit",minute:"2-digit"});
    MESAS = r.mesas || [];
    const ps = filtrar(r.pedidos.map(o=>Object.assign(o,{Telefono:o["Teléfono"]})));
    const claves = ps.filter(importante).map(o=>o.ID+o.Estado);
    if(vistos && claves.some(k=>!vistos.has(k))) sonar();
    vistos = new Set(claves);
    const escribiendo = document.activeElement && document.activeElement.tagName=="TEXTAREA";
    if(!escribiendo) $("lista").innerHTML = (ps.length||(ROL=="caja"&&MESAS.length)) ? (ROL!="repartidor" ? porMesa(ps.reverse()) : ps.reverse().map(tarjeta).join("")) : `<p class="vacio">Sin pedidos por ahora. Esta pantalla se actualiza sola.</p>`;
    $("lista").querySelectorAll("button[data-id]").forEach(b=>b.onclick=()=>cambiar(b));
    if(ROL!="repartidor") activarMesas();
    activarCierre();
    if(ROL=="caja") $("ventas").textContent = "Hoy: "+r.pedidosHoy+" pedidos · $"+Number(r.ventasHoy).toFixed(2)+"  |  Semana: $"+Number(r.ventasSemana).toFixed(2);
  }).catch(()=>{$("estado").textContent="🔴 Sin conexión, reintentando…"}).finally(()=>{ocupado=false});
}
function cambiar(b){
  b.disabled=true; b.textContent="Enviando…";
  const m=document.getElementById("msg-"+b.dataset.id);
  api({accion:"cambiar",rol:ROL,pin:PIN,id:b.dataset.id,nuevo:b.dataset.n,mesero:MESERO,msg:m?m.value.trim():""}).then(r=>{ if(!r.ok) alert(r.error); cargar(); }).catch(()=>{alert("Sin conexión");cargar()});
}

function pedirPin(msg){
  $("login").style.display="flex"; $("login-msg").textContent=msg||"";
  $("mesero-nombre").style.display = CON_NOMBRE ? "block" : "none";
  $("mesero-nombre").value = MESERO;
}
$("entrar").onclick=()=>{
  const p=$("pin").value.trim(); if(!p) return;
  if(CON_NOMBRE){ const n=$("mesero-nombre").value.trim(); if(!n){ $("login-msg").textContent="Escribe tu nombre"; return; } MESERO=n; localStorage.setItem(CLAVE_NOMBRE,n); }
  PIN=p; localStorage.setItem("pin_"+ROL,p); $("login").style.display="none"; sonar(); vistos=null; cargar();
};
$("salir").onclick=()=>{ localStorage.removeItem("pin_"+ROL); PIN=""; pedirPin(); };
if($("tickets")) $("tickets").onclick=()=>verTickets();
if($("cerrar")) $("cerrar").onclick=()=>{
  if(!confirm("¿Cerrar la semana? Se guarda el total en «Ventas semanales», los pedidos pasan a «Historial» y la bandeja queda limpia.")) return;
  api({accion:"cerrar",pin:PIN}).then(r=>{ alert(r.ok?"Semana cerrada: "+r.pedidos+" pedidos, $"+Number(r.total).toFixed(2):r.error); cargar(); });
};
$("activar").onclick=()=>{ $("activar").closest(".capa").style.display="none"; sonar(); iniciarGPS(); if(!PIN) pedirPin(); else cargar(); };

document.title = NOMBRES[ROL]+" · Pedidos";
$("rol").textContent = NOMBRES[ROL] + (CON_NOMBRE&&MESERO?" · "+MESERO:"");
fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=Config&t=${Date.now()}`).then(r=>r.text()).then(t=>{
  for(const r of parseCSV(t.trim()).slice(1)){ const k=(r[0]||"").trim().toLowerCase();
    if(k=="url del sistema") API=(r[1]||"").trim();
    if(k=="minutos de alerta" && parseInt(r[1],10)>0) LIMITE=parseInt(r[1],10);
    if(k=="iva %" && String(r[1]).trim()!=="" && !isNaN(parseFloat(r[1]))) IVA=parseFloat(r[1]);
    if(k=="precios incluyen iva") IVA_INCLUIDO=!/^n/i.test(String(r[1]).trim()); }
  if(ROL=="caja") cargarProductos();
  if(!/^https:\/\/script\.google\.com\//.test(API)){ $("estado").textContent="⚠️ Falta la «URL del sistema» en la pestaña Config de la hoja."; return; }
  setInterval(()=>{ if(PIN && $("login").style.display!="flex") cargar(); }, 5000);
}).catch(()=>{$("estado").textContent="⚠️ No se pudo leer la hoja."});
})();
