
const { performance } = require('perf_hooks');

// --- MOCK DATA ---
const NUM_FEATURES = 500;
const NUM_CIRCUITS = 100;
const POIS_PER_CIRCUIT = 15;

console.log(`Generating data: ${NUM_FEATURES} Features, ${NUM_CIRCUITS} Circuits...`);

const features = [];
for (let i = 0; i < NUM_FEATURES; i++) {
    features.push({
        id: `HW-FEATURE-${i}`,
        properties: {
            HW_ID: `HW-FEATURE-${i}`,
            userData: {
                deleted: i % 50 === 0 // 2% deleted
            }
        },
        geometry: { coordinates: [10 + Math.random(), 40 + Math.random()] }
    });
}

const circuits = [];
for (let i = 0; i < NUM_CIRCUITS; i++) {
    const poiIds = [];
    for (let j = 0; j < POIS_PER_CIRCUIT; j++) {
        const randomId = Math.floor(Math.random() * NUM_FEATURES);
        poiIds.push(`HW-FEATURE-${randomId}`);
    }
    circuits.push({
        id: `CIRCUIT-${i}`,
        poiIds: poiIds,
        isDeleted: i % 20 === 0 // 5% deleted
    });
}

// --- UTILS ---
function getPoiId(feature) {
    return feature.properties.HW_ID || feature.id;
}

// --- CURRENT IMPLEMENTATION (SLOW) ---
function calculateCountersSlow(features, circuits) {
    const counters = {};

    // Etape 1 : On initialise tout à 0
    features.forEach(f => {
        counters[getPoiId(f)] = 0;
    });

    const activeCircuits = circuits.filter(c => !c.isDeleted);

    activeCircuits.forEach(circuit => {
        const poiIds = circuit.poiIds || [];
        [...new Set(poiIds)].forEach(poiId => {
            // Etape 2 : On vérifie l'existence et l'état du POI
            if (counters.hasOwnProperty(poiId)) {
                // THE BOTTLENECK: Array.find inside loop
                const feature = features.find(f => getPoiId(f) === poiId);

                const isDeleted = feature && feature.properties.userData && feature.properties.userData.deleted;

                if (!isDeleted) {
                    counters[poiId]++;
                }
            }
        });
    });
    return counters;
}

// --- OPTIMIZED IMPLEMENTATION (FAST) ---
function calculateCountersFast(features, circuits) {
    const counters = {};

    // Create Map for O(1) access
    const featureMap = new Map();
    features.forEach(f => {
        const id = getPoiId(f);
        featureMap.set(id, f);
        counters[id] = 0;
    });

    const activeCircuits = circuits.filter(c => !c.isDeleted);

    activeCircuits.forEach(circuit => {
        const poiIds = circuit.poiIds || [];
        [...new Set(poiIds)].forEach(poiId => {
            if (counters.hasOwnProperty(poiId)) {
                // O(1) Lookup
                const feature = featureMap.get(poiId);
                const isDeleted = feature && feature.properties.userData && feature.properties.userData.deleted;

                if (!isDeleted) {
                    counters[poiId]++;
                }
            }
        });
    });
    return counters;
}

// --- BENCHMARK ---

console.log("\nStarting Benchmark...");

// Warmup
calculateCountersSlow(features, circuits);
calculateCountersFast(features, circuits);

// Measure Slow
const startSlow = performance.now();
for(let i=0; i<10; i++) calculateCountersSlow(features, circuits);
const endSlow = performance.now();
const timeSlow = (endSlow - startSlow) / 10;
console.log(`Average Time (Current/Slow): ${timeSlow.toFixed(3)} ms`);

// Measure Fast
const startFast = performance.now();
for(let i=0; i<10; i++) calculateCountersFast(features, circuits);
const endFast = performance.now();
const timeFast = (endFast - startFast) / 10;
console.log(`Average Time (Optimized/Fast): ${timeFast.toFixed(3)} ms`);

const speedup = timeSlow / timeFast;
console.log(`\nSpeedup: ${speedup.toFixed(1)}x faster!`);
