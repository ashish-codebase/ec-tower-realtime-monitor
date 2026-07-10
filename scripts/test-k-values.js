/**
 * Test K values from 6 to 30 to find optimal clustering
 */

const fs = require('fs');
const path = require('path');
const { kmeans } = require('ml-kmeans');

// Load data
const dataFile = path.join(__dirname, '..', 'data', '166_230_26_67.json');
const content = fs.readFileSync(dataFile, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());
const data = lines.map(line => JSON.parse(line.trim())).filter(Boolean);

// Collect stats per sensor-key combo
const groups = new Map();
for (const point of data) {
  for (const r of point.readings) {
    for (const [key, value] of Object.entries(r)) {
      if (typeof value !== 'number' || isNaN(value)) continue;
      const comboKey = `${key}_${point.sensor}`;
      if (!groups.has(comboKey)) {
        groups.set(comboKey, []);
      }
      groups.get(comboKey).push(value);
    }
  }
}

const stats = Array.from(groups.entries()).map(([comboKey, values]) => {
  const parts = comboKey.split('_');
  const sensor = parts[parts.length - 1];
  const key = parts.slice(0, -1).join('_');
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length);
  return { key, sensor, mean, std };
});

console.log(`Total unique sensor-key combos: ${stats.length}\n`);

// Normalize features (z-score)
const means = stats.map(s => s.mean);
const stds = stats.map(s => s.std);
const meanMean = means.reduce((a, b) => a + b, 0) / means.length;
const meanStd = stds.reduce((a, b) => a + b, 0) / stds.length;
const stdMean = Math.sqrt(means.reduce((sq, n) => sq + Math.pow(n - meanMean, 2), 0) / means.length);
const stdStd = Math.sqrt(stds.reduce((sq, n) => sq + Math.pow(n - meanStd, 2), 0) / stds.length);

const normalizedStats = stats.map(s => ({
  ...s,
  normMean: (s.mean - meanMean) / stdMean,
  normStd: (s.std - meanStd) / stdStd,
}));

console.log(`Normalized: mean range [${Math.min(...normalizedStats.map(s => s.normMean)).toFixed(2)}, ${Math.max(...normalizedStats.map(s => s.normMean)).toFixed(2)}]`);
console.log(`Normalized: std range [${Math.min(...normalizedStats.map(s => s.normStd)).toFixed(2)}, ${Math.max(...normalizedStats.map(s => s.normStd)).toFixed(2)}]\n`);

// Test K values with semantic grouping
console.log("\n=== Semantic Grouping ===");
const SEMANTIC_GROUPS = {
  'Air Temperature': ['45', '116', '129'],
  'Soil Temperature': ['88', '89'],
  'Fluxes': ['52', '36', '115', '122'],
  'Radiation': ['123', '124', '125', '127'],
  'Wind': ['210', '211', '22', '23', '24'],
  'Humidity / VPD': ['118', '128', '119'],
  'Pressure': ['120', '130'],
  'CO₂ / H₂O Density': ['131', '132'],
  'PAR': ['121'],
  'Friction Velocity': ['43', '34'],
};

let multiSensorCount = 0;
Object.entries(SEMANTIC_GROUPS).forEach(([name, keys]) => {
  const groupSensors = stats.filter(s => keys.includes(s.key));
  if (groupSensors.length > 1) multiSensorCount++;
});
console.log(`Semantic groups: ${multiSensorCount} multi-sensor groups\n`);

// Test K values with 2D (mean + std) but weight mean more
console.log("=== 2D Clustering (mean*2 + std) ===");
for (let k = 6; k <= 30; k++) {
  const points = normalizedStats.map(s => [s.normMean * 2, s.normStd]);
  
  try {
    const result = kmeans(points, k, {
      initialization: 'kmeans++',
      maxIterations: 100,
    });
    
    // Count clusters with multiple sensors
    const clusterCounts = new Array(k).fill(0);
    stats.forEach((s, i) => clusterCounts[result.clusters[i]]++);
    
    const multiSensorClusters = clusterCounts.filter(c => c > 1).length;
    const singleSensorClusters = clusterCounts.filter(c => c === 1).length;
    
    console.log(`K=${k}: ${multiSensorClusters} multi-sensor groups, ${singleSensorClusters} single-sensor outliers`);
    
    if (multiSensorClusters >= 8) {
      console.log(`\n✓ Found optimal K=${k} with ${multiSensorClusters} sensor groups!\n`);
      
      // Show cluster details
      const clusterDetails = Array.from({ length: k }, () => []);
      normalizedStats.forEach((s, i) => clusterDetails[result.clusters[i]].push(s));
      
      clusterDetails.forEach((cluster, idx) => {
        if (cluster.length > 1) {
          const means = cluster.map(s => s.mean);
          console.log(`  Cluster ${idx}: ${cluster.length} sensors, mean range: ${Math.min(...means).toFixed(2)} - ${Math.max(...means).toFixed(2)}`);
        }
      });
      
      break;
    }
  } catch (err) {
    console.log(`K=${k}: Error - ${err.message}`);
  }
}
