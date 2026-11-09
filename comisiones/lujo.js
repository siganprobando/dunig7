/* Tienda de lujo · gomitas artesanales. Configura TIENDA en cada página. */
// Todas las compras se hacen por mensaje directo (DM) de Instagram (respuesta automática con ManyChat).
const TIKTOK = 'https://www.tiktok.com/@sigan.probando';
const IG_DM = 'https://ig.me/m/sigan.probando'; // abre el chat de Instagram directo

const $ = s => document.querySelector(s);
const money = n => '$' + Number(n).toFixed(2).replace('.', ',').replace(',00', '');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY = 'lujo_cart_' + TIENDA.id;
let cart = JSON.parse(sessionStorage.getItem(KEY) || '{}');
const QS = new URLSearchParams(location.search);
const refQ = QS.get('ref');
if (refQ) localStorage.setItem('lujo_ref', refQ.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12));
const REF = localStorage.getItem('lujo_ref') || '';
const save = () => sessionStorage.setItem(KEY, JSON.stringify(cart));

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2600); }

function pintar() {
  $('#prods').innerHTML = TIENDA.productos.map(p => `<div class="pc reveal">
    ${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ''}
    <div class="ph" data-id="${p.id}"><img src="${p.img}" alt="${esc(p.n)}" loading="lazy"></div>
    <div class="bd"><h3>${esc(p.n)}</h3><small>${esc(p.d)}</small>
    <div class="pr gtxt">${money(p.p)}</div>${p.extra ? `<small class="gana">${esc(p.extra)}</small>` : ''}
    ${cart[p.id] ? `<div class="qty"><button onclick="q('${p.id}',-1)">−</button><b>${cart[p.id]}</b><button onclick="q('${p.id}',1)">+</button></div>`
      : `<button class="btn sm full" onclick="q('${p.id}',1)">Agregar</button>`}</div></div>`).join('');
  const c = Object.values(cart).reduce((a, b) => a + b, 0);
  $('#cCart').textContent = c || '';
  observar();
}
function q(id, d) {
  cart[id] = Math.max(0, Math.min(99, (cart[id] || 0) + d)); if (!cart[id]) delete cart[id];
  save(); pintar();
  if (d > 0) { const f = $('#fCart'); f.classList.remove('ring'); void f.offsetWidth; f.classList.add('ring'); }
  if ($('#dCart').classList.contains('open')) abrirCarrito();
}
const items = () => Object.entries(cart).map(([id, n]) => { const p = TIENDA.productos.find(x => x.id === id); return p ? { ...p, q: n } : null; }).filter(Boolean);
function abrirCarrito() {
  const it = items(), tot = it.reduce((s, i) => s + i.p * i.q, 0);
  $('#cartBody').innerHTML = it.length ? it.map(i => `<div class="li"><img src="${i.img}" alt=""><div><b>${esc(i.n)}</b><br><span class="mut">${i.q} × ${money(i.p)}</span></div>
    <div class="qty" style="flex:0 0 auto;gap:6px"><button onclick="q('${i.id}',-1)">−</button><b>${i.q}</b><button onclick="q('${i.id}',1)">+</button></div></div>`).join('') +
    `<div class="tot"><span>Total</span><span class="gtxt">${money(tot)}</span></div>
    <label>Nombre</label><input id="cN" maxlength="60" placeholder="Tu nombre" value="${esc(localStorage.getItem('lujo_nom') || '')}">
    <label>Sector o dirección</label><input id="cD" maxlength="160" placeholder="Sector, calle, referencia" value="${esc(localStorage.getItem('lujo_dir') || '')}">
    <label>Código del vendedor (opcional)</label><input id="cR" maxlength="12" placeholder="Ej. ANA01" value="${esc(REF)}" style="text-transform:uppercase">
    <button class="btn full" onclick="pedir()">Pedir por Instagram · ${money(tot)}</button>
    <p class="mut" style="margin-top:10px;text-align:center">Se copia tu pedido y se abre mi chat de Instagram: solo pega y envía.</p>`
    : '<p class="mut" style="text-align:center;padding:40px 0">Tu carrito está vacío 🍬</p>';
  $('#dCart').classList.add('open');
}
function cerrar() { document.querySelectorAll('.drawer').forEach(d => d.classList.remove('open')); }
async function pedir() {
  const nom = $('#cN').value.trim(), dir = $('#cD').value.trim(), ref = $('#cR').value.trim().toUpperCase();
  if (!nom || !dir) return toast('Escribe tu nombre y sector');
  localStorage.setItem('lujo_nom', nom); localStorage.setItem('lujo_dir', dir);
  const it = items(), tot = it.reduce((s, i) => s + i.p * i.q, 0);
  const txt = `Hola David, quiero hacer un pedido (${TIENDA.tipo}):\n` + it.map(i => `• ${i.q} × ${i.n} (${money(i.p)})`).join('\n') +
    `\nTotal: ${money(tot)}\nNombre: ${nom}\nSector: ${dir}` + (ref ? `\nVendedor: ${ref}` : '');
  try { await navigator.clipboard.writeText(txt); toast('¡Pedido copiado! Pégalo en mi chat de Instagram 🎉'); } catch (e) { prompt('Copia tu pedido:', txt); }
  setTimeout(() => { location.href = IG_DM; }, 900);
}

/* efectos */
function observar() {
  const io = window._io || (window._io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }), { threshold: .12 }));
  document.querySelectorAll('.reveal:not(.on)').forEach(el => io.observe(el));
}
function marquee() {
  const ims = TIENDA.productos.map(p => `<img src="${p.img}" alt="${esc(p.n)}" data-id="${p.id}" loading="lazy">`).join('');
  $('#mq').innerHTML = ims + ims + ims + ims;
}
function chispas() {
  const c = $('#sparks'); if (!c) return; const x = c.getContext('2d'); let W, H, ps = [];
  const rs = () => { W = c.width = c.offsetWidth; H = c.height = c.offsetHeight; }; rs(); addEventListener('resize', rs);
  for (let i = 0; i < 60; i++) ps.push({ x: Math.random(), y: Math.random(), r: Math.random() * 2 + .5, v: Math.random() * .0015 + .0005, a: Math.random() * 6 });
  (function f() { x.clearRect(0, 0, W, H); ps.forEach(p => { p.y -= p.v; p.a += .03; if (p.y < 0) { p.y = 1; p.x = Math.random(); }
    x.globalAlpha = .4 + Math.sin(p.a) * .4; x.fillStyle = '#ffd23f'; x.shadowColor = '#ffd23f'; x.shadowBlur = 8;
    x.beginPath(); x.arc(p.x * W, p.y * H, p.r, 0, 7); x.fill(); }); requestAnimationFrame(f); })();
}
addEventListener('scroll', () => $('#nav').classList.toggle('solid', scrollY > 40));
document.addEventListener('DOMContentLoaded', () => {
  if (REF && $('#refTxt')) $('#refTxt').textContent = 'Te atiende el vendedor ' + REF + ' · toca “Agregar”';
  marquee(); pintar(); chispas(); observar();
});

/* ===== Ventana de detalle: sabores y modelos ===== */
const BASE = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/lujo\.js.*$/, '') : '../';
const SABORES = {
  fresa:   { n: 'Fresa',   e: '🍓', img: 'sabores/fresa.jpg',   fruta: 'Fresa', d: 'Dulce y jugosa, con ese toque ácido de la fresa madura. El sabor favorito de los niños, de color rojo intenso.' },
  limon:   { n: 'Limón',   e: '🍋', img: 'sabores/limon.jpg',   fruta: 'Limón', d: 'Ácido y refrescante, perfecto para el calor. Un dulce con chispa que despierta el paladar.' },
  mora:    { n: 'Mora',    e: '🫐', img: 'sabores/mora.jpg',    fruta: 'Mora',  d: 'Intensa y profunda, con el sabor de la mora andina. Color morado oscuro, dulce y un poquito ácida.' },
  naranja: { n: 'Naranja', e: '🍊', img: 'sabores/naranja.jpg', fruta: 'Naranja', d: 'Cítrica y alegre, como un jugo recién exprimido. Suave, dulce y muy aromática.' },
  menta:   { n: 'Menta',   e: '🌿', img: 'sabores/menta.jpg',   fruta: 'Hierbabuena', d: 'Fresca y ligera, con hojitas de menta. Ideal después de comer o para quien prefiere un dulce suave.' }
};
const fichaBase = '<li>🌿 Gelatina vegetal (agar), sin gelatina animal</li><li>✋ Receta artesanal Sigan Probando</li><li>🧤 Hechas a mano, con guantes</li>';
(function () {
  const st = document.createElement('style');
  st.textContent = `.mdl{position:fixed;inset:0;z-index:70;display:none;align-items:flex-end;justify-content:center}.mdl.open{display:flex}
  .mdl .ov{position:absolute;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(6px)}
  .mdl .bx{position:relative;width:min(520px,100%);max-height:92vh;overflow-y:auto;background:var(--bg2);border:1px solid var(--line);border-radius:26px 26px 0 0;animation:up .35s ease}
  @media(min-width:700px){.mdl{align-items:center}.mdl .bx{border-radius:26px}}
  @keyframes up{from{transform:translateY(100%)}}
  .mdl .im{aspect-ratio:4/5;max-height:62vh;width:100%;overflow:hidden;position:relative}.mdl .im img{width:100%;height:100%;object-fit:cover;animation:zoomin 8s ease-out forwards}
  @keyframes zoomin{from{transform:scale(1.12)}to{transform:scale(1)}}
  .mdl .im::after{content:'';position:absolute;inset:auto 0 0 0;height:30%;background:linear-gradient(transparent,var(--bg2))}
  .mdl .x{position:absolute;top:12px;right:12px;z-index:3;background:rgba(0,0,0,.55)}
  .mdl .ct3{padding:6px 22px 24px}.mdl h3{font-size:26px;font-weight:800;margin-bottom:4px}
  .mdl .sub{color:var(--g2);font-weight:600;font-size:14px;margin-bottom:10px}
  .mdl p{color:#ddd;font-size:15px;line-height:1.55;margin-bottom:12px}
  .mdl h4{font-size:13px;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin:14px 0 8px}
  .mdl ul{list-style:none;display:flex;flex-direction:column;gap:6px;font-size:14px}
  .mdl .chips{justify-content:flex-start}.mdl .chip{font-size:13px;padding:7px 13px}
  .marquee img,.chip[data-s],.pc .ph{cursor:pointer}`;
  document.head.appendChild(st);
  const m = document.createElement('div'); m.className = 'mdl'; m.id = 'mdl';
  m.innerHTML = '<div class="ov" onclick="cerrarDet()"></div><div class="bx"><button class="x" onclick="cerrarDet()">✕</button><div class="im"><img id="mImg" alt=""></div><div class="ct3" id="mTxt"></div></div>';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(m));
})();
function abrirDet(img, html) { $('#mImg').src = img; $('#mTxt').innerHTML = html; $('#mdl').classList.add('open'); }
function cerrarDet() { $('#mdl').classList.remove('open'); }
addEventListener('keydown', e => { if (e.key === 'Escape') { cerrarDet(); cerrar(); } });
function verSabor(k) {
  const s = SABORES[k]; if (!s) return;
  abrirDet(BASE + s.img, `<h3>${s.e} ${s.n}</h3><div class="sub">Fruta: ${s.fruta} · bolsita de 80 g · 10 gomitas</div><p>${s.d}</p>
  <h4>Características</h4><ul>${fichaBase}<li>🐻 Gomitas de muñequitos surtidos</li></ul>
  <h4>Ideal para</h4><div class="chips"><span class="chip">Merienda</span><span class="chip">Recreo</span><span class="chip">Piñatas</span><span class="chip">Antojo</span></div>`);
}
function verProducto(id) {
  const p = TIENDA.productos.find(x => x.id === id); if (!p) return;
  if (p.sabor) return verSabor(p.sabor);
  const i = p.info || {};
  abrirDet(p.img, `<h3>${esc(p.n)}</h3><div class="sub">${esc(p.d)} · ${money(p.p)}${p.extra ? ' · ' + esc(p.extra) : ''}</div>
  ${i.desc ? `<p>${esc(i.desc)}</p>` : ''}
  <h4>Sabores</h4><div class="chips">${Object.entries(SABORES).map(([k, s]) => `<span class="chip" data-s="${k}" onclick="verSabor('${k}')">${s.e} ${s.n}</span>`).join('')}</div>
  <h4>Características</h4><ul>${(i.carac || []).map(c => `<li>✨ ${esc(c)}</li>`).join('')}${fichaBase}</ul>
  ${i.ocasiones ? `<h4>Ideal para</h4><div class="chips">${i.ocasiones.map(o => `<span class="chip">${esc(o)}</span>`).join('')}</div>` : ''}
  <button class="btn full" style="margin-top:18px" onclick="q('${p.id}',1);cerrarDet();toast('Agregado a tu pedido 🛍️')">Agregar · ${money(p.p)}</button>`);
}
/* conectar clics: carrusel, fotos de productos y chips de sabores */
document.addEventListener('click', e => {
  const mi = e.target.closest('.marquee img'); if (mi && mi.dataset.id) return verProducto(mi.dataset.id);
  const ph = e.target.closest('.pc .ph'); if (ph && ph.dataset.id) return verProducto(ph.dataset.id);
  const ch = e.target.closest('.chips .chip[data-s]'); if (ch && !e.target.closest('.mdl')) return verSabor(ch.dataset.s);
});
