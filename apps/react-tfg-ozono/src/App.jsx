import { useEffect, useRef } from "react";

import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import LayerList from "@arcgis/core/widgets/LayerList";
import Legend from "@arcgis/core/widgets/Legend";
import Expand from "@arcgis/core/widgets/Expand";
import GroupLayer from "@arcgis/core/layers/GroupLayer.js";
import BasemapGallery from "@arcgis/core/widgets/BasemapGallery";
//import Fullscreen from "@arcgis/core/widgets/Fullscreen";
import ScaleBar from "@arcgis/core/widgets/ScaleBar.js";

import "@arcgis/core/assets/esri/themes/dark/main.css";


function App() {
  const mapaRef = useRef(null);

  useEffect(() => {
    if (!mapaRef.current) return;

    // MAPA BASE
    const mapa = new Map({
      basemap: "dark-gray",
    });

    const view = new MapView({
      container: mapaRef.current,
      map: mapa,
      center: [-3.7, 40.45],
      zoom: 9,
    });

    const ruta = "./geojson/";


    // POPUPS O3 (2 decimales)
    const generarPopupVerano = (tituloCapa) => ({
      title: "{NAMEUNIT}",
      expressionInfos: [
        {
          name: "mean2dec",
          expression: `
            var v = Number($feature.MEAN);
            return Round(v, 2);
          `,
        },
      ],
      content: `
        <b>Año:</b> ${tituloCapa.replace("Verano ", "")}<br>
        <b>Valor promedio de superaciones del umbral de 120 µg/m³:</b><br>
        <span style="font-size: 16px;">
          <b>{expression/mean2dec}</b>
        </span>
      `,
    });

    // SIMBOLOGÍA DE O3
    const generarSimbologiaVerano = () => ({
      type: "class-breaks",
      field: "MEAN",
      defaultSymbol: {
        type: "simple-fill",
        color: "#ffffff",
        outline: { color: "black", width: 0.3 },
      },
      classBreakInfos: [
        { minValue: 0, maxValue: 10, color: "#E0F3F8", label: "< 10" },
        { minValue: 10.001, maxValue: 15, color: "#A8DDB5", label: "10 - 15" },
        { minValue: 15.001, maxValue: 20, color: "#7BCCC4", label: "15 - 20" },
        { minValue: 20.001, maxValue: 25, color: "#4EB3D3", label: "20 - 25" },
        { minValue: 25.001, maxValue: 30, color: "#FFA77F", label: "25 - 30" },
        { minValue: 30.001, maxValue: 35, color: "#FF5500", label: "30 - 35" },
        { minValue: 35.001, maxValue: 40, color: "#BD0026", label: "35 - 40" },
        { minValue: 40.001, maxValue: 45, color: "#800026", label: "40 - 45" },
        { minValue: 45.001, maxValue: 99999, color: "#8400A8", label: "> 45" },
      ].map((cls) => ({
        minValue: cls.minValue,
        maxValue: cls.maxValue,
        label: cls.label,
        symbol: {
          type: "simple-fill",
          color: cls.color,
          outline: { color: "#666666ff", width: 0.3 },
        },
      })),
    });

    // CAPAS O3 AGRUPADAS
    const verano2020 = new GeoJSONLayer({
      url: ruta + "verano_2020.geojson",
      title: "Verano 2020",
      renderer: generarSimbologiaVerano(),
      effect: "bloom(0.1, 1px, 0.0)",
      popupTemplate: generarPopupVerano("Verano 2020"),
      visible: false,
    });

    const verano2021 = new GeoJSONLayer({
      url: ruta + "verano_2021.geojson",
      title: "Verano 2021",
      renderer: generarSimbologiaVerano(),
      effect: "bloom(0.1, 1px, 0.0)",
      popupTemplate: generarPopupVerano("Verano 2021"),
      visible: false,
    });

    const verano2022 = new GeoJSONLayer({
      url: ruta + "verano_2022.geojson",
      title: "Verano 2022",
      renderer: generarSimbologiaVerano(),
      effect: "bloom(0.1, 1px, 0.0)",
      popupTemplate: generarPopupVerano("Verano 2022"),
      visible: false,
    });

    const verano2023 = new GeoJSONLayer({
      url: ruta + "verano_2023.geojson",
      title: "Verano 2023",
      renderer: generarSimbologiaVerano(),
      effect: "bloom(0.1, 1px, 0.0)",
      popupTemplate: generarPopupVerano("Verano 2023"),
      visible: false,
    });

    const verano2024 = new GeoJSONLayer({
      url: ruta + "verano_2024.geojson",
      title: "Verano 2024",
      renderer: generarSimbologiaVerano(),
      effect: "bloom(0.1, 1px, 0.0)",
      popupTemplate: generarPopupVerano("Verano 2024"),
      visible: true,
    });

    const capasOzono = [verano2020, verano2021, verano2022, verano2023, verano2024];

    // GroupLayer con todas
    const grupoOzono = new GroupLayer({
      title: "Superaciones de ozono según el año",
      visible: true,
      visibilityMode: "independent",  // permite activar varios o solo uno
      layers: [verano2024, verano2023, verano2022, verano2021, verano2020]
    });

    // Añadir al mapa
    mapa.add(grupoOzono);

    // CAPAS GENERALES
    const zonasCalidad = new GeoJSONLayer({
      url: ruta + "zonas_calidad_aire.geojson",
      title: "Zonas de calidad del aire",
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-fill",
          color: [0, 0, 0, 0],
          outline: {
            color: "#000000ff",
            width: 1,
            style: "dash",
          },
        },
      },
      labelingInfo: [
        {
          labelExpressionInfo: { expression: "$feature.DS_NOMBRE_" },
          symbol: {
            type: "text",
            color: "black",
            haloColor: "white",
            haloSize: 1,
            font: {
              size: 12,
              weight: "bold",
            },
          },
          labelPlacement: "center-center",
          minScale: 2000000,
          maxScale: 150000,
        },
      ],
      labelsVisible: true,
    });
    mapa.add(zonasCalidad);

    const estaciones = new GeoJSONLayer({
      url: ruta + "estaciones_O3.geojson",
      title: "Estaciones de O₃",
      effect: "bloom(0.5, 1px, 0.0)",
      renderer: {
        type: "simple",
        symbol: {
          type: "picture-marker",
          height: 15,
          url: "https://cdn-icons-png.flaticon.com/128/4982/4982386.png",
          width: 15,
        },
      },
      popupTemplate: {
        title: "{ETIQUETA}",

        expressionInfos: [
          { name: "v2020", expression: "Round($feature.O3_verano_2020, 2)" },
          { name: "v2021", expression: "Round($feature.O3_verano_2021, 2)" },
          { name: "v2022", expression: "Round($feature.O3_verano_2022, 2)" },
          { name: "v2023", expression: "Round($feature.O3_verano_2023, 2)" },
          { name: "v2024", expression: "Round($feature.O3_verano_2024, 2)" },
        ],

        content: `
          <b>Municipio:</b> {LMUN}<br>
          <b>Tipo de estación:</b> {Tipo_estacion}<br><br>

          <b>Superaciones de ozono (verano, días):</b><br>
          2020: {expression/v2020}<br>
          2021: {expression/v2021}<br>
          2022: {expression/v2022}<br>
          2023: {expression/v2023}<br>
          2024: {expression/v2024}
        `,
      },
    });

    mapa.add(estaciones);

    const limiteMadrid = new GeoJSONLayer({
      url: ruta + "Comunidad_Madrid.geojson",
      title: "Límite Comunidad de Madrid",
      effect: "bloom(1, 0.4px, 0.0)",
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-fill",
          color: [0, 0, 0, 0],
          outline: { color: [0, 0, 0, 1], width: 1.5 },
        },
      },
    });
    mapa.add(limiteMadrid);

// WIDGETS (contraibles)

// Lista de capas
const layerList = new LayerList({ view });
const layerListExpand = new Expand({
  view,
  content: layerList,
  expandIconClass: "esri-icon-layer-list", 
  group: "widgets",
});
view.ui.add(layerListExpand, "top-right");

// Leyenda
const legend = new Legend({ view });
const legendExpand = new Expand({
  view,
  content: legend,
  expandIconClass: "esri-icon-legend",
  group: "widgets",
});
view.ui.add(legendExpand, "top-right");

// Galería de mapas base (Widget clásico, en algún momento habrá que cambiarlo por componente)
const basemapGallery = new BasemapGallery({
  view: view,
});

const basemapExpand = new Expand({
  view: view,
  content: basemapGallery,
  expandIconClass: "esri-icon-basemap", // icono estándar
  group: "top-right",
});

view.ui.add(basemapExpand, "top-right");


// Pantalla completa
//const fullscreen = new Fullscreen({
//  view: view,
//});
//view.ui.add(fullscreen, "bottom-right");


//Barra de escala
const scaleBar = new ScaleBar({
  view: view
});

view.ui.add(scaleBar, "bottom-left");

//EFECTOS

// HOVER HIGHLIGHT MUNICIPIOS
let highlightHandle = null;

view.on("pointer-move", async (event) => {
  try {
    const hit = await view.hitTest(event);

    // Si no hay nada bajo el ratón → quitamos highlight y salimos
    if (!hit.results.length) {
      if (highlightHandle) {
        highlightHandle.remove();
        highlightHandle = null;
      }
      return;
    }

    // Buscamos un resultado cuya capa esté en capasOzono
    const result = hit.results.find((r) =>
      capasOzono.includes(r.graphic.layer)
    );

    // Si el ratón está sobre otra cosa (zonas, estaciones…) → quitamos highlight
    if (!result) {
      if (highlightHandle) {
        highlightHandle.remove();
        highlightHandle = null;
      }
      return;
    }

    // Obtenemos la LayerView de la capa correspondiente
    const layerView = await view.whenLayerView(result.graphic.layer);

    // Si ya había un highlight, lo quitamos antes de poner el nuevo
    if (highlightHandle) {
      highlightHandle.remove();
    }

    // Aplicamos highlight al municipio
    highlightHandle = layerView.highlight(result.graphic);
  } catch (err) {
    console.error("Error en hover highlight:", err);
  }
});

// ZOOM ANIMADO AL HACER CLICK
view.on("click", async (event) => {
  try {
    const hit = await view.hitTest(event);

    if (!hit.results.length) return;

    const result = hit.results.find((r) =>
      capasOzono.includes(r.graphic.layer)
    );

    if (!result) return;

    // Zoom animado al municipio
    view.goTo(
      {
        target: result.graphic.geometry,
        scale: 75000, // ajusta según lo cerca que quieras llegar
      },
      {
        duration: 800,          // ms
        easing: "ease-in-out",  // curva de animación
      }
    );
  } catch (err) {
    console.error("Error en zoom al click:", err);
  }
});

    // AJUSTAR VISTA A COMUNIDAD

    limiteMadrid.when(() => {
      view.goTo(limiteMadrid.fullExtent.expand(1.1));
    });

    return () => view.destroy();
  }, []);

  return <div ref={mapaRef} style={{ width: "100%", height: "100vh" }} />;
  
}

export default App;
