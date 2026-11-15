// Pantallas de caja, cocina y mesero. Cada HTML define window.ROL antes de cargar este archivo.
(function(){
const SHEET_ID = "1SkaZA4m6t6Ti7DRR4B7VbWyf49taEUTc_TKh-xkxX4Y";
const ROL = window.ROL;
const NOMBRES = {caja:"Caja", cocina:"Cocina", mesero:"Mesero"};
const $ = id => document.getElementById(id);
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let API = "", PIN = localStorage.getItem("pin_"+ROL) || "", MESERO = localStorage.getItem("mesero_nombre") || "";
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

function tarjeta(o){
  let botones="", clase="", titulo="";
  const items = esc(o.Pedido).replace(/\n/g,"<br>");
  const lugar = o.Mesa ? "Mesa "+esc(o.Mesa) : "Delivery · "+esc(o.Cliente);
  if(o.Tipo=="mesonero"){ titulo="🙋 "+lugar+" llama al mesero"; clase="alerta"; botones=`<button data-id="${o.ID}" data-n="atendido">✓ Ya voy</button>`; }
  else if(o.Tipo=="cuenta"){ titulo="🧾 "+lugar+" pide la cuenta"; clase="alerta"; botones= ROL=="caja" ? `<button data-id="${o.ID}" data-n="atendido">✓ Cobrada</button>` : ""; }
  else {
    titulo="🍽️ "+lugar;
    if(ROL=="caja" && o.Estado=="nuevo") botones=`<button data-id="${o.ID}" data-n="en cocina">✓ Confirmar y enviar a cocina</button><button class="no" data-id="${o.ID}" data-n="rechazado">✕ Rechazar</button>`;
    if(ROL=="cocina" && o.Estado=="en cocina") botones=`<button data-id="${o.ID}" data-n="listo">✓ Listo para servir</button>`;
    if(ROL=="mesero" && o.Estado=="listo"){ clase="alerta"; titulo="✅ "+lugar+" · listo para llevar"; botones=`<button data-id="${o.ID}" data-n="entregado">✓ Entregado</button>`; }
  }
  const precio = ROL=="caja" && o.Tipo=="pedido" ? `<div class="tot">Total: $${esc(o.Total)}</div>` : "";
  const extra = ROL=="caja" && o.Telefono ? `<div class="sub">📞 ${esc(o.Telefono)}</div>` : "";
  return `<div class="card ${clase}"><div class="top"><b>${titulo}</b><span>${esc(o.Hora)} · ${mins(o.Hora)}</span></div>
    ${o.Tipo=="pedido"?`<div class="items">${items}</div>`:""}${o.Nota?`<div class="nota">📝 ${esc(o.Nota)}</div>`:""}${extra}${precio}
    <div class="est">Estado: ${esc(o.Estado)}</div><div class="bts">${botones}</div></div>`;
}

function filtrar(ps){
  if(ROL=="caja") return ps.filter(o=>(o.Tipo=="pedido")||o.Tipo=="cuenta");
  if(ROL=="cocina") return ps.filter(o=>o.Tipo=="pedido"&&o.Estado=="en cocina");
  return ps.filter(o=>(o.Tipo=="pedido"&&o.Estado=="listo")||o.Tipo=="mesonero"||o.Tipo=="cuenta");
}
function importante(o){
  if(ROL=="caja") return (o.Tipo=="pedido"&&o.Estado=="nuevo")||o.Tipo=="cuenta";
  if(ROL=="cocina") return o.Estado=="en cocina";
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
  $("mesero-nombre").style.display = ROL=="mesero" ? "block" : "none";
  $("mesero-nombre").value = MESERO;
}
$("entrar").onclick=()=>{
  const p=$("pin").value.trim(); if(!p) return;
  if(ROL=="mesero"){ const n=$("mesero-nombre").value.trim(); if(!n){ $("login-msg").textContent="Escribe tu nombre"; return; } MESERO=n; localStorage.setItem("mesero_nombre",n); }
  PIN=p; localStorage.setItem("pin_"+ROL,p); $("login").style.display="none"; sonar(); vistos=null; cargar();
};
$("salir").onclick=()=>{ localStorage.removeItem("pin_"+ROL); PIN=""; pedirPin(); };
if($("cerrar")) $("cerrar").onclick=()=>{
  if(!confirm("¿Cerrar la semana? Se guarda el total en «Ventas semanales», los pedidos pasan a «Historial» y la bandeja queda limpia.")) return;
  api({accion:"cerrar",pin:PIN}).then(r=>{ alert(r.ok?"Semana cerrada: "+r.pedidos+" pedidos, $"+Number(r.total).toFixed(2):r.error); cargar(); });
};
$("activar").onclick=()=>{ $("activar").closest(".capa").style.display="none"; sonar(); if(!PIN) pedirPin(); else cargar(); };

document.title = NOMBRES[ROL]+" · Pedidos";
$("rol").textContent = NOMBRES[ROL] + (ROL=="mesero"&&MESERO?" · "+MESERO:"");
fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=Config&t=${Date.now()}`).then(r=>r.text()).then(t=>{
  for(const r of parseCSV(t.trim()).slice(1)) if((r[0]||"").trim().toLowerCase()=="url del sistema") API=(r[1]||"").trim();
  if(!/^https:\/\/script\.google\.com\//.test(API)){ $("estado").textContent="⚠️ Falta la «URL del sistema» en la pestaña Config de la hoja."; return; }
  setInterval(()=>{ if(PIN && $("login").style.display!="flex") cargar(); }, 5000);
}).catch(()=>{$("estado").textContent="⚠️ No se pudo leer la hoja."});
})();
