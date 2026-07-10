/**
 * Generate sensor groups using Jenks natural breaks classification
 * Run once with actual data, then use the output in settings.ts
 *
 * Usage: node scripts/generate-sensor-groups.js [data-file.json]
 */

const fs = require('fs');
const path = require('path');
const { kmeans } = require('ml-kmeans');

// Jenks natural breaks algorithm
function jenksNaturalBreaks(values, numClasses) {
  if (values.length === 0 || numClasses <= 1) return [];
  
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  // Matrices for dynamic programming
  // lowerClassLimits[i][j] = lower class limit for class j using first i data points
  // varianceCombinations[i][j] = minimum sum of squared deviations for j classes using first i points
  const lowerClassLimits = Array.from({ length: numClasses + 1 }, () => new Array(n + 1).fill(0));
  const varianceCombinations = Array.from({ length: numClasses + 1 }, () => new Array(n + 1).fill(Infinity));
  
  // Base case: 1 class
  lowerClassLimits[1][1] = sorted[0];
  varianceCombinations[1][1] = 0;
  
  for (let i = 2; i <= n; i++) {
    lowerClassLimits[1][i] = sorted[i - 1];
    varianceCombinations[1][i] = 0;
  }
  
  // Fill matrices
  for (let j = 2; j <= numClasses; j++) {
    for (let i = j; i <= n; i++) {
      let minTotalVariance = Infinity;
      let bestBreak = 0;
      
      // Try all possible break points
      for (let i2 = j - 1; i2 < i; i2++) {
        // Calculate variance for class j (from i2 to i-1 in 0-indexed sorted array)
        const classValues = sorted.slice(i2, i);
        const classMean = classValues.reduce((a, b) => a + b, 0) / classValues.length;
        let classVariance = 0;
        for (const val of classValues) {
          classVariance += (val - classMean) ** 2;
        }
        
        const totalVariance = varianceCombinations[j - 1][i2] + classVariance;
        
        if (totalVariance < minTotalVariance) {
          minTotalVariance = totalVariance;
          bestBreak = i2;
        }
      }
      
      lowerClassLimits[j][i] = sorted[bestBreak];
      varianceCombinations[j][i] = minTotalVariance;
    }
  }
  
  // Extract breakpoints by tracing back
  const breaks = [];
  let k = n;
  for (let j = numClasses; j >= 2; j--) {
    const breakIdx = lowerClassLimits[j][k];
    if (breakIdx === 0 || breakIdx === undefined) break;
    breaks.unshift(breakIdx);
    k = breakIdx;
  }
  
  return breaks;
}

// Key name lookup
const KEY_NAMES = {
  '22': 'WNV', '23': 'WNW', '24': 'WNZ',
  '34': 'UST', '43': 'Ustar', '36': 'H',
  '52': 'LE', '122': 'G', '45': 'Tair',
  '116': 'T2m', '88': 'Tsoil1', '89': 'Tsoil2',
  '115': 'CO2_flux', '117': 'wCO2', '119': 'wQ',
  '54': 'Rn', '123': 'SW_down', '124': 'SW_up',
  '125': 'LW_down', '127': 'LW_up', '128': 'VPD',
  '129': 'Tair_129', '130': 'Press_130', '131': 'CO2_dens',
  '132': 'H2O_dens', '121': 'PAR', '210': 'WindSpd',
  '211': 'WindDir', '118': 'RH', '120': 'Press',
};

// Group sensors by semantic category
const SENSOR_CATEGORIES = {
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

async function main() {
  const dataFile = process.argv[2] || path.join(__dirname, '..', 'data', '166_230_26_67.json');
  
  console.log(`Reading data from: ${dataFile}`);
  const content = fs.readFileSync(dataFile, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const data = lines.map(line => JSON.parse(line.trim())).filter(Boolean);
  
  console.log(`Loaded ${data.length} data points`);
  
  // Collect all mean values per sensor-key combo
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
  
  // Calculate means and std
  const stats = [];
  for (const [comboKey, values] of groups) {
    const parts = comboKey.split('_');
    const sensor = parts[parts.length - 1];
    const key = parts.slice(0, -1).join('_');
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length);
    stats.push({ key, sensor, mean, std, count: values.length });
  }
  
  console.log(`\nFound ${stats.length} unique sensor-key combinations`);
  
  // Debug: show mean distribution
  console.log('\nMean value distribution:');
  const sortedStats = [...stats].sort((a, b) => a.mean - b.mean);
  sortedStats.forEach(s => {
    console.log(`  ${KEY_NAMES[s.key] || s.key}(${s.sensor}): mean=${s.mean.toFixed(2)}, std=${s.std.toFixed(2)}`);
  });
  
  // K-means clustering with normalized features
  const numClasses = 15;
  const means = stats.map(s => s.mean);
  const stds = stats.map(s => s.std);
  const meanMean = means.reduce((a, b) => a + b, 0) / means.length;
  const meanStd = stds.reduce((a, b) => a + b, 0) / stds.length;
  const stdMean = Math.sqrt(means.reduce((sq, n) => sq + Math.pow(n - meanMean, 2), 0) / means.length) || 1;
  const stdStd = Math.sqrt(stds.reduce((sq, n) => sq + Math.pow(n - meanStd, 2), 0) / stds.length) || 1;
  
  const points = stats.map(s => [(s.mean - meanMean) / stdMean, (s.std - meanStd) / stdStd]);
  
  const kmeansResult = kmeans(points, numClasses, {
    initialization: 'kmeans++',
    maxIterations: 100,
  });
  
  // Assign clusters to stats
  stats.forEach((s, i) => {
    s.jenksClass = kmeansResult.clusters[i];
  });
  
  console.log(`\nK-means clusters (K=${numClasses}):`);
  const clusterStats = Array.from({ length: numClasses }, () => []);
  stats.forEach(s => clusterStats[s.jenksClass].push(s));
  clusterStats.forEach((cluster, idx) => {
    if (cluster.length > 0) {
      const clusterMeans = cluster.map(s => s.mean);
      console.log(`  Cluster ${idx}: ${cluster.length} sensors, mean range: ${Math.min(...clusterMeans).toFixed(2)} - ${Math.max(...clusterMeans).toFixed(2)}`);
    }
  });
  
  // Build sensor groups from K-means clusters
  const sensorGroups = [];
  const clusterGroups = Array.from({ length: numClasses }, () => []);
  stats.forEach(s => clusterGroups[s.jenksClass].push(s));
  
  clusterGroups.forEach((cluster, idx) => {
    if (cluster.length === 0) return;
    sensorGroups.push({
      name: `Cluster ${idx + 1}`,
      keys: cluster.map(s => s.key),
      jenksClass: idx,
    });
  });
  
  // Output results
  console.log('\n=== Generated Sensor Groups ===');
  sensorGroups.forEach(g => {
    console.log(`\n${g.name} (Class ${g.jenksClass + 1}):`);
    console.log(`  Keys: ${g.keys.map(k => `${KEY_NAMES[k] || k}(${k})`).join(', ')}`);
  });
  
  // Generate settings file content
  const settings = {
    sensorGroups,
    generatedAt: new Date().toISOString(),
    numClasses,
  };
  
  const settingsContent = `// Sensor group settings generated by K-means clustering
// Generated: ${settings.generatedAt}
// Clusters: ${settings.numClasses}
// Regenerate with: node scripts/generate-sensor-groups.js

export interface SensorGroupSetting {
  name: string;
  keys: string[];
  jenksClass: number;
}

export interface Settings {
  sensorGroups: SensorGroupSetting[];
  generatedAt: string;
}

export const SETTINGS: Settings = ${JSON.stringify(settings, null, 2)};

export function getSensorGroups(): SensorGroupSetting[] {
  return SETTINGS.sensorGroups;
}
`;
  
  const outputPath = path.join(__dirname, '..', 'src', 'lib', 'settings.ts');
  fs.writeFileSync(outputPath, settingsContent);
  console.log(`\n✓ Settings written to: ${outputPath}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
