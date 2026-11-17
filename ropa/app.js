/* Catálogo por talla · definición de la app.
   Los datos de abajo (seed) son SOLO de ejemplo: se usan en "Modo demo" y en el botón
   "Cargar catálogo de ejemplo" del panel. Tus datos reales viven en tu base de datos. */
(function () {
  const T = n => "d0000000-0000-4000-8000-00000000000" + n, C = n => "c1000000-0000-4000-8000-00000000000" + n, I = n => "a1000000-0000-4000-8000-0000000000" + String(n).padStart(2, "0");
  const ROPA = ["S", "M", "L", "XL"], ZAP = ["36", "37", "38", "39", "40", "41"];
  const p = (n, cat, nombre, precio, tallas, foto, fecha, nuevo, stock) => ({ id: I(n), categoria_id: C(cat), nombre, descripcion: "", precio, tallas: tallas.map(t => ({ t, stock: stock && stock[t] != null ? stock[t] : null })), fotos: ["img/" + foto + ".webp"], nuevo: !!nuevo, activo: true, orden: n, creado: fecha + "T12:00:00.000Z" });
  window.APP = {
    id: "catalogo-tallas", prefix: "cat", bucket: "cat-imagenes", titulo: "Catálogo por talla", icono: "👗", ownerRpc: "cat_reclamar", seedVersion: 3,
    seed: {
      cat_ajustes: [{ id: 1, datos: { nombre: "Tu Tienda", lema: "Promo del viernes 27 · Prendas a $3 y $4 · Envíos a toda Venezuela", subtitulo: "Catálogo de ropa", insignia: "Promo viernes 27", whatsapp: "584221494236", moneda: "$", banner: "img/1490481651871.webp", logo: "", envios: "🚚 Envíos a toda Venezuela · Pago móvil o Zelle" } }],
      cat_tallas: [{ id: T(1), nombre: "Ropa", tallas: ROPA, orden: 1 }],
      cat_categorias: [
        { id: C(1), nombre: "Blusas y camisas", tallas_id: T(1), orden: 1 }, { id: C(2), nombre: "Vestidos", tallas_id: T(1), orden: 2 }, { id: C(3), nombre: "Jeans", tallas_id: T(1), orden: 3 }],
      cat_productos: [
        p(1, 1, "Camisa denim estampada", 4, ["S", "M", "L", "XL"], "1596755094514", "2026-11-14", true),
        p(2, 1, "Camisa celeste manga larga", 3, ["M", "L", "XL"], "1620012253295", "2026-11-12"),
        p(3, 2, "Vestido rojo floral", 4, ["S", "M", "L"], "1572804013309", "2026-11-15", true, { L: 0 }),
        p(4, 2, "Vestido largo rojo", 4, ["S", "M"], "1595777457583", "2026-11-10"),
        p(5, 2, "Vestido blanco de verano", 3, ["S", "M", "L", "XL"], "1515372039744", "2026-11-13", true),
        p(6, 3, "Jean recto oscuro", 4, ["M", "L", "XL"], "1624378439575", "2026-11-11")],
      cat_pedidos: []
    },
    beforeInsert: {
      cat_pedidos(row, read) {
        const ps = read("cat_productos"); let tot = 0;
        row.items = row.items.map(it => {
          const p = ps.find(x => x.id === it.id && x.activo); if (!p) throw new Error("Un producto del pedido ya no está disponible");
          const t = (p.tallas || []).find(x => x.t === it.talla); if (!t) throw new Error("La talla " + it.talla + " no está disponible");
          if (t.stock != null && t.stock <= 0) throw new Error("La talla " + it.talla + " está agotada");
          const q = Math.max(1, Math.min(20, it.cant | 0)); tot += p.precio * q; return { id: p.id, nombre: p.nombre, precio: p.precio, talla: it.talla, cant: q };
        });
        row.total = Math.round(tot * 100) / 100; row.estado = "nuevo";
      }
    }
  };
})();
