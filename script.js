/* ==========================================================================
   AEF & TESSERA Spatial Comparator — Application logic
   Depends on: Leaflet (leaflet.js) and html2canvas, loaded in index.html
   ========================================================================== */

// ── State ──────────────────────────────────────────────────────────────────
let currentMode = 'comparaison'; // 'comparaison' | 'binaire' | 'combinaison' | 'risque' | 'inondation' | 'glissement'
let layerInondation = null;
let layerGlissement = null;
let risqueLoaded    = false;

let combinaisonLoaded = false;
let combinaisonGroup = L.layerGroup();

// ── Map setup ──────────────────────────────────────────────────────────────
const map = L.map('map', {
    zoomControl: false,
    minZoom: 2,
    maxZoom: 20
}).setView([46.603354, 1.888334], 6);

L.control.zoom({ position: 'topright' }).addTo(map);

L.control.scale({
position: 'bottomleft',
metric: true,
imperial: false,
maxWidth: 250 
}).addTo(map);

const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
});

const googleSatelliteLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '© Google Maps'
}).addTo(map);

const layerControl = L.control.layers({
    "Google Satellite": googleSatelliteLayer,
    "OpenStreetMap": osmLayer
}, {}, { position: 'topright' }).addTo(map);

// ── Panes ──────────────────────────────────────────────────────────────────
map.createPane('leftPane');
map.createPane('rightPane');
map.createPane('riskPane');

map.getPane('leftPane').style.zIndex  = 400;
map.getPane('rightPane').style.zIndex = 400;
map.getPane('riskPane').style.zIndex  = 350;

// ── Style functions ────────────────────────────────────────────────────────
function styleFeature(feature) {
    const val = feature.properties.valeur_pixel;
    let polygonColor = 'gray';
    if (val === 1) polygonColor = '#4FB0C6';
    if (val === 2) polygonColor = '#F5F5DC';
    if (val === 3) polygonColor = '#BC4749';
    return { fillColor: polygonColor, weight: 0, fillOpacity: 0.55 };
}

function styleBinaryFeature(feature) {
    const val = feature.properties.valeur_pixel;
    if (val === 3) {
        return { fillColor: '#FF69B4', weight: 0, fillOpacity: 0.85 };
    }
    return { fillColor: 'transparent', weight: 0, fillOpacity: 0 };
}

function styleRisqueFeature(feature) {
    const val = feature.properties.valeur_pixel;
    const colorMap = {
        1: '#8B0000',
        2: '#FF6B6B',
        3: '#FF6B6B',
        4: '#FFD700',
        5: '#1E3A8A',
        6: '#3B82F6',
        7: '#3B82F6',
        8: '#BFDBFE'
    };
    const color = colorMap[val] || 'transparent';
    return { fillColor: color, weight: 0, fillOpacity: color === 'transparent' ? 0 : 0.75 };
}

function styleInondation(feature) {
    let niveau = String(feature.properties.lb_niveau || '').toLowerCase().trim();
    let color = '#3b82f6';
    if (niveau === 'faible') color = '#93c5fd';
    else if (niveau === 'moyen') color = '#3b82f6';
    else if (niveau === 'fort')  color = '#1e3a8a';
    return { fillColor: color, weight: 0, fillOpacity: 0.65 };
}

function styleGlissement(feature) {
    let niveau = String(feature.properties.lb_niveau || '').toLowerCase().trim();
    let color = '#f97316';
    if (niveau === 'faible') color = '#fde047';
    else if (niveau === 'moyen') color = '#f97316';
    else if (niveau === 'fort')  color = '#dc2626';
    return { fillColor: color, weight: 0, fillOpacity: 0.6 };
}

// ── Legend sync ────────────────────────────────────────────────────────────
function syncLegends() {
    const ids = ['legend-base', 'legend-binaire', 'legend-risque', 'legend-inondation', 'legend-glissement', 'legend-combinaison'];
    ids.forEach(id => document.getElementById(id).classList.add('hidden'));

    if (currentMode === 'comparaison') {
        document.getElementById('legend-base').classList.remove('hidden');
        if (layerInondation && map.hasLayer(layerInondation))
            document.getElementById('legend-inondation').className = 'mt-4 pt-4 border-t border-outline-variant/20 block';
        if (layerGlissement && map.hasLayer(layerGlissement))
            document.getElementById('legend-glissement').className = 'mt-4 pt-4 border-t border-outline-variant/20 block';
    } else if (currentMode === 'binaire') {
        document.getElementById('legend-binaire').classList.remove('hidden');
        if (layerInondation && map.hasLayer(layerInondation))
            document.getElementById('legend-inondation').className = 'mt-4 pt-4 border-t border-outline-variant/20 block';
        if (layerGlissement && map.hasLayer(layerGlissement))
            document.getElementById('legend-glissement').className = 'mt-4 pt-4 border-t border-outline-variant/20 block';
    } else if (currentMode === 'combinaison') {
        document.getElementById('legend-combinaison').classList.remove('hidden');
        if (layerInondation && map.hasLayer(layerInondation))
            document.getElementById('legend-inondation').className = 'mt-4 pt-4 border-t border-outline-variant/20 block';
        if (layerGlissement && map.hasLayer(layerGlissement))
            document.getElementById('legend-glissement').className = 'mt-4 pt-4 border-t border-outline-variant/20 block';
    } else if (currentMode === 'risque') {
        document.getElementById('legend-risque').classList.remove('hidden');
    } else if (currentMode === 'inondation') {
        document.getElementById('legend-inondation').classList.remove('hidden');
    } else if (currentMode === 'glissement') {
        document.getElementById('legend-glissement').classList.remove('hidden');
    }
}

map.on('overlayadd overlayremove', syncLegends);

// ── Risk / natural hazard layers ───────────────────────────────────────────
fetch('l_zone_alea_inondation_debordement_s_976.json')
    .then(res => res.json())
    .then(data => {
        layerInondation = L.geoJSON(data, { style: styleInondation, pane: 'riskPane' });
        layerControl.addOverlay(layerInondation, "🌊 Flood Risk");
        if (currentMode === 'inondation') map.addLayer(layerInondation);
    })
    .catch(err => console.warn("Flood file not found:", err));

fetch('l_glissement_terrain_s_976.json')
    .then(res => res.json())
    .then(data => {
        layerGlissement = L.geoJSON(data, { style: styleGlissement, pane: 'riskPane' });
        layerControl.addOverlay(layerGlissement, "⛰️ Landslide Risk");
        if (currentMode === 'glissement') map.addLayer(layerGlissement);
    })
    .catch(err => console.warn("Landslide file not found:", err));

// ── Probability layers config ──────────────────────────────────────────────
const config = {
    AEF: {
        '1x':  { file: 'AEF_masked.geojson',     layer: null },
        '6x':  { file: 'AEF_masked_6x.geojson',  layer: null },
        '24x': { file: 'AEF_masked_24x.geojson', layer: null }
    },
    TESSERA: {
        '1x':  { file: 'TESSERA_masked.geojson',     layer: null },
        '6x':  { file: 'TESSERA_masked_6x.geojson',  layer: null },
        '24x': { file: 'TESSERA_masked_24x.geojson', layer: null }
    }
};

const configBinary = {
    AEF: {
        '1x':  { file: 'AEF_masked.geojson',     layer: null },
        '6x':  { file: 'AEF_masked_6x.geojson',  layer: null },
        '24x': { file: 'AEF_masked_24x.geojson', layer: null }
    },
    TESSERA: {
        '1x':  { file: 'TESSERA_masked.geojson',     layer: null },
        '6x':  { file: 'TESSERA_masked_6x.geojson',  layer: null },
        '24x': { file: 'TESSERA_masked_24x.geojson', layer: null }
    }
};

let leftLayerGroup  = L.layerGroup().addTo(map);
let rightLayerGroup = L.layerGroup().addTo(map);
let leftBinaryGroup  = L.layerGroup();
let rightBinaryGroup = L.layerGroup();

let leftRisqueGroup  = L.layerGroup();
let rightRisqueGroup = L.layerGroup();

let firstLoad = true;

// ── Layer loading helpers ──────────────────────────────────────────────────
async function loadLayer(target, paneName) {
    if (!target.layer) {
        try {
            const response = await fetch(target.file);
            if (response.ok) {
                const data = await response.json();
                target.layer = L.geoJSON(data, { style: styleFeature, pane: paneName });
            }
        } catch (e) {
            console.warn(`Layer ${target.file} could not be loaded.`, e);
        }
    }
    return target.layer;
}

async function loadBinaryLayer(target, paneName) {
    if (!target.layer) {
        try {
            const response = await fetch(target.file);
            if (response.ok) {
                const data = await response.json();
                target.layer = L.geoJSON(data, { style: styleBinaryFeature, pane: paneName });
            }
        } catch (e) {
            console.warn(`Binary layer ${target.file} could not be loaded.`, e);
        }
    }
    return target.layer;
}

async function loadRisqueLayers() {
    if (risqueLoaded) return;
    showToast("Loading composite risk layers…");
    try {
        const [resAef, resTessera] = await Promise.all([
            fetch('risque_AE.json'),
            fetch('risque_TESS.json')
        ]);
        if (resAef.ok && resTessera.ok) {
            const dataAef     = await resAef.json();
            const dataTessera = await resTessera.json();
            L.geoJSON(dataAef,     { style: styleRisqueFeature, pane: 'leftPane'  }).addTo(leftRisqueGroup);
            L.geoJSON(dataTessera, { style: styleRisqueFeature, pane: 'rightPane' }).addTo(rightRisqueGroup);
            risqueLoaded = true;
            const bounds = leftRisqueGroup.getBounds();
            if (bounds && bounds.isValid()) map.fitBounds(bounds);
            showToast("Composite risk layers loaded!");
        } else {
            showToast("Files risque_AE.json / risque_TESS.json not found.");
        }
    } catch (e) {
        console.warn("Error loading composite risk layers:", e);
        showToast("Error loading composite risk layers.");
    }
}

async function loadCombinaisonLayer() {
    if (combinaisonLoaded) return;
    showToast("Loading combination layer...");
    try {
        const response = await fetch('lissage_combinaison2.json');
        if (response.ok) {
            const data = await response.json();
            L.geoJSON(data, { style: styleFeature }).addTo(combinaisonGroup);
            combinaisonLoaded = true;
            const bounds = combinaisonGroup.getBounds();
            if (bounds && bounds.isValid()) map.fitBounds(bounds);
            showToast("Combination layer loaded!");
        } else {
            showToast("File lissage_combinaison2.json not found.");
        }
    } catch (e) {
        console.warn("Error loading combination layer:", e);
        showToast("Error loading combination layer.");
    }
}

// ── Zoom & update ──────────────────────────────────────────────────────────
function updateZoomText() {
    const zoom = map.getZoom();
    let resolution = '24x';
    if (zoom >= 17)   resolution = '1x';
    else if (zoom === 16) resolution = '6x';

    let textInfo = `Current zoom: <b>${zoom}</b><br>`;
    if      (currentMode === 'comparaison') textInfo += `Active file: <b>Probabilities (${resolution})</b>`;
    else if (currentMode === 'binaire')     textInfo += `Active file: <b>High probability (${resolution})</b>`;
    else if (currentMode === 'combinaison') textInfo += `Active file: <b>Combination of the 2 models</b>`;
    else if (currentMode === 'risque')      textInfo += `Active file: <b>Informality/Risk typology</b>`;
    else if (currentMode === 'inondation')  textInfo += `Active file: <b>Flood</b>`;
    else if (currentMode === 'glissement')  textInfo += `Active file: <b>Landslide</b>`;

    document.getElementById('zoomInfo').innerHTML = textInfo;
    return resolution;
}

async function updateMapLayers() {
    const resolution = updateZoomText();

    if (currentMode === 'comparaison') {
        const [leftL, rightL] = await Promise.all([
            loadLayer(config.AEF[resolution],    'leftPane'),
            loadLayer(config.TESSERA[resolution], 'rightPane')
        ]);
        leftLayerGroup.clearLayers();
        rightLayerGroup.clearLayers();
        if (leftL)  leftLayerGroup.addLayer(leftL);
        if (rightL) rightLayerGroup.addLayer(rightL);

        if (firstLoad && leftL) {
            const bounds = leftL.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds);
                firstLoad = false;
            }
        }

    } else if (currentMode === 'binaire') {
        const [leftL, rightL] = await Promise.all([
            loadBinaryLayer(configBinary.AEF[resolution],    'leftPane'),
            loadBinaryLayer(configBinary.TESSERA[resolution], 'rightPane')
        ]);
        leftBinaryGroup.clearLayers();
        rightBinaryGroup.clearLayers();
        if (leftL)  leftBinaryGroup.addLayer(leftL);
        if (rightL) rightBinaryGroup.addLayer(rightL);

        if (firstLoad && leftL) {
            const bounds = leftL.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds);
                firstLoad = false;
            }
        }
    }

    applyClip();
}

// ── Mode switching ─────────────────────────────────────────────────────────
function setMode(mode) {
    currentMode = mode;

    const activeClass   = ["bg-primary-container", "text-on-primary-container", "active:opacity-80"];
    const inactiveClass = ["hover:bg-surface-container-high", "text-on-surface"];

    const btns = {
        'comparaison': document.getElementById('btn-comparaison'),
        'binaire':     document.getElementById('btn-binaire'),
        'combinaison': document.getElementById('btn-combinaison'),
        'risque':      document.getElementById('btn-risque'),
        'inondation':  document.getElementById('btn-inondation'),
        'glissement':  document.getElementById('btn-glissement')
    };

    for (const [key, btn] of Object.entries(btns)) {
        if (key === mode) {
            btn.classList.remove(...inactiveClass);
            btn.classList.add(...activeClass);
        } else {
            btn.classList.remove(...activeClass);
            btn.classList.add(...inactiveClass);
        }
    }

    const usesSlider = (mode === 'comparaison' || mode === 'binaire' || mode === 'risque');
    document.getElementById('slider-line').style.display   = usesSlider ? 'block' : 'none';
    document.getElementById('label-aef').style.display     = usesSlider ? 'block' : 'none';
    document.getElementById('label-tessera').style.display = usesSlider ? 'block' : 'none';

    map.removeLayer(leftLayerGroup);
    map.removeLayer(rightLayerGroup);
    map.removeLayer(leftBinaryGroup);
    map.removeLayer(rightBinaryGroup);
    map.removeLayer(leftRisqueGroup);
    map.removeLayer(rightRisqueGroup);
    map.removeLayer(combinaisonGroup);
    if (layerInondation && map.hasLayer(layerInondation)) map.removeLayer(layerInondation);
    if (layerGlissement && map.hasLayer(layerGlissement)) map.removeLayer(layerGlissement);

    if (mode === 'comparaison') {
        map.addLayer(leftLayerGroup);
        map.addLayer(rightLayerGroup);
        updateMapLayers();
    } else if (mode === 'binaire') {
        map.addLayer(leftBinaryGroup);
        map.addLayer(rightBinaryGroup);
        updateMapLayers();
    } else if (mode === 'combinaison') {
        map.addLayer(combinaisonGroup);
        loadCombinaisonLayer();
    } else if (mode === 'risque') {
        map.addLayer(leftRisqueGroup);
        map.addLayer(rightRisqueGroup);
        loadRisqueLayers();
    } else if (mode === 'inondation') {
        if (layerInondation) map.addLayer(layerInondation);
    } else if (mode === 'glissement') {
        if (layerGlissement) map.addLayer(layerGlissement);
    }

    updateZoomText();
    syncLegends();
    applyClip();
}

document.getElementById('btn-comparaison').addEventListener('click', () => setMode('comparaison'));
document.getElementById('btn-binaire').addEventListener('click',     () => setMode('binaire'));
document.getElementById('btn-combinaison').addEventListener('click', () => setMode('combinaison'));
document.getElementById('btn-risque').addEventListener('click',      () => setMode('risque'));
document.getElementById('btn-inondation').addEventListener('click',  () => setMode('inondation'));
document.getElementById('btn-glissement').addEventListener('click',  () => setMode('glissement'));

// ── Slider / clip ──────────────────────────────────────────────────────────
const BIG = 99999;
let currentPercent = 50;
const sliderLine   = document.getElementById('slider-line');

function applyClip() {
    const mapSize  = map.getSize();
    const sliderPx = mapSize.x * currentPercent / 100;
    const layerPoint = map.containerPointToLayerPoint(L.point(sliderPx, 0));
    const x = layerPoint.x;

    const leftPane  = map.getPane('leftPane');
    const rightPane = map.getPane('rightPane');
    if (!leftPane || !rightPane) return;

    leftPane.style.clipPath  = `polygon(${-BIG}px ${-BIG}px, ${x}px ${-BIG}px, ${x}px ${BIG}px, ${-BIG}px ${BIG}px)`;
    rightPane.style.clipPath = `polygon(${x}px ${-BIG}px, ${BIG}px ${-BIG}px, ${BIG}px ${BIG}px, ${x}px ${BIG}px)`;

    sliderLine.style.left = `${currentPercent}%`;
}

map.on('move zoom moveend zoomend resize', applyClip);
map.on('zoomend', updateMapLayers);

let isSliding = false;
sliderLine.addEventListener('mousedown', (e) => {
    isSliding = true;
    e.preventDefault();
    map.dragging.disable();
    document.body.style.cursor = 'ew-resize';
});
window.addEventListener('mouseup', () => {
    if (!isSliding) return;
    isSliding = false;
    map.dragging.enable();
    document.body.style.cursor = 'default';
});
window.addEventListener('mousemove', (e) => {
    if (!isSliding) return;
    const mapRect = document.getElementById('map').getBoundingClientRect();
    let percent = ((e.clientX - mapRect.left) / mapRect.width) * 100;
    currentPercent = Math.max(0, Math.min(100, percent));
    applyClip();
});

// ── Toast ──────────────────────────────────────────────────────────────────
const toast        = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

function showToast(message) {
    toastMessage.textContent = message;
    toast.style.opacity   = '1';
    toast.style.transform = 'translate(-50%, 0)';
    setTimeout(() => {
        toast.style.opacity   = '0';
        toast.style.transform = 'translate(-50%, -20px)';
    }, 3000);
}

// ── Share ──────────────────────────────────────────────────────────────────
const shareButton   = document.getElementById('share-button');
const shareDropdown = document.getElementById('share-dropdown');

shareButton.addEventListener('click', (e) => {
    e.stopPropagation();
    shareDropdown.classList.toggle('hidden');
    shareDropdown.classList.toggle('show');
});
document.addEventListener('click', () => {
    shareDropdown.classList.add('hidden');
    shareDropdown.classList.remove('show');
});

document.getElementById('btn-copy-link').addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href).then(() => showToast('Page link copied!'));
});

document.getElementById('btn-export-map').addEventListener('click', async () => {
    const mapElement = document.getElementById('map');
    const controls   = document.querySelectorAll('.leaflet-control-container, #slider-line, .absolute');
    controls.forEach(el => el.style.visibility = 'hidden');
    try {
        const canvas = await html2canvas(mapElement, { useCORS: true, allowTaint: true, backgroundColor: null, scale: 2 });
        const link = document.createElement('a');
        link.download = `terra-map-export-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Export successful!');
    } catch (err) {
        showToast("Export error");
    } finally {
        controls.forEach(el => el.style.visibility = 'visible');
    }
});

// ── Shared tooltip positioner ──────────────────────────────────────────────
function positionTooltip(el, e) {
    const tw = el.offsetWidth  || 260;
    const th = el.offsetHeight || 100;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = e.clientX + 12;
    let y = e.clientY - th - 8;
    if (x + tw > vw - 8) x = e.clientX - tw - 12;
    if (y < 8)            y = e.clientY + 20;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
}

// ── ISP info tooltip ───────────────────────────────────────────────────────
const phiIcon    = document.getElementById('phi-info-icon');
const phiTooltip = document.getElementById('phi-tooltip');

phiIcon.addEventListener('mouseenter', (e) => {
    phiTooltip.style.display = 'block';
    requestAnimationFrame(() => { phiTooltip.style.opacity = '1'; });
    positionTooltip(phiTooltip, e);
});
phiIcon.addEventListener('mousemove',  (e) => positionTooltip(phiTooltip, e));
phiIcon.addEventListener('mouseleave', () => {
    phiTooltip.style.opacity = '0';
    setTimeout(() => { phiTooltip.style.display = 'none'; }, 150);
});

// ── Combination info tooltip ───────────────────────────────────────────────
const combinaisonIcon    = document.getElementById('combinaison-info-icon');
const combinaisonTooltip = document.getElementById('combinaison-tooltip');

combinaisonIcon.addEventListener('mouseenter', (e) => {
    combinaisonTooltip.style.display = 'block';
    requestAnimationFrame(() => { combinaisonTooltip.style.opacity = '1'; });
    positionTooltip(combinaisonTooltip, e);
});
combinaisonIcon.addEventListener('mousemove',  (e) => positionTooltip(combinaisonTooltip, e));
combinaisonIcon.addEventListener('mouseleave', () => {
    combinaisonTooltip.style.opacity = '0';
    setTimeout(() => { combinaisonTooltip.style.display = 'none'; }, 150);
});

// ── Flood info tooltip ──────────────────────────────────────────────────────
const inondationIcon    = document.getElementById('inondation-info-icon');
const inondationTooltip = document.getElementById('inondation-tooltip');
let inondationHideTimer = null;

inondationIcon.addEventListener('mouseenter', (e) => {
    clearTimeout(inondationHideTimer);
    inondationTooltip.style.display = 'block';
    requestAnimationFrame(() => { inondationTooltip.style.opacity = '1'; });
    positionTooltip(inondationTooltip, e);
});
inondationIcon.addEventListener('mousemove',  (e) => positionTooltip(inondationTooltip, e));
inondationIcon.addEventListener('mouseleave', () => {
    inondationHideTimer = setTimeout(() => {
        inondationTooltip.style.opacity = '0';
        setTimeout(() => { inondationTooltip.style.display = 'none'; }, 150);
    }, 120);
});
inondationTooltip.addEventListener('mouseenter', () => clearTimeout(inondationHideTimer));
inondationTooltip.addEventListener('mouseleave', () => {
    inondationHideTimer = setTimeout(() => {
        inondationTooltip.style.opacity = '0';
        setTimeout(() => { inondationTooltip.style.display = 'none'; }, 150);
    }, 120);
});

// ── Landslide info tooltip ───────────────────────────────────────────────────
const glissementIcon    = document.getElementById('glissement-info-icon');
const glissementTooltip = document.getElementById('glissement-tooltip');
let glissementHideTimer = null;

glissementIcon.addEventListener('mouseenter', (e) => {
    clearTimeout(glissementHideTimer);
    glissementTooltip.style.display = 'block';
    requestAnimationFrame(() => { glissementTooltip.style.opacity = '1'; });
    positionTooltip(glissementTooltip, e);
});
glissementIcon.addEventListener('mousemove',  (e) => positionTooltip(glissementTooltip, e));
glissementIcon.addEventListener('mouseleave', () => {
    glissementHideTimer = setTimeout(() => {
        glissementTooltip.style.opacity = '0';
        setTimeout(() => { glissementTooltip.style.display = 'none'; }, 150);
    }, 120);
});
glissementTooltip.addEventListener('mouseenter', () => clearTimeout(glissementHideTimer));
glissementTooltip.addEventListener('mouseleave', () => {
    glissementHideTimer = setTimeout(() => {
        glissementTooltip.style.opacity = '0';
        setTimeout(() => { glissementTooltip.style.display = 'none'; }, 150);
    }, 120);
});

// ── Init ───────────────────────────────────────────────────────────────────
applyClip();
updateMapLayers();
