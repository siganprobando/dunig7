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
  const lugar = o.Mesa ? "Mesa "+esc(o.Mesa) : (ROL=="cocina" ? "🛵 Para delivery" : "Delivery · "+esc(o.Cliente));
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
  return `<div class="card ${clase}"><div class="top"><b>${titulo}</b><span>${esc(o.Hora)} · ${mins(o.Hora)}</span></div>
    ${o.Tipo=="pedido"?`<div class="items">${items}</div>`:""}${nota?`<div class="nota">📝 ${esc(nota)}</div>`:""}${extra}${precio}${linea(o)}
    <div class="est">Estado: ${esc(o.Estado)}</div><div class="bts">${botones}</div></div>`;
}

function filtrar(ps){
  if(ROL=="caja") return ps.filter(o=>o.Tipo=="pedido");
  if(ROL=="cocina") return ps.filter(o=>o.Tipo=="pedido"&&o.Estado=="en cocina");
  if(ROL=="repartidor") return ps.filter(o=>o.Tipo=="pedido"&&!o.Mesa&&(o.Estado=="listo"||(o.Estado=="en camino"&&o.Mesero==MESERO)));
  return ps.filter(o=>o.Mesa&&((o.Tipo=="pedido"&&o.Estado=="listo")||o.Tipo=="mesonero"||o.Tipo=="cuenta"));
}
function importante(o){
  if(ROL=="caja") return o.Tipo=="pedido"&&o.Estado=="nuevo";
  if(ROL=="cocina") return o.Estado=="en cocina";
  if(ROL=="repartidor") return o.Estado=="listo";
  return o.Estado=="listo"||o.Tipo=="mesonero"||o.Tipo=="cuenta";
}

let ABIERTA="", ULTIMOS=[], MESAS=[];
function porMesa(ps){                       // caja: un cuadro por mesa; al tocarlo se abre y muestra sus pedidos
  ULTIMOS=ps; const g={}, orden=[];
  ps.forEach(o=>{ const k=o.Mesa?"Mesa "+o.Mesa:"🛵 Delivery"; if(!g[k]){g[k]=[];orden.push(k);} g[k].push(o); });
  const cons={}; if(ROL=="caja") MESAS.forEach(m=>{ const k="Mesa "+m.mesa; cons[k]=m; if(!g[k]){g[k]=[];orden.push(k);} });
  orden.sort((a,b)=>a.startsWith("🛵")-b.startsWith("🛵")||a.localeCompare(b,"es",{numeric:true}));
  if(ABIERTA && !g[ABIERTA]) ABIERTA="";
  const fmt=n=>"$"+n.toFixed(2).replace(/\.00$/,"");
  const cuadros=orden.map(k=>{
    const l=g[k], tot=l.reduce((s,o)=>s+(o.Tipo=="pedido"?parseFloat(String(o.Total).replace(",","."))||0:0),0);
    const nuevos=l.filter(importante).length, abierta=k==ABIERTA;
    return `<div class="mesa-celda"><button class="mesa-cuadro ${nuevos?"mesa-alerta":""} ${abierta?"mesa-abierta":""}" data-mesa="${esc(k)}">
      <span class="mc-nom">${esc(k)}</span>
      <span class="mc-est">${nuevos?`🔴 ${nuevos} ${ROL=="cocina"?"por preparar":"nuevo"+(nuevos>1?"s":"")}`:"✓ Al día"}</span>
      ${cons[k]?`<span class="mc-det">🧾 Consumo abierto: ${fmt(Number(cons[k].total))}</span>`:""}
      <span class="mc-det">${l.length} ${ROL=="mesero"?(l.length>1?"avisos":"aviso"):(l.length>1?"pedidos":"pedido")}${ROL=="caja"?" · "+fmt(tot):""}</span></button>${cons[k]?`<button class="mesa-cerrar" data-cerrar="${esc(cons[k].mesa)}" data-total="${fmt(Number(cons[k].total))}">💵 Cerrar mesa · ${fmt(Number(cons[k].total))}</button>`:""}</div>`;
  }).join("");
  const det = ABIERTA ? `<section class="mesa-detalle"><div class="md-top"><b>${esc(ABIERTA)}</b><button class="md-cerrar" data-mesa="${esc(ABIERTA)}">✕ Cerrar</button></div>
      ${cons[ABIERTA]?`<div class="card"><b>🧾 Consumo de la ${esc(ABIERTA)} (${cons[ABIERTA].n} ${cons[ABIERTA].n>1?"pedidos":"pedido"})</b>
        <div class="items">${esc(cons[ABIERTA].pedido).replace(/\n/g,"<br>")}</div><div class="tot">Total a cobrar: ${fmt(Number(cons[ABIERTA].total))}</div>
        <div class="sub">Para cobrar, usa el botón «💵 Cerrar mesa» debajo del cuadro de la mesa.</div></div>`:""}
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
}
// Ventana de alerta antes de cerrar: la cajera revisa el consumo y confirma que el cliente pagó todo.
function confirmarCierre(b){
  const m=MESAS.find(x=>x.mesa==b.dataset.cerrar); if(!m) return;
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
(function(){ const st=document.createElement("style"); st.textContent=`
#lista:has(.mesas-grid){display:block}
.mesas-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:14px}
.mesa-cuadro{display:flex;flex-direction:column;gap:4px;align-items:flex-start;text-align:left;background:#3a2a1e;color:#fff;border:3px solid #5a4330;border-radius:16px;padding:14px;font:inherit;cursor:pointer;min-height:100px}
.mesa-cuadro .mc-nom{font-size:1.3em;font-weight:800}.mesa-cuadro .mc-est{font-weight:700}.mesa-cuadro .mc-det{opacity:.85;font-size:.9em}
.mesa-celda{display:flex;flex-direction:column;gap:6px}.mesa-celda .mesa-cuadro{flex:1}
.mesa-cerrar{background:#1e7a3c;color:#fff;border:0;border-radius:12px;padding:10px;font:inherit;font-weight:700}
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
    if(k=="minutos de alerta" && parseInt(r[1],10)>0) LIMITE=parseInt(r[1],10); }
  if(!/^https:\/\/script\.google\.com\//.test(API)){ $("estado").textContent="⚠️ Falta la «URL del sistema» en la pestaña Config de la hoja."; return; }
  setInterval(()=>{ if(PIN && $("login").style.display!="flex") cargar(); }, 5000);
}).catch(()=>{$("estado").textContent="⚠️ No se pudo leer la hoja."});
})();
