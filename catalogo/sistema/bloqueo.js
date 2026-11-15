// Pantalla bloqueada para kiosco, cocina y pantalla de números: pantalla completa sin barra del enlace,
// sin menú al mantener pulsado y sin botón Atrás. Si alguien sale de pantalla completa, aparece la capa para volver.
(function(){
  const enCompleta=()=>document.fullscreenElement||document.webkitFullscreenElement||matchMedia("(display-mode: fullscreen)").matches||matchMedia("(display-mode: standalone)").matches;
  const completa=()=>{ if(enCompleta()) return; const d=document.documentElement; try{(d.requestFullscreen||d.webkitRequestFullscreen).call(d,{navigationUI:"hide"}).catch(()=>{});}catch(e){} };
  const st=document.createElement("style"); st.textContent=`body{user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
input,textarea{user-select:text;-webkit-user-select:text}
#blq{position:fixed;inset:0;background:rgba(29,20,14,.96);color:#fff;z-index:999;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;font:800 1.6rem system-ui,Roboto,sans-serif;cursor:pointer}`;
  document.head.appendChild(st);
  const capa=document.createElement("div"); capa.id="blq"; capa.innerHTML="👆 Toca o pulsa OK para continuar";
  capa.onclick=()=>{ completa(); capa.remove(); };
  const mostrar=()=>{ if(!enCompleta()&&!document.getElementById("blq")&&!document.getElementById("capa")) document.body.appendChild(capa); };
  document.addEventListener("click",completa,true);
  document.addEventListener("fullscreenchange",()=>setTimeout(mostrar,300));
  document.addEventListener("webkitfullscreenchange",()=>setTimeout(mostrar,300));
  document.addEventListener("keydown",e=>{ const c=document.getElementById("blq"); if(c){ e.preventDefault(); c.click(); } });
  document.addEventListener("contextmenu",e=>e.preventDefault());
  history.pushState(null,"",location.href); addEventListener("popstate",()=>history.pushState(null,"",location.href));
  addEventListener("load",()=>setTimeout(mostrar,0));
})();
