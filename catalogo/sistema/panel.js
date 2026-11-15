// Pantallas de caja, cocina, mesero y repartidor. Cada HTML define window.ROL antes de cargar este archivo.
(function(){
const SHEET_ID = "1SkaZA4m6t6Ti7DRR4B7VbWyf49taEUTc_TKh-xkxX4Y";
const ROL = window.ROL;
const NOMBRES = {caja:"Caja", cocina:"Cocina", mesero:"Mesero", repartidor:"Repartidor"};
const CON_NOMBRE = ROL=="mesero"||ROL=="repartidor";
const CLAVE_NOMBRE = ROL=="mesero" ? "mesero_nombre" : "repartidor_nombre";
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
  else if(o.Tipo=="cuenta"){ titulo="🧾 "+lugar+" pide la cuenta"; clase="alerta"; botones= ROL=="caja" ? `<button data-id="${o.ID}" data-n="atendido">✓ Cobrada</button>` : ""; }
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
    ${o.Tipo=="pedido"?`<div class="items">${items}</div>`:""}${nota?`<div class="nota">📝 ${esc(nota)}</div>`:""}${extra}${precio}
    <div class="est">Estado: ${esc(o.Estado)}</div><div class="bts">${botones}</div></div>`;
}

function filtrar(ps){
  if(ROL=="caja") return ps.filter(o=>(o.Tipo=="pedido")||o.Tipo=="cuenta");
  if(ROL=="cocina") return ps.filter(o=>o.Tipo=="pedido"&&o.Estado=="en cocina");
  if(ROL=="repartidor") return ps.filter(o=>o.Tipo=="pedido"&&!o.Mesa&&(o.Estado=="listo"||(o.Estado=="en camino"&&o.Mesero==MESERO)));
  return ps.filter(o=>o.Mesa&&((o.Tipo=="pedido"&&o.Estado=="listo")||o.Tipo=="mesonero"||o.Tipo=="cuenta"));
}
function importante(o){
  if(ROL=="caja") return (o.Tipo=="pedido"&&o.Estado=="nuevo")||o.Tipo=="cuenta";
  if(ROL=="cocina") return o.Estado=="en cocina";
  if(ROL=="repartidor") return o.Estado=="listo";
  return o.Estado=="listo"||o.Tipo=="mesonero"||o.Tipo=="cuenta";
}

function cargar(){
  if(ocupado) return; ocupado=true;
  api({accion:"lista",rol:ROL,pin:PIN}).then(r=>{
    if(!r.ok){ if(r.error=="PIN"){ localStorage.removeItem("pin_"+ROL); PIN=""; pedirPin("PIN incorrecto"); } else $("estado").textContent="⚠️ "+r.error; return; }
    $("estado").textContent="🟢 Conectado · "+new Date().toLocaleTimeString("es-VE",{hour:"2-digit",minute:"2-digit"});
    const ps = filtrar(r.pedidos.map(o=>Object.assign(o,{Telefono:o["Teléfono"]})));
    const claves = ps.filter(importante).map(o=>o.ID+o.Estado);
    if(vistos && claves.some(k=>!vistos.has(k))) sonar();
    vistos = new Set(claves);
    $("lista").innerHTML = ps.length ? ps.reverse().map(tarjeta).join("") : `<p class="vacio">Sin pedidos por ahora. Esta pantalla se actualiza sola.</p>`;
    $("lista").querySelectorAll("button[data-id]").forEach(b=>b.onclick=()=>cambiar(b));
    if(ROL=="caja") $("ventas").textContent = "Hoy: "+r.pedidosHoy+" pedidos · $"+Number(r.ventasHoy).toFixed(2)+"  |  Semana: $"+Number(r.ventasSemana).toFixed(2);
  }).catch(()=>{$("estado").textContent="🔴 Sin conexión, reintentando…"}).finally(()=>{ocupado=false});
}
function cambiar(b){
  b.disabled=true; b.textContent="Enviando…";
  api({accion:"cambiar",rol:ROL,pin:PIN,id:b.dataset.id,nuevo:b.dataset.n,mesero:MESERO}).then(r=>{ if(!r.ok) alert(r.error); cargar(); }).catch(()=>{alert("Sin conexión");cargar()});
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
  for(const r of parseCSV(t.trim()).slice(1)) if((r[0]||"").trim().toLowerCase()=="url del sistema") API=(r[1]||"").trim();
  if(!/^https:\/\/script\.google\.com\//.test(API)){ $("estado").textContent="⚠️ Falta la «URL del sistema» en la pestaña Config de la hoja."; return; }
  setInterval(()=>{ if(PIN && $("login").style.display!="flex") cargar(); }, 5000);
}).catch(()=>{$("estado").textContent="⚠️ No se pudo leer la hoja."});
})();
