// ================================
// Mapa de accesibilidad - Pozuelo
// Leaflet + panel lateral (indicadores + filtro por CUSEC + gráfico circular)
// ================================

/* ================================
   0) DEBUG
================================== */
const DEBUG = true;
function dbg(...args){ if (DEBUG) console.log(...args); }
function dbgGroup(title){ if (DEBUG) console.group(title); }
function dbgGroupEnd(){ if (DEBUG) console.groupEnd(); }
function warn(...args){ console.warn(...args); }

dbg("app.js cargado correctamente");

/* ================================
   1) Inicializar mapa + base
================================== */
dbgGroup("1) Inicialización del mapa");

const map = L.map("mapa", { zoomControl: true }).setView([40.44, -3.81], 13);

const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
  opacity: 0.4,
}).addTo(map);

dbg("Mapa creado + OSM añadido (opacity=0.4)");
dbgGroupEnd();

/* ================================
   2) Variables globales
================================== */
dbgGroup("2) Variables globales");

let limiteGeoJSON = null;
let accesibilidadGeoJSON = null;
let poblacionGeoJSON = null;

let limiteLayer = null;
let accesibilidadLayer = null;
let poblacionLayer = null;

let layerControl = null;
let legendControl = null;

let chartAcc = null;

const state = {
  selectedCUSEC: new Set(),
  onlySelection: false
};

dbg("Estado inicial:", { selected: Array.from(state.selectedCUSEC), onlySelection: state.onlySelection });
dbgGroupEnd();

/* ================================
   3) Estilos de capas
================================== */
function styleLimite(){
  return { color: "#000000", weight: 1.5, dashArray: "6 4", fill: false };
}

function styleAccesibilidad(feature){
  const clase = feature.properties?.Rango_acc;
  let fillColor = "#CCCCCC";

  switch (clase){
    case "0 - 5":  fillColor = "#1a5f1eff"; break;
    case "5 - 15": fillColor = "#a8d8aaff"; break;
    case "15 - 30": fillColor = "#f7da8cff"; break;
    case "> 30":   fillColor = "#EF9A9A"; break;
  }
  return { color: "#555", weight: 0.5, fillColor, fillOpacity: 0.6 };
}

function stylePoblacionBase(feature){
  const acc = Number(feature.properties?.Valor_de_accesibilidad_promedio);
  let fillColor;

  if (acc >= 0.75) fillColor = "#1a5f1eff";
  else if (acc >= 0.5) fillColor = "#a8d8aaff";
  else if (acc >= 0.2) fillColor = "#f7da8cff";
  else fillColor = "#ef9a9aff";

  return { color: "#333", weight: 0.4, fillColor, fillOpacity: 0.45 };
}

function stylePoblacionSelected(feature){
  const base = stylePoblacionBase(feature);
  return { ...base, color: "#111", weight: 2.2, fillOpacity: 0.80 };
}

function stylePoblacionDimmed(feature){
  const base = stylePoblacionBase(feature);
  return { ...base, color: "rgba(0,0,0,0.25)", weight: 0.6, fillOpacity: 0.12 };
}

/* ================================
   4) Utilidades
================================== */
function fmtInt(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "N/D";
  return Math.round(n).toLocaleString("es-ES");
}
function fmtPct(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "N/D";
  return `${n.toFixed(1)}%`;
}
function fmtFixed(v, d=2){
  const n = Number(v);
  if (!Number.isFinite(n)) return "N/D";
  return n.toFixed(d);
}

function validatePoblacionProps(props){
  const issues = [];
  if (!props) issues.push("properties = null/undefined");
  if (!props?.CUSEC) issues.push("CUSEC vacío");
  if (!Number.isFinite(Number(props?.Población_Total))) issues.push("Población_Total no numérica");
  if (!Number.isFinite(Number(props?.Poblacion_ciudad_15_mins))) issues.push("Poblacion_ciudad_15_mins no numérica");
  return issues;
}

/* ================================
   5) Crear capas UNA sola vez
================================== */
function initLayersOnce(){
  dbgGroup("5) initLayersOnce() - crear capas + control (solo 1 vez)");

  limiteLayer = L.geoJSON(null, { style: styleLimite }).addTo(map);

  accesibilidadLayer = L.geoJSON(null, {
    style: styleAccesibilidad,
    onEachFeature: (feature, layer) => {
      const rango = feature.properties?.Rango_acc ?? "N/D";
      layer.bindPopup(`<strong>Accesibilidad:</strong> ${rango} min`);
    }
  }).addTo(map);

  poblacionLayer = L.geoJSON(null, {
    style: stylePoblacionBase,
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      const issues = validatePoblacionProps(p);
      if (issues.length){
        warn("⚠ Props con problemas:", p?.CUSEC, issues, p);
      }

      layer.bindPopup(`
        <strong>Sección censal</strong><br>
        <b>CUSEC:</b> ${p.CUSEC ?? "N/D"}<br>
        <b>Población:</b> ${fmtInt(p.Población_Total)}<br>
        <b>Accesibilidad media:</b> ${fmtFixed(p.Valor_de_accesibilidad_promedio, 2)}<br>
        <b>Habitantes ≤15 min:</b> ${fmtInt(p.Poblacion_ciudad_15_mins)}
      `);
    }
  });

  layerControl = L.control.layers(
    { "OpenStreetMap": osm },
    {
      "Índice de accesibilidad": accesibilidadLayer,
      "Secciones censales": poblacionLayer,
      "Límite municipal": limiteLayer
    },
    { collapsed: window.innerWidth <= 768 }
  ).addTo(map);

  dbg("Capas creadas. Por defecto: límite + accesibilidad ON; secciones OFF.");
  dbgGroupEnd();
}

/* ================================
   6) Leyenda dinámica (solo capas activas)
================================== */
function addLegendDynamic(){
  dbgGroup("6) addLegendDynamic() - leyenda dinámica");

  legendControl = L.control({ position: "bottomright" });

  legendControl.onAdd = function(){
    const div = L.DomUtil.create("div", "legend");
    this._div = div;

    // Evita que al interactuar con la leyenda se arrastre el mapa
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    this.update();
    return div;
  };

  legendControl.update = function(){
    if (!this._div) return;

    const isMobile = window.innerWidth <= 768;
    const isOpen = this._div.classList.contains("is-open");
    const parts = [];

    // Header + body 
    parts.push(`
      <div class="legend-header" role="button" tabindex="0" aria-expanded="${isMobile ? (isOpen ? "true" : "false") : "true"}">
        Leyenda
        ${isMobile ? `<span class="legend-chevron">${isOpen ? "▾" : "▸"}</span>` : ""}
      </div>
      <div class="legend-body" ${isMobile && !isOpen ? 'style="display:none;"' : ""}>
    `);

    if (map.hasLayer(accesibilidadLayer)){
      parts.push(`
        <div class="legend-section">
          <div class="legend-title">Accesibilidad (polígonos)</div>
          <div class="legend-item"><span class="swatch" style="background:#1a5f1eff"></span> 0 - 5 min</div>
          <div class="legend-item"><span class="swatch" style="background:#a8d8aaff"></span> 5 - 15 min</div>
          <div class="legend-item"><span class="swatch" style="background:#f7da8cff"></span> 15 - 30 min</div>
          <div class="legend-item"><span class="swatch" style="background:#ef9a9aff"></span> &gt;30 min</div>
        </div>
      `);
    }

    if (map.hasLayer(poblacionLayer)){
      parts.push(`
        <div class="legend-section">
          <div class="legend-title">
            Secciones censales<br>
            <span class="legend-subtitle">(índice normalizado)</span>
          </div>
          <div class="legend-item"><span class="swatch" style="background:#1a5f1eff"></span> ≥ 0.75</div>
          <div class="legend-item"><span class="swatch" style="background:#a8d8aaff"></span> 0.5 - 0.75</div>
          <div class="legend-item"><span class="swatch" style="background:#f7da8cff"></span> 0.2 - 0.5</div>
          <div class="legend-item"><span class="swatch" style="background:#ef9a9aff"></span> &lt; 0.2</div>
        </div>
      `);
    }

    if (!map.hasLayer(accesibilidadLayer) && !map.hasLayer(poblacionLayer)){
      parts.push(`<div style="opacity:.75;font-size:12px;">Activa una capa para ver su leyenda.</div>`);
    }

    parts.push(`</div>`); // cierre legend-body

    this._div.innerHTML = parts.join("");

    // Añadir comportamiento colapsable (solo una vez)
    if (!this._div.dataset.bound){
      this._div.dataset.bound = "1";

      const toggle = () => {
        if (window.innerWidth > 768) return; // solo móvil
        this._div.classList.toggle("is-open");
        this.update();
        setTimeout(() => map.invalidateSize(true), 150);
      };

      this._div.addEventListener("click", (e) => {
        const header = e.target.closest(".legend-header");
        if (header) toggle();
      });

      // Accesibilidad: Enter/Espacio
      this._div.addEventListener("keydown", (e) => {
        const header = e.target.closest(".legend-header");
        if (!header) return;
        if (e.key === "Enter" || e.key === " "){
          e.preventDefault();
          toggle();
        }
      });
    }
  };

  // Estado inicial: colapsada en móvil
  legendControl.addTo(map);
  if (window.innerWidth <= 768){
    legendControl._div?.classList.remove("is-open"); // cerrada por defecto
    legendControl.update();
  }

  map.on("overlayadd overlayremove", () => legendControl.update());

  dbg("Leyenda añadida. Se actualizará con overlayadd/overlayremove.");
  dbgGroupEnd();
}


/* ================================
   7) Selección: helpers
================================== */
function getSectionsForKPIs(){
  const feats = poblacionGeoJSON?.features || [];
  const sel = state.selectedCUSEC;

  dbgGroup("7.1) getSectionsForKPIs()");
  dbg("Total secciones:", feats.length);
  dbg("Selección CUSEC:", Array.from(sel));

  if (sel.size === 0){
    dbg("➡ Sin selección: KPIs sobre TODAS las secciones.");
    dbgGroupEnd();
    return feats;
  }

  const filtered = feats.filter(f => sel.has(String(f.properties?.CUSEC)));
  dbg("➡ KPIs sobre secciones filtradas:", filtered.length);
  dbgGroupEnd();
  return filtered;
}

function getSectionsForDraw(){
  const feats = poblacionGeoJSON?.features || [];
  const sel = state.selectedCUSEC;

  if (!state.onlySelection) return feats;
  if (sel.size === 0) return feats;

  return feats.filter(f => sel.has(String(f.properties?.CUSEC)));
}

function applySelectionStyles(){
  dbgGroup("7.2) applySelectionStyles()");
  dbg("Aplicando estilos. onlySelection:", state.onlySelection, "selección:", Array.from(state.selectedCUSEC));

  if (!poblacionLayer){
    warn("⚠ poblacionLayer no existe aún.");
    dbgGroupEnd();
    return;
  }

  if (state.selectedCUSEC.size === 0 || state.onlySelection){
    poblacionLayer.setStyle(stylePoblacionBase);
    dbg("➡ Estilo base aplicado (sin selección o solo selección).");
    dbgGroupEnd();
    return;
  }

  poblacionLayer.eachLayer((layer) => {
    const cusec = String(layer.feature?.properties?.CUSEC ?? "");
    if (!cusec) return;

    if (state.selectedCUSEC.has(cusec)){
      layer.setStyle(stylePoblacionSelected(layer.feature));
      if (layer.bringToFront) layer.bringToFront();
    } else {
      layer.setStyle(stylePoblacionDimmed(layer.feature));
    }
  });

  dbg("Estilos aplicados (resaltado + atenuado).");
  dbgGroupEnd();
}

/* ================================
   8) Indicadores + gráfico circular
================================== */
function updateKPIsAndChart(){
  dbgGroup("8) updateKPIsAndChart()");

  const features = getSectionsForKPIs();

  let popTotal = 0;
  let pop15 = 0;

  for (const f of features){
    const p = f.properties || {};
    popTotal += Number(p.Población_Total) || 0;
    pop15 += Number(p.Poblacion_ciudad_15_mins) || 0;
  }

  const popNo15 = Math.max(0, popTotal - pop15);
  const pct15 = popTotal > 0 ? (pop15 / popTotal) * 100 : 0;

  // Indicadores 
  const elN = document.getElementById("indicadorN");
  const elTot = document.getElementById("indicadorPobTotal");
  const el15 = document.getElementById("indicadorPob15");
  const elPct = document.getElementById("indicadorPct15");

  if (elN) elN.textContent = fmtInt(features.length);
  if (elTot) elTot.textContent = fmtInt(popTotal);
  if (el15) el15.textContent = fmtInt(pop15);
  if (elPct) elPct.textContent = fmtPct(pct15);

  dbg("Indicadores actualizados en el DOM.");

  // Gráfico 
  const canvas = document.getElementById("graficoAcc");
  if (!canvas){
    warn("⚠ No existe #graficoAcc en el DOM. Revisa index.html.");
    dbgGroupEnd();
    return;
  }

  if (window.ChartDataLabels && Chart?.register){
    try { Chart.register(ChartDataLabels); } catch(e) {}
  }

  const dataVals = [pop15, popNo15];

  const datalabelFormatter = (value, context) => {
    const dataArr = context.chart.data.datasets[0].data || [];
    const total = dataArr.reduce((a,b)=>a+(Number(b)||0),0);
    const pct = total > 0 ? (Number(value) / total) * 100 : 0;
    return `${fmtInt(value)} (${pct.toFixed(1)}%)`;
  };

  if (!chartAcc){
    dbg("Creando gráfico circular (Chart.js) por primera vez.");
    const ctx = canvas.getContext("2d");

    chartAcc = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["≤ 15 min", "> 15 min"],
        datasets: [{ label: "Población", data: dataVals }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = Number(ctx.parsed) || 0;
                const arr = ctx.dataset.data || [];
                const total = arr.reduce((a,b)=>a+(Number(b)||0),0);
                const pct = total > 0 ? (v/total)*100 : 0;
                return `${ctx.label}: ${fmtInt(v)} (${pct.toFixed(1)}%)`;
              }
            }
          },
          datalabels: window.ChartDataLabels ? {
            formatter: datalabelFormatter,
            font: { weight: "700" },
            anchor: "end",
            align: "end",
            clamp: true
          } : undefined
        }
      }
    });

    dbg("Gráfico creado.");
  } else {
    dbg("Actualizando gráfico circular.");
    chartAcc.data.datasets[0].data = dataVals;
    chartAcc.update();
  }

  dbgGroupEnd();
}

/* ================================
   9) Refrescar capas
================================== */
function refreshLayers(){
  dbgGroup("9) refreshLayers()");
  dbg("Selección:", Array.from(state.selectedCUSEC));
  dbg("onlySelection:", state.onlySelection);

  if (!limiteGeoJSON || !accesibilidadGeoJSON || !poblacionGeoJSON){
    warn("⚠ refreshLayers() antes de cargar los 3 GeoJSON.");
    dbgGroupEnd();
    return;
  }

  limiteLayer.clearLayers();
  accesibilidadLayer.clearLayers();
  poblacionLayer.clearLayers();

  limiteLayer.addData(limiteGeoJSON);
  accesibilidadLayer.addData(accesibilidadGeoJSON);

  const featsDraw = getSectionsForDraw();
  poblacionLayer.addData({ type: "FeatureCollection", features: featsDraw });

  applySelectionStyles();
  updateKPIsAndChart();

  dbgGroupEnd();
}

/* ================================
   10) UI: lista CUSEC + listeners
================================== */
function buildCUSECList(){
  dbgGroup("10) buildCUSECList()");

  const list = document.getElementById("listaCUSEC");
  const search = document.getElementById("buscadorCUSEC");
  const btnSelectAll = document.getElementById("btnSeleccionarTodas");
  const btnClearSel = document.getElementById("btnLimpiarSeleccion");
  const btnReset = document.getElementById("btnResetear");
  const chkSolo = document.getElementById("chkSoloSeleccion");

  if (!list || !search || !btnSelectAll || !btnClearSel || !btnReset || !chkSolo){
    warn("⚠ Faltan elementos del panel (IDs). Revisa index.html.");
    dbg({ list: !!list, search: !!search, btnSelectAll: !!btnSelectAll, btnClearSel: !!btnClearSel, btnReset: !!btnReset, chkSolo: !!chkSolo });
    dbgGroupEnd();
    return;
  }

  const feats = poblacionGeoJSON?.features || [];
  const cusecs = feats
    .map(f => String(f.properties?.CUSEC))
    .filter(Boolean)
    .sort();

  function render(filterText=""){
    list.innerHTML = "";
    const ft = filterText.trim().toLowerCase();

    for (const c of cusecs){
      if (ft && !c.toLowerCase().includes(ft)) continue;

      const row = document.createElement("label");
      row.className = "cusec-item";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = state.selectedCUSEC.has(c);

      cb.addEventListener("change", () => {
        if (cb.checked) state.selectedCUSEC.add(c);
        else state.selectedCUSEC.delete(c);
        refreshLayers();
      });

      const txt = document.createElement("span");
      txt.textContent = c;

      row.appendChild(cb);
      row.appendChild(txt);
      list.appendChild(row);
    }
  }

  search.addEventListener("input", () => render(search.value));

  btnSelectAll.addEventListener("click", () => {
    state.selectedCUSEC = new Set(cusecs);
    render(search.value);
    refreshLayers();
  });

  btnClearSel.addEventListener("click", () => {
    state.selectedCUSEC.clear();
    render(search.value);
    refreshLayers();
  });

  chkSolo.addEventListener("change", () => {
    state.onlySelection = chkSolo.checked;
    refreshLayers();
  });

  btnReset.addEventListener("click", () => {
    state.selectedCUSEC.clear();
    state.onlySelection = false;
    chkSolo.checked = false;

    search.value = "";
    render("");
    refreshLayers();

    if (limiteLayer?.getBounds){
      map.fitBounds(limiteLayer.getBounds());
    }
  });

  render("");
  dbg("UI CUSEC lista.");
  dbgGroupEnd();
}

/* ================================
   11) Carga de GeoJSON + arranque
================================== */
dbgGroup("11) Carga de datos (fetch)");

fetch("data/Pozuelo.geojson")
  .then(r => r.json())
  .then((data) => { limiteGeoJSON = data; return fetch("data/Indice_accesibilidad.geojson"); })
  .then(r => r.json())
  .then((data) => { accesibilidadGeoJSON = data; return fetch("data/Poblacion.geojson"); })
  .then(r => r.json())
  .then((data) => {
    poblacionGeoJSON = data;

    dbg("Los 3 GeoJSON están cargados. Arrancando app…");

    initLayersOnce();
    addLegendDynamic();
    refreshLayers();

    if (limiteLayer?.getBounds) map.fitBounds(limiteLayer.getBounds());

    buildCUSECList();
    dbgGroupEnd();
  })
  .catch((err) => {
    console.error("Error cargando GeoJSON:", err);
    dbgGroupEnd();
  });

