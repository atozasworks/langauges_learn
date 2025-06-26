// --- MapLibre GL JS Map initialization with multiple base layers ---

// Distance calculation state
let distanceMode = false;
let distancePoints = [];
let distanceMarkers = [];
let distanceLine = null;

function haversineDistance(coord1, coord2) {
    // Coordinates in [lng, lat]
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371e3; // Earth radius in meters
    const lat1 = toRad(coord1[1]);
    const lat2 = toRad(coord2[1]);
    const dLat = toRad(coord2[1] - coord1[1]);
    const dLng = toRad(coord2[0] - coord1[0]);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // meters
}

function clearDistance() {
    distancePoints = [];
    distanceMarkers.forEach(m => m.remove());
    distanceMarkers = [];
    if (distanceLine) {
        map.removeLayer('distance-line');
        map.removeSource('distance-line');
        distanceLine = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const distBtn = document.getElementById('distance-btn');
    if (distBtn) {
        distBtn.addEventListener('click', () => {
            distanceMode = !distanceMode;
            clearDistance();
            if (distanceMode) {
                distBtn.textContent = 'Exit Distance';
                const popup = document.getElementById('popup');
                if (popup) {
                    popup.innerHTML = 'Click two points on the map to measure distance.';
                    popup.style.display = 'block';
                }
            } else {
                distBtn.textContent = 'Distance';
                const popup = document.getElementById('popup');
                if (popup) popup.style.display = 'none';
            }
        });
    }
});

const MAPTILER_KEY = 'get_your_own_D6rA4zTHduk6KOKTXzGB'; // Replace with your own MapTiler key for production
const ORS_API_KEY = '5b3ce3597851110001cf62481c8952d8ae844bd098a6491f0905701c'; // OpenRouteService key
const mapStyles = {
    Streets: `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`,
    Satellite: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
    Dark: `https://api.maptiler.com/maps/darkmatter/style.json?key=${MAPTILER_KEY}`,
    Light: `https://api.maptiler.com/maps/positron/style.json?key=${MAPTILER_KEY}`
};
let currentStyle = 'Streets';
const map = new maplibregl.Map({
    container: 'map',
    style: mapStyles[currentStyle],
    center: [78, 21],
    zoom: 4,
    attributionControl: false
});

map.on('click', (e) => {
    if (distanceMode) {
        if (distancePoints.length < 2) {
            const lngLat = [e.lngLat.lng, e.lngLat.lat];
            distancePoints.push(lngLat);
            const marker = new maplibregl.Marker({color: 'red'}).setLngLat(lngLat).addTo(map);
            distanceMarkers.push(marker);
            if (distancePoints.length === 2) {
    // Use OSRM to get the route and distance along streets
    (async () => {
        const start = distancePoints[0];
        const end = distancePoints[1];
        const coords = [start, end].map(pt => pt.join(",")).join(";");
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Routing service error');
            const data = await res.json();
            if (data.routes && data.routes[0]) {
                // Remove old line if present
                if (map.getSource('distance-line')) {
                    map.removeLayer('distance-line');
                    map.removeSource('distance-line');
                }
                map.addSource('distance-line', {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: data.routes[0].geometry.coordinates
                        }
                    }
                });
                map.addLayer({
                    id: 'distance-line',
                    type: 'line',
                    source: 'distance-line',
                    layout: {},
                    paint: {
                        'line-color': '#ff0000',
                        'line-width': 3
                    }
                });
                const dist = data.routes[0].distance;
                const popup = document.getElementById('popup');
                if (popup) {
                    popup.innerHTML = `Route distance: ${(dist/1000).toFixed(2)} km`;
                    popup.style.display = 'block';
                }
            } else {
                const popup = document.getElementById('popup');
                if (popup) {
                    popup.innerHTML = 'No route found.';
                    popup.style.display = 'block';
                }
            }
        } catch (err) {
            const popup = document.getElementById('popup');
            if (popup) {
                popup.innerHTML = 'Error: Could not get route.';
                popup.style.display = 'block';
            }
        }
        // Reset after short delay
        setTimeout(() => {
            clearDistance();
            distanceMode = false;
            const distBtn = document.getElementById('distance-btn');
            if (distBtn) distBtn.textContent = 'Distance';
        }, 6000);
    })();
}
        }
        return;
    }
    // --- Existing click handler logic below ---
    clearMarkers();
    const lngLat = [e.lngLat.lng, e.lngLat.lat];
    addMarker(lngLat, `Coordinates:<br>${lngLat[1].toFixed(5)}, ${lngLat[0].toFixed(5)}`);
});

// --- Function to apply Indian worldview filter ---
function applyIndianWorldview() {
    const layers = map.getStyle().layers;
    // This filter shows borders claimed by India (IN) and all undisputed borders (those without a 'claimed_by' tag).
    const indianWorldviewFilter = ['any', ['==', 'claimed_by', 'IN'], ['!', ['has', 'claimed_by']]];

    for (const layer of layers) {
        // Apply filter to all layers that represent country boundaries.
        // These layers often have IDs like 'boundary-country', 'admin-0-boundary', etc.
        // We check for 'boundary' in the layer ID and that the layer type is a 'line'.
        if (layer.id.includes('boundary') && layer.type === 'line') {
            map.setFilter(layer.id, indianWorldviewFilter);
        }
    }
}

// Apply the filter when the map style loads (initially and on style change)
map.on('style.load', () => {
    applyIndianWorldview();
});

// Attribution
map.addControl(new maplibregl.AttributionControl({
    compact: true,
    customAttribution: 'Map data © OpenStreetMap contributors | Tiles & style © MapLibre, Stadia Maps'
}), 'bottom-left');

// Zoom and rotation controls
map.addControl(new maplibregl.NavigationControl(), 'top-right');

// --- Layer Switcher UI ---
const header = document.querySelector('header');
const layerSwitcher = document.createElement('select');
layerSwitcher.id = 'layer-switcher';
for (const key of Object.keys(mapStyles)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    layerSwitcher.appendChild(opt);
}
layerSwitcher.value = currentStyle;
layerSwitcher.title = 'Switch base map style';
header.appendChild(layerSwitcher);
layerSwitcher.addEventListener('change', (e) => {
    currentStyle = e.target.value;
    map.setStyle(mapStyles[currentStyle]);
});

// --- User Location ---
const locateBtn = document.createElement('button');
locateBtn.id = 'locate-btn';
locateBtn.title = 'Go to my location';
locateBtn.innerHTML = '📍';
header.appendChild(locateBtn);
locateBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            map.flyTo({ center: [longitude, latitude], zoom: 15 });
            addMarker([longitude, latitude], 'My Location');
        }, () => alert('Unable to access location'));
    } else {
        alert('Geolocation not supported');
    }
});

// --- Markers & Popups ---
let markers = [];
function clearMarkers() {
    markers.forEach(m => m.remove());
    markers = [];
}
function addMarker(lngLat, popupText) {
    const marker = new maplibregl.Marker({ color: '#2e7dff' })
        .setLngLat(lngLat)
        .addTo(map);
    if (popupText) {
        marker.setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`<strong>${popupText}</strong>`));
    }
    markers.push(marker);
    return marker;
}
// Click on map to add marker
map.on('click', (e) => {
    clearMarkers();
    const lngLat = [e.lngLat.lng, e.lngLat.lat];
    addMarker(lngLat, `Coordinates:<br>${lngLat[1].toFixed(5)}, ${lngLat[0].toFixed(5)}`);
});

// --- Search & Geocoding ---
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const popup = document.getElementById('popup');

searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;
    clearMarkers(); // Clear previous markers
    popup.innerHTML = 'Searching...';
    popup.style.display = 'block';

    try {
        // Use Nominatim's search API directly with proper headers
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`;
        
        const res = await fetch(url, {
            headers: {
                'Accept-Language': 'en',
                'User-Agent': 'YourAppName/1.0 (your@email.com)' // Required by Nominatim's usage policy
            }
        });
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();

        if (data && data.length > 0) {
            // Fly to the first result
            const firstResult = data[0];
            const lng = parseFloat(firstResult.lon);
            const lat = parseFloat(firstResult.lat);
            
            map.flyTo({ 
                center: [lng, lat],
                zoom: 14 
            });

            // Add markers for all results
            data.forEach((place, index) => {
                const lng = parseFloat(place.lon);
                const lat = parseFloat(place.lat);
                const displayName = place.display_name || `Location ${index + 1}`;
                addMarker([lng, lat], displayName);
            });
            
            popup.innerHTML = `Found ${data.length} result(s). Click on a marker for details.`;
        } else {
            popup.innerHTML = 'No results found. Try a different search term.';
        }
    } catch (err) {
        console.error('Search error:', err);
        popup.innerHTML = 'Error: Could not complete search. Please try again later.';
    }
});

// Hide popup when clicking on map background
map.on('movestart', () => {
    popup.style.display = 'none';
});

// --- Routing (Directions) ---
const directionsBtn = document.createElement('button');
directionsBtn.id = 'directions-btn';
directionsBtn.title = 'Get Directions';
directionsBtn.innerHTML = '🗺️';
header.appendChild(directionsBtn);
let routingStart = null;
let routingEnd = null;
let routeLayerId = null;
let waypoints = [];

// Helper to clear waypoints
function clearWaypoints() {
    waypoints = [];
}

directionsBtn.addEventListener('click', () => {
    popup.innerHTML = 'Click on start, then end point on map.';
    popup.style.display = 'block';
    clearMarkers();
    routingStart = null;
    routingEnd = null;
    clearWaypoints();
    map.once('click', (e1) => {
        routingStart = [e1.lngLat.lng, e1.lngLat.lat];
        addMarker(routingStart, 'Start');
        map.once('click', (e2) => {
            routingEnd = [e2.lngLat.lng, e2.lngLat.lat];
            addMarker(routingEnd, 'End');
            getRoute(routingStart, routingEnd, waypoints);
        });
    });
});
async function getRoute(start, end, waypoints = []) {
    // Build coordinate string: start;waypoint1;waypoint2;...;end
    const coords = [start, ...waypoints, end].map(pt => pt.join(",")).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Routing error: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        if (data.routes && data.routes[0]) {
            // Remove old route layer if present
            if (routeLayerId && map.getLayer(routeLayerId)) {
                map.removeLayer(routeLayerId);
            }
            if (routeLayerId && map.getSource(routeLayerId)) {
                map.removeSource(routeLayerId);
            }
            // Add route as a new layer
            routeLayerId = `route-${Date.now()}`;
            
            // Add new route using OSRM geometry
            const routeCoords = data.routes[0].geometry.coordinates;
            map.addSource(routeLayerId, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: routeCoords
                    }
                }
            });
            
            map.addLayer({
                id: routeLayerId,
                type: 'line',
                source: routeLayerId,
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#ffff00',
                    'line-width': 4
                }
            });
            // Always show all markers
            clearMarkers();
            addMarker(start, 'Start');
            waypoints.forEach((wp, i) => addMarker(wp, `Waypoint ${i+1}`));
            addMarker(end, 'End');

            // --- Add waypoint by clicking on the polyline ---
            map.once('click', function onRouteClick(e) {
                const features = map.queryRenderedFeatures(e.point, { layers: [routeLayerId] });
                if (features.length > 0) {
                    // Find nearest segment to insert the waypoint
                    let minDist = Infinity, insertIdx = 0;
                    for (let i = 0; i < routeCoords.length - 1; i++) {
                        const segStart = routeCoords[i];
                        const segEnd = routeCoords[i+1];
                        // Project click onto segment
                        const t = Math.max(0, Math.min(1, ((e.lngLat.lng - segStart[0]) * (segEnd[0] - segStart[0]) + (e.lngLat.lat - segStart[1]) * (segEnd[1] - segStart[1])) / ((segEnd[0] - segStart[0])**2 + (segEnd[1] - segStart[1])**2)));
                        const proj = [segStart[0] + t*(segEnd[0] - segStart[0]), segStart[1] + t*(segEnd[1] - segStart[1])];
                        const dist = Math.hypot(e.lngLat.lng - proj[0], e.lngLat.lat - proj[1]);
                        if (dist < minDist) {
                            minDist = dist;
                            insertIdx = i+1;
                        }
                    }
                    // Only add if close enough (within ~0.1 deg)
                    if (minDist < 0.1) {
                        waypoints.splice(insertIdx-1, 0, [e.lngLat.lng, e.lngLat.lat]);
                        getRoute(start, end, waypoints);
                    }
                }
            });

            popup.innerHTML = 'Route displayed. Click the orange line to add a stop.';
            popup.style.display = 'block';
        } else {
            throw new Error('No route found');
        }
    } catch (err) {
        console.error('Routing error:', err);
        popup.innerHTML = 'Error: ' + (err.message || 'Failed to fetch route');
        popup.style.display = 'block';
    }
} 