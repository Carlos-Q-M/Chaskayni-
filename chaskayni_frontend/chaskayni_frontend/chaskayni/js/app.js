const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...hijos) => { const n = document.createElement(tag); Object.assign(n, props); hijos.forEach(h => n.append(h)); return n; };

// ---------- Estado y persistencia ----------
const base = {
  lotes: [
    { id: 1, productor: "Rosa Quispe (Anta)", producto: "Papa nativa", kg: 40, precio: 4.5, cesta: false },
    { id: 2, productor: "Mario Huamán (Paruro)", producto: "Habas frescas", kg: 25, precio: 3.0, cesta: true },
    { id: 3, productor: "Elena Mamani (Calca)", producto: "Quinua", kg: 15, precio: 7.0, cesta: false }],
  pedidos: [], alertas: [], reportes: [], sig: 4
};
const comunidades = [
  { nombre: "Anta", alt: 3340 }, { nombre: "Paruro", alt: 3100 },
  { nombre: "Santo Tomás (Chumbivilcas)", alt: 3700 }, { nombre: "Yauri (Espinar)", alt: 3920 }];
const refugios = [ // puntos de ejemplo, no oficiales
  { nombre: "Cancha deportiva (ejemplo) · Santiago", lat: -13.5265, lng: -71.9855 },
  { nombre: "Losa deportiva (ejemplo) · San Sebastián", lat: -13.5300, lng: -71.9200 }];
let estado, usuario = null, puntoElegido = null;
try { estado = JSON.parse(localStorage.getItem("chaskayni")) || base; } catch (e) { estado = base; }
const guardar = () => { try { localStorage.setItem("chaskayni", JSON.stringify(estado)); } catch (e) {} };
const soles = (n) => "S/ " + n.toFixed(2);
const precioFinal = (l) => l.cesta ? l.precio * 0.7 : l.precio;

// ---------- Navegación entre vistas ----------
function mostrar() {
  const id = (location.hash || "#inicio").slice(1);
  const vista = document.getElementById(id) ? id : "inicio";
  document.querySelectorAll(".vista").forEach(v => v.hidden = v.id !== vista);
  document.querySelectorAll("#menu a").forEach(a => a.hash === "#" + vista ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  if (vista === "riesgo") iniciarMapa();
}
window.addEventListener("hashchange", mostrar);

// ---------- Sesión simulada (autorización por rol) ----------
const dlg = $("#dlgIngreso");
$("#btnIngresar").addEventListener("click", () => usuario ? (usuario = null, pintarTodo()) : dlg.showModal());
dlg.addEventListener("close", () => {
  if (dlg.returnValue !== "ok") return;
  const nombre = $("#inNombre").value.trim();
  if (nombre) { usuario = { nombre, rol: $("#inRol").value }; pintarTodo(); }
});
const puedePublicar = () => usuario && ["productor", "admin"].includes(usuario.rol);

// ---------- Mercado ----------
function pintarMercado() {
  $("#btnIngresar").textContent = usuario ? `Salir (${usuario.rol})` : "Ingresar";
  $("#avisoRol").textContent = usuario ? `Hola, ${usuario.nombre}. Tu rol es ${usuario.rol}.` : "Estás como visitante: ingresa para publicar lotes o hacer pedidos.";
  $("#formLote").hidden = !puedePublicar();
  const lista = $("#listaLotes"); lista.replaceChildren();
  const lotes = estado.lotes.filter(l => !$("#soloCestas").checked || l.cesta);
  if (!lotes.length) lista.append(el("p", { textContent: "No hay lotes con ese filtro. Publica uno o quita el filtro." }));
  lotes.forEach(l => {
    const acc = el("div", { className: "fila" });
    if (usuario && usuario.rol !== "productor") acc.append(el("button", { className: "btn chico", textContent: "Pedir 1 kg", onclick: () => pedir(l.id) }));
    if (puedePublicar()) {
      acc.append(el("button", { className: "btn chico sec", textContent: "Editar precio", onclick: () => editar(l.id) }),
                 el("button", { className: "btn chico sec", textContent: "Eliminar", onclick: () => eliminar(l.id) }));
    }
    lista.append(el("article", { className: "card" + (l.cesta ? " cesta" : "") },
      l.cesta ? el("span", { className: "etiqueta", textContent: "Cesta Salvada" }) : "",
      el("h3", { textContent: l.producto }),
      el("span", { textContent: `${l.kg} kg disponibles · ${l.productor}` }),
      el("span", { className: "precio", textContent: soles(precioFinal(l)) + " / kg " }, l.cesta ? el("span", { className: "tachado", textContent: soles(l.precio) }) : ""),
      acc));
  });
  const ped = $("#listaPedidos"); ped.replaceChildren();
  if (!estado.pedidos.length) ped.append(el("li", { textContent: "Aún no hay pedidos." }));
  estado.pedidos.forEach(p => ped.append(el("li", { textContent: `${p.producto}: ${p.kg} kg para ${p.comprador}, total ${soles(p.total)}` })));
}
function pedir(id) {
  const l = estado.lotes.find(x => x.id === id); if (!l || l.kg < 1) return;
  l.kg -= 1;
  const e = estado.pedidos.find(p => p.lote === id && p.comprador === usuario.nombre);
  if (e) { e.kg += 1; e.total += precioFinal(l); } else estado.pedidos.push({ lote: id, producto: l.producto, kg: 1, comprador: usuario.nombre, total: precioFinal(l) });
  guardar(); pintarTodo();
}
function editar(id) {
  const l = estado.lotes.find(x => x.id === id), v = parseFloat(prompt("Nuevo precio por kg (S/):", l.precio));
  if (v > 0) { l.precio = v; guardar(); pintarTodo(); }
}
function eliminar(id) { if (confirm("¿Eliminar este lote?")) { estado.lotes = estado.lotes.filter(l => l.id !== id); guardar(); pintarTodo(); } }
$("#soloCestas").addEventListener("change", pintarMercado);
$("#formLote").addEventListener("submit", (e) => {
  e.preventDefault(); const f = e.target, err = $("#errLote");
  const producto = f.producto.value.trim(), kg = +f.kg.value, precio = +f.precio.value;
  if (!producto || !(kg >= 1) || !(precio > 0)) { err.textContent = "Completa el producto, una cantidad de 1 kg o más y un precio mayor a 0."; return; }
  err.textContent = "";
  estado.lotes.unshift({ id: estado.sig++, productor: usuario.nombre, producto, kg, precio, cesta: f.cesta.checked });
  f.reset(); guardar(); pintarTodo();
});

// ---------- Heladas ----------
$("#selComunidad").replaceChildren(...comunidades.map((c, i) => el("option", { value: i, textContent: `${c.nombre} (${c.alt} msnm)` })));
$("#formAlerta").addEventListener("submit", (e) => {
  e.preventDefault(); const f = e.target, err = $("#errAlerta"), t = parseFloat(f.temp.value);
  if (isNaN(t)) { err.textContent = "Ingresa la temperatura prevista en °C."; return; }
  if (t >= 0) { err.textContent = `Con ${t} °C no hay riesgo de helada. No se emite alerta.`; return; }
  err.textContent = "";
  const nivel = t <= -5 ? "alto" : t <= -2 ? "medio" : "bajo";
  estado.alertas.unshift({ comunidad: comunidades[+f.comunidad.value].nombre, t, nivel });
  guardar(); pintarAlertas();
});
function pintarAlertas() {
  const ul = $("#listaAlertas"); ul.replaceChildren();
  if (!estado.alertas.length) ul.append(el("li", { textContent: "Sin alertas activas." }));
  estado.alertas.forEach((a, i) => ul.append(el("li", {},
    el("span", {}, el("span", { className: "nivel " + a.nivel, textContent: `Riesgo ${a.nivel}` }), ` · ${a.comunidad} · ${a.t} °C. Protege el ganado y adelanta la cosecha; publícala como Cesta Salvada.`),
    el("button", { className: "btn chico sec", textContent: "Cerrar alerta", onclick: () => { estado.alertas.splice(i, 1); guardar(); pintarAlertas(); pintarResumen(); } }))));
  pintarResumen();
}

// ---------- Riesgo urbano (mapa Leaflet) ----------
let mapa = null, capaReportes = null;
function iniciarMapa() {
  if (mapa) { setTimeout(() => mapa.invalidateSize(), 50); return; }
  if (typeof L === "undefined") { $("#mapa").textContent = "No se pudo cargar el mapa. Revisa tu conexión a internet."; return; }
  mapa = L.map("mapa").setView([-13.5280, -71.9650], 13);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(mapa);
  refugios.forEach(r => L.circleMarker([r.lat, r.lng], { color: "#4F7A32", fillOpacity: .8, radius: 9 }).addTo(mapa).bindPopup(r.nombre));
  capaReportes = L.layerGroup().addTo(mapa); estado.reportes.forEach(marcar);
  mapa.on("click", (e) => { puntoElegido = e.latlng; $("#coords").textContent = `Ubicación elegida: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`; });
}
function marcar(r) { if (capaReportes) L.circleMarker([r.lat, r.lng], { color: "#B3362F", fillOpacity: .8, radius: 8 }).addTo(capaReportes).bindPopup(`${r.tipo}: ${r.desc}`); }
$("#formReporte").addEventListener("submit", (e) => {
  e.preventDefault(); const f = e.target, err = $("#errReporte"), desc = f.desc.value.trim();
  if (!desc || !puntoElegido) { err.textContent = "Escribe una descripción y haz clic en el mapa para marcar el lugar."; return; }
  err.textContent = "";
  const r = { tipo: f.tipo.value, desc, lat: puntoElegido.lat, lng: puntoElegido.lng };
  estado.reportes.unshift(r); marcar(r); guardar(); f.reset(); pintarReportes(); pintarResumen();
});
function pintarReportes() {
  const ul = $("#listaReportes"); ul.replaceChildren();
  if (!estado.reportes.length) ul.append(el("li", { textContent: "Todavía no hay reportes." }));
  estado.reportes.forEach(r => ul.append(el("li", { textContent: `${r.tipo}: ${r.desc}` })));
}

// ---------- Inicio ----------
function pintarResumen() {
  const kg = estado.lotes.reduce((s, l) => s + l.kg, 0);
  const datos = [[estado.lotes.length, "lotes publicados"], [kg, "kg disponibles"], [estado.alertas.length, "alertas de helada"], [estado.reportes.length, "reportes de riesgo"]];
  $("#resumen").replaceChildren(...datos.map(([n, t]) => el("div", {}, el("strong", { textContent: n }), t)));
}
function pintarTodo() { pintarMercado(); pintarAlertas(); pintarReportes(); pintarResumen(); }
pintarTodo(); mostrar();
