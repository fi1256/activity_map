import {
  initializeBlock,
  useBase,
  useRecords,
  useViewport,
} from "@airtable/blocks/ui";
import React, { useCallback, useEffect } from "react";
import "./style.css";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Graphic from "@arcgis/core/Graphic";
import Legend from "@arcgis/core/widgets/Legend";
import Slider from "@arcgis/core/widgets/Slider";
import Expand from "@arcgis/core/widgets/Expand";

const ACTIVITIES = [
  "Raid",
  "Abduction/Attempt",
  "Threat",
  "Stakeout",
  "Gathering/Staging",
  "Driving/Observed",
  "Drone",
  "Helicopter",
  "Misc/Unknown",
];

function HelloWorldTypescriptApp() {
  const base = useBase();

  const table = base.getTableByNameIfExists("All Data");
  const records = useRecords(table!);

  function getRecordProperties(record) {
    const result = {
      abducted_yn: record.getCellValueAsString("abducted_yn"),
      simplified_activity: record.getCellValueAsString("simplified_activity"),
      activity_date: record.getCellValueAsString("activity_date"),
      start_hour_min: record.getCellValueAsString("start_hour_min"),
      address: record.getCellValueAsString("address"),
      location_type: record.getCellValueAsString("location_type"),
      veracity: record.getCellValueAsString("veracity"),
      additional_description: record.getCellValueAsString(
        "additional_description"
      ),
      start_datetime_str: record.getCellValueAsString("start_datetime_str"),
      start_timestamp: record.getCellValue("start_timestamp"),
      hour_of_day: record.getCellValue("hour_of_day"),
      map_activity: record.getCellValueAsString("map_activity"),
      day_of_week: record.getCellValueAsString("day_of_week"),
      hour_of_day_str: record.getCellValueAsString("hour_of_day_str"),
    };

    return result;
  }

  const features = records.map((record) => {
    const properties = getRecordProperties(record);

    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [record.getCellValue("long"), record.getCellValue("lat")],
      },
      properties,
    };
  });

  const geojsonData = {
    type: "FeatureCollection",
    name: "latest from All Data",
    crs: {
      type: "name",
      properties: {
        name: "urn:ogc:def:crs:OGC:1.3:CRS84",
      },
    },
    features,
  };

  const viewport = useViewport();
  const { width, height } = viewport.size;

  const [selectedActivities, setSelectedActivities] =
    React.useState(ACTIVITIES);

  const [applyFilters, setApplyFilters] = React.useState(null);

  useEffect(() => {
    console.log(
      "selectedActivities changed:",
      selectedActivities,
      applyFilters
    );
    applyFilters?.();
  }, [selectedActivities, applyFilters]);

  useEffect(() => {
    viewport.enterFullscreenIfPossible();

    // --- Convert GeoJSON to Graphics ---
    const graphics = geojsonData.features.map((f, i) => {
      const props = f.properties;

      // --- derive symbol key ---
      let symbolKey = props.simplified_activity;

      if (
        props.simplified_activity === "Raid" ||
        props.simplified_activity === "Abduction/Attempt"
      ) {
        const abducted = props.abducted_yn
          ? props.abducted_yn.toUpperCase()
          : "UNKNOWN";

        if (abducted === "YES") {
          symbolKey = `${props.simplified_activity}_YES`;
        } else if (abducted === "NO") {
          symbolKey = `${props.simplified_activity}_NO`;
        } else {
          symbolKey = `${props.simplified_activity}_UNKNOWN`;
        }
      }

      // --- hour extraction ---
      const hourNumber = props.start_hour_min
        ? Number(props.start_hour_min.split(":")[0])
        : null;

      return new Graphic({
        geometry: {
          type: "point",
          longitude: f.geometry.coordinates[0],
          latitude: f.geometry.coordinates[1],
        },
        attributes: {
          objectid: i + 1,
          ...props,
          activity_symbol_key: symbolKey,
          hourNumber: hourNumber,
        },
      });
    });

    // --- Map & View ---
    const map = new Map({ basemap: "gray" });
    const view = new MapView({
      container: "viewDiv",
      map,
      center: [-93.25, 44.95],
      zoom: 10,
    });

    // --- Renderer ---
    const renderer = {
      type: "unique-value",
      field: "activity_symbol_key",
      uniqueValueInfos: [
        // ======================
        // RAID — HEXAGON SVG
        // ======================
        {
          value: "Raid_YES",
          label: "Raid (someone taken)",
          symbol: {
            type: "picture-marker",
            url: hexagonSVG("red"),
            width: 12,
            height: 12,
          },
        },
        {
          value: "Raid_NO",
          label: "Raid (no one confirmed taken)",
          symbol: {
            type: "picture-marker",
            url: hexagonSVG("#fcf2fa"),
            width: 12,
            height: 12,
          },
        },
        {
          value: "Raid_UNKNOWN",
          label: "Raid (unknown result)",
          symbol: {
            type: "picture-marker",
            url: hexagonSVG("gray"),
            width: 12,
            height: 12,
          },
        },

        // ======================
        // ABDUCTION / ATTEMPT — TRIANGLE
        // ======================
        {
          value: "Abduction/Attempt_YES",
          label: "Abduction/Attempt (someone taken)",
          symbol: {
            type: "simple-marker",
            style: "triangle",
            color: "red",
            size: 12,
            outline: { color: "black", width: 1 },
          },
        },
        {
          value: "Abduction/Attempt_NO",
          label: "Abduction/Attempt (no one confirmed taken)",
          symbol: {
            type: "simple-marker",
            style: "triangle",
            color: "#fcf2fa",
            size: 12,
            outline: { color: "black", width: 1 },
          },
        },
        {
          value: "Abduction/Attempt_UNKNOWN",
          label: "Abduction/Attempt (unknown result)",
          symbol: {
            type: "simple-marker",
            style: "triangle",
            color: "gray",
            size: 12,
            outline: { color: "black", width: 1 },
          },
        },

        // ======================
        // OTHER ACTIVITIES
        // ======================
        {
          value: "Threat",
          label: "Threat",
          symbol: {
            type: "simple-marker",
            style: "circle",
            color: "red",
            size: 8,
            outline: { color: "black", width: 1 },
          },
        },
        {
          value: "Stakeout",
          label: "Stakeout",
          symbol: {
            type: "picture-marker",
            url: stakeoutSVG(),
            width: 20,
            height: 20,
          },
        },
        {
          value: "Gathering/Staging",
          label: "Gathering / Staging",
          symbol: {
            type: "picture-marker",
            url: bullseyeSVG(),
            width: 15,
            height: 15,
          },
        },
        {
          value: "Driving/Observed",
          label: "Driving / Observed",
          symbol: {
            type: "simple-marker",
            style: "circle",
            color: "black",
            outline: {
              // Outline properties (autocasts as SimpleLineSymbol)
              color: [255, 255, 255, 0.7], // White with transparency
              width: 1, // Outline width in points
            },
            size: 7,
          },
        },
        {
          value: "Drone",
          label: "Drone",
          symbol: {
            type: "picture-marker",
            url: droneSVG(),
            width: 18,
            height: 18,
          },
        },
        {
          value: "Helicopter",
          label: "Helicopter",
          symbol: {
            type: "picture-marker",
            url: helicopterSVG(),
            width: 15,
            height: 15,
          },
        },
        {
          value: "Misc/Unknown",
          label: "Misc / Unknown",
          symbol: {
            type: "simple-marker",
            style: "circle",
            color: "gray",
            size: 7,
            outline: { color: "black", width: 1 },
          },
        },
      ],
    };

    function svgToDataUrl(svg) {
      return "data:image/svg+xml;base64," + btoa(svg);
    }
    function hexagonSVG(fill) {
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
        `<polygon points="50,3 93,25 93,75 50,97 7,75 7,25" fill="${fill}" stroke="black" stroke-width="6"/>` +
        `</svg>`;
      return svgToDataUrl(svg);
    }
    function bullseyeSVG() {
      const svg = `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <!-- Outermost, thickest ring -->
      <circle cx="100" cy="100" r="90" fill="none" stroke="black" stroke-width="10"/>

      <!-- Middle ring -->
      <circle cx="100" cy="100" r="60" fill="none" stroke="black" stroke-width="3"/>

      <!-- Innermost, thinnest ring -->
      <circle cx="100" cy="100" r="30" fill="none" stroke="black" stroke-width="3"/>
    </svg>`;
      return svgToDataUrl(svg);
    }
    function stakeoutSVG() {
      const svg = `<svg width="100" height="100" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Watch Straps -->
      <path d="M16 3H8V7H16V3Z" fill="black"/>
      <path d="M16 17H8V21H16V17Z" fill="black"/>

      <!-- Watch Face -->
      <circle cx="12" cy="12" r="6" stroke="black" stroke-width="2"/>

      <!-- Watch Hands -->
      <path d="M12 9V12H15" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
      return svgToDataUrl(svg);
    }
    function droneSVG() {
      const svg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <!-- Center point is (100, 100) -->

      <!-- Thick black ring (annulus) -->
      <!-- Outer circle radius 40, inner circle radius 25 -->
      <circle cx="100" cy="100" r="25" fill="black"/>
      <circle cx="100" cy="100" r="15" fill="white"/>

      <!-- Three equally spaced ovals (fan blades) -->
      <!-- Each blade is rotated by 120 degrees relative to the center -->

      <!-- Blade 1 (top/vertical, rotated 0 deg) -->
      <!-- Placed to touch the outer edge of the ring -->
      <g transform="translate(100, 100) rotate(0)">
        <ellipse cx="0" cy="-70" rx="12" ry="45" fill="black"/>
      </g>

      <!-- Blade 2 (rotated 120 deg) -->
      <g transform="translate(100, 100) rotate(120)">
        <ellipse cx="0" cy="-70" rx="12" ry="45" fill="black"/>
      </g>

      <!-- Blade 3 (rotated 240 deg) -->
      <g transform="translate(100, 100) rotate(240)">
        <ellipse cx="0" cy="-70" rx="12" ry="45" fill="black"/>
      </g>
    </svg>`;
      return svgToDataUrl(svg);
    }
    function helicopterSVG() {
      // Use a simplified path and ensure all necessary XML attributes are present
      const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" image-rendering="optimizeQuality" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 512 286.813"><path d="M287.12 12.626h193.281a6.847 6.847 0 110 13.694H287.242v11.337h21.872a6.98 6.98 0 014.941 2.051 6.984 6.984 0 012.051 4.94v7.15c2.782.178 5.555.396 8.315.667 55.399 5.449 105.954 30.012 140.257 84.2 5.134 8.114 12.659 30.595 16.421 51.281 2.909 16.003 3.578 31.32-.698 39.208l-.008.016c-2.495 4.619-6.418 8.161-11.734 10.539-4.827 2.161-10.82 3.317-17.946 3.395h-.04v.019H425.39l11.846 29.106c12.503.476 23.835.188 33.726-2.117 10.346-2.411 19.261-7.146 26.547-15.822a8.202 8.202 0 0112.58 10.526c-9.85 11.731-21.721 18.088-35.405 21.278-12.733 2.969-26.862 3.084-42.368 2.319l-236.909.004v-.018c-12.695.544-22.933-.918-32.644-4.667-9.66-3.729-18.44-9.589-28.367-17.889a8.202 8.202 0 0110.527-12.58c8.622 7.209 16.021 12.211 23.746 15.193 6.232 2.407 12.925 3.587 20.959 3.664l12.186-33.771c.255-.714.6-1.368 1.016-1.959l-85.845-84.957H51.448l-18.475 56.598a3.585 3.585 0 01-3.471 2.696H3.572a5.369 5.369 0 01-.573-.057 3.572 3.572 0 01-2.952-4.099l10.463-64.339a30.051 30.051 0 01-7.014-19.329 30.061 30.061 0 016.662-18.908L.047 39.82a3.572 3.572 0 013.525-4.145l25.93-.011a3.585 3.585 0 013.471 2.696L52.11 96.987a30.63 30.63 0 012.917 2.563l.033.033c.377.378.744.767 1.102 1.165h61.652c33.923-17.727 72.362-32.656 111.574-41.336a3.628 3.628 0 01-.013-.297V44.648c0-1.773.68-3.406 1.792-4.648l.261-.291a6.973 6.973 0 014.94-2.052h21.871V26.32H65.082a6.848 6.848 0 010-13.694h193.279a14.499 14.499 0 014.135-8.369A14.469 14.469 0 01272.741 0c3.991 0 7.618 1.632 10.244 4.257a14.49 14.49 0 014.135 8.369zm120.581 228.497H217.445a8.18 8.18 0 01-.227.746l-10.145 28.115h212.344l-11.483-28.213a8.222 8.222 0 01-.233-.648zM33.693 101.748c10.579 0 19.155 8.576 19.155 19.154 0 10.58-8.576 19.155-19.155 19.155-10.578 0-19.153-8.575-19.153-19.155 0-10.578 8.575-19.154 19.153-19.154zm291.391-36.167c66.086 8.663 117.425 40.241 142.14 103.47h-142.14V65.581z"/></svg>`.trim();

      // Convert to Base64 to ensure compatibility with ArcGIS PictureMarkerSymbol
      const base64 = btoa(svgString);
      return `data:image/svg+xml;base64,${base64}`;
    }

    // --- Feature Layers ---
    const pointsLayer = new FeatureLayer({
      source: graphics,
      objectIdField: "objectid",
      fields: [
        { name: "objectid", type: "oid" },
        { name: "start_datetime_str", type: "string" },
        { name: "start_hour_min", type: "string" },
        { name: "simplified_activity", type: "string" },
        { name: "address", type: "string" },
        { name: "location_type", type: "string" },
        { name: "ice_license_plates", type: "string" },
        { name: "people_taken", type: "string" },
        { name: "agent_qty", type: "string" },
        { name: "vehicle_qty", type: "string" },
        { name: "additional_description", type: "string" },
        { name: "hourNumber", type: "integer" },
        { name: "activity_symbol_key", type: "string" },
      ],
      renderer,
      popupTemplate: {
        title: "{simplified_activity}",
        content: `<b>Date:</b> {start_datetime_str}<br>
        <b>Time Start:</b> {start_hour_min}<br>
        <b>Activity:</b> {simplified_activity}<br>
        <b>Address:</b> {address}<br>
        <b>Location Name:</b> {location_type}<br>
        <b>License Plates:</b> {ice_license_plates}<br>
        <b>People Taken:</b>{people_taken}<br>
        <b>Agent Quantity:</b> {agent_qty}<br>
        <b>Vehicle Quantity:</b> {vehicle_qty}<br>
        <b>Additional Description:</b> {additional_description}`,
      },
    });
    map.add(pointsLayer);

    const heatLayer = new FeatureLayer({
      source: graphics,
      objectIdField: "objectid",
      fields: [{ name: "objectid", type: "oid" }],
      renderer: {
        type: "heatmap",
        maxPixelIntensity: 50,
        minPixelIntensity: 1,
      },
      visible: false,
    });
    map.add(heatLayer);

    // --- UI Widgets ---
    const legend = new Legend({ view });
    const legendExpand = new Expand({ view, content: legend, expanded: true });
    view.ui.add(legendExpand, "bottom-right");

    const filtersExpand = new Expand({
      view,
      content: document.getElementById("controls"),
      expanded: true,
    });
    view.ui.add(filtersExpand, "top-left");

    // --- Controls ---
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");
    const applyDateBtn = document.getElementById("applyDate");
    const allDatesBtn = document.getElementById("allDates");
    const past3Btn = document.getElementById("past3Days");
    const past5Btn = document.getElementById("past5Days");
    const hourToggle = document.getElementById("hourToggle");
    const displayType = document.getElementById("displayType");
    const hourSliderContainer = document.getElementById("hourSliderContainer");
    const activityToggles = document.querySelectorAll("#activityToggles input");
    const hourLabelsDiv = document.getElementById("hourLabels");

    const hourSlider = new Slider({
      container: "hourSlider",
      min: 0,
      max: 23,
      steps: 1,
      values: [0],
      labelsVisible: false,
    });

    hourLabelsDiv.innerHTML = ""; // clear existing
    for (let h = 0; h <= 23; h++) {
      const label = document.createElement("span");
      label.innerText = h;
      hourLabelsDiv.appendChild(label);
    }

    // --- Filter Function ---
    const applyFilters = (hour = null) => {
      // const selectedActivities = Array.from(activityToggles)
      //   .filter((cb) => cb.checked)
      //   .map((cb) => cb.value);
      console.log({ selectedActivities });
      const start = startDateInput.value
        ? new Date(startDateInput.value).getTime()
        : null;
      const end = endDateInput.value
        ? new Date(endDateInput.value).getTime()
        : null;

      // Convert hour to number if not null
      const selectedHour = hour !== null ? Number(hour) : null;

      const expr = graphics
        .map((g) => {
          let dateOK = true;
          if (start && end) {
            dateOK =
              new Date(g.attributes.activity_date) >= start &&
              new Date(g.attributes.activity_date) <= end;
          }

          const activityOK = selectedActivities.includes(
            g.attributes.simplified_activity
          );
          const hourOK =
            selectedHour === null || g.attributes.hourNumber === selectedHour;

          return dateOK && activityOK && hourOK
            ? `objectid=${g.attributes.objectid}`
            : null;
        })
        .filter(Boolean);

      pointsLayer.definitionExpression = expr.length
        ? expr.join(" OR ")
        : "1=0";
      heatLayer.definitionExpression = expr.length ? expr.join(" OR ") : "1=0";

      if (displayType.value === "points") {
        pointsLayer.visible = true;
        heatLayer.visible = false;
      } else if (displayType.value === "heatmap") {
        pointsLayer.visible = false;
        heatLayer.visible = true;
      } else {
        pointsLayer.visible = true;
        heatLayer.visible = true;
      }
    };

    setApplyFilters(() => applyFilters);

    // --- Event Listeners ---
    applyDateBtn.addEventListener("click", () =>
      applyFilters(hourToggle.value === "hourly" ? hourSlider.values[0] : null)
    );
    allDatesBtn.addEventListener("click", () => {
      startDateInput.value = "";
      endDateInput.value = "";
      applyFilters(hourToggle.value === "hourly" ? hourSlider.values[0] : null);
    });
    past3Btn.addEventListener("click", () => {
      const now = new Date(),
        past = new Date();
      past.setDate(now.getDate() - 3);
      startDateInput.value = past.toISOString().split("T")[0];
      endDateInput.value = now.toISOString().split("T")[0];
      applyFilters(hourToggle.value === "hourly" ? hourSlider.values[0] : null);
    });
    past5Btn.addEventListener("click", () => {
      const now = new Date(),
        past = new Date();
      past.setDate(now.getDate() - 5);
      startDateInput.value = past.toISOString().split("T")[0];
      endDateInput.value = now.toISOString().split("T")[0];
      applyFilters(hourToggle.value === "hourly" ? hourSlider.values[0] : null);
    });
    activityToggles.forEach((cb) =>
      cb.addEventListener("change", () =>
        applyFilters(
          hourToggle.value === "hourly" ? hourSlider.values[0] : null
        )
      )
    );
    displayType.addEventListener("change", () =>
      applyFilters(hourToggle.value === "hourly" ? hourSlider.values[0] : null)
    );

    hourToggle.addEventListener("change", () => {
      //if(hourToggle.value==="hourly"){ hourSliderContainer.style.display="block"; animateHours(); }
      if (hourToggle.value === "hourly") {
        hourSliderContainer.style.display = "block";
      } else {
        hourSliderContainer.style.display = "none";
        applyFilters();
      }
    });
    hourSlider.on("thumb-drag", () => applyFilters(hourSlider.values[0]));
    hourSlider.on("thumb-drag-end", () => applyFilters(hourSlider.values[0]));

    // async function animateHours(){
    //   for(let h=0; h<24; h++){
    //     hourSlider.values=[h]; applyFilters(h);
    //     await new Promise(r=>setTimeout(r,500));
    //   }
    //   applyFilters();
    // }

    applyFilters();
  }, [selectedActivities]);

  console.log("render");

  return (
    <>
      <body>
        <div style={{ height, width }}>
          <div id="viewDiv"></div>
        </div>

        <div id="map-title">
          ICE Activity in the Twin Cities Metro Area (All Data table)
        </div>

        <div id="controls" className="filters-panel">
          <div className="filter-section">
            <label className="filter-label">Date Filter</label>
            <div className="date-row">
              <input type="date" id="startDate" />
              <input type="date" id="endDate" />
              <button id="applyDate" className="primary-btn">
                Apply
              </button>
            </div>
            <div className="preset-row">
              <button id="allDates">All Dates</button>
              <button id="past3Days">Past 3 Days</button>
              <button id="past5Days">Past 5 Days</button>
            </div>
          </div>

          <div className="filter-section">
            <label className="filter-label">Time View</label>
            <select id="hourToggle">
              <option value="all">All Hours</option>
              <option value="hourly">Hour slider</option>
            </select>
          </div>

          <div className="filter-section" id="hourSliderContainer">
            <label className="filter-label">Hour of Day</label>
            <div id="hourSlider"></div>
            <div id="hourLabels" className="slider-labels"></div>
          </div>

          <div className="filter-section">
            <label className="filter-label">Display Type</label>
            <select id="displayType">
              <option value="points">Points Only</option>
              <option value="heatmap">Heatmap Only</option>
              <option value="both">Points + Heatmap</option>
            </select>
          </div>

          <div className="filter-section">
            <label className="filter-label">Activities</label>
            <div className="checkbox-grid" id="activityToggles">
              {ACTIVITIES.map((activity) => (
                <label key={activity}>
                  <input
                    type="checkbox"
                    value={activity}
                    checked={selectedActivities.includes(activity)}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setSelectedActivities((prev) => {
                        if (isChecked) {
                          return [...prev, activity];
                        } else {
                          return prev.filter((a) => a !== activity);
                        }
                      });
                    }}
                  />{" "}
                  {activity}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div id="disclaimer">
          <h3 style={{ margin: 0 }}>
            These data are crowdsourced &lt;3 and do not represent the entirety
            of ICE activity in the area.
          </h3>
          This map is for informational purposes only and its organizers do not
          condone its use to forcibly assault, resist, oppose, impede, or
          interfere with the official duties of any officer or employee of the
          United States or of any agency in any branch of the United States
          Government, while engaged in or on account of the performance of
          official duties.
        </div>
      </body>
    </>
  );
}

initializeBlock(() => <HelloWorldTypescriptApp />);
