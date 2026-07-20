import { useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { TowerDataPoint } from '../types';
import { SENSOR_COLORS, getConversionMap } from '../utils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale);

interface Props {
  data: TowerDataPoint[];
  sensorKeys: string[];
  title: string;
  timeRange?: [number, number];
}

const KEY_NAMES: Record<string, string> = {
  'U': 'U (N-S)', 'V': 'V (E-W)', 'W': 'W (vert)',
  'TEMP': 'Sonic Temp', 'TA_1_1_1': 'Air Temp', 'RH_1_1_1': 'Rel Humidity',
  'TS_1_1_1': 'Soil T1', 'TS_2_1_1': 'Soil T2', 'TS_3_1_1': 'Soil T3',
  'TS_4_1_1': 'Soil T4', 'TS_5_1_1': 'Soil T5', 'TS_6_1_1': 'Soil T6',
  'SWC_1_1_1': 'SWC1', 'SWC_2_1_1': 'SWC2', 'SWC_3_1_1': 'SWC3',
  'PPFD_1_1_1': 'PAR', 'RN_1_1_1': 'Net Rad', 'ALB_1_1_1': 'Albedo',
};

export default function TimeSeriesChart({ data, sensorKeys, title, timeRange }: Props) {
  const chartData = useMemo(() => {
    if (sensorKeys.length === 0 || data.length === 0) return null;

    const validData = data.filter(p => p.timestamp > 0 && !isNaN(p.timestamp));
    if (validData.length === 0) return null;

    // Build conversion map from sensor group name
    const hasPPFD = sensorKeys.includes('PPFD_1_1_1');
    const conversionMap = hasPPFD ? getConversionMap([{ name: 'Radiation (PPFD)', keys: ['PPFD_1_1_1'], convert: 'multiply_0.51' }]) : new Map();

    // Group by key
    const sensorKeyPoints: Record<string, { x: number; y: number }[]> = {};
    for (const point of validData) {
      for (const key of sensorKeys) {
        const converter = conversionMap.get(key);
        const value = point[key];
        if (value === undefined || value === null) continue;
        const convertedValue = converter ? converter(value as number) : (value as number);

        if (!sensorKeyPoints[key]) sensorKeyPoints[key] = [];
        sensorKeyPoints[key].push({ x: point.timestamp, y: convertedValue });
      }
    }

    const hasVMain = sensorKeys.includes('DRM_V_MAIN_1_1_1');
    const hasPowerStatus = sensorKeys.includes('DRM_POWER_STATUS_1_1_1');
    const isDrmGroup = hasVMain && hasPowerStatus;

    const datasets = Object.entries(sensorKeyPoints).map(([key, points], i) => ({
      label: KEY_NAMES[key] || key,
      data: points.sort((a, b) => a.x - b.x),
      borderColor: SENSOR_COLORS[i % SENSOR_COLORS.length],
      borderWidth: 1.5,
      pointRadius: 2,
      pointBackgroundColor: SENSOR_COLORS[i % SENSOR_COLORS.length],
      tension: 0,
      fill: false,
      yAxisID: isDrmGroup && key === 'DRM_POWER_STATUS_1_1_1' ? 'y1' : 'y',
    }));

    if (datasets.length === 0) return null;

    return {
      type: 'line' as const,
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: 'nearest' as const, intersect: false },
        plugins: {
          title: { display: true, text: title, font: { size: 14 } },
          legend: { display: true, position: 'top' as const },
          tooltip: {
            callbacks: {
              title: (items: any[]) => {
                if (!items?.length) return '';
                return new Date(items[0].parsed.x).toLocaleString('en-US', { timeZone: 'America/Denver' });
              },
              label: (item: any) => `${item.dataset.label}: ${item.parsed.y}`,
            },
          },
        },
        scales: {
          x: {
            type: 'time' as const,
            time: { unit: 'hour' as const, tooltipFormat: 'MMM dd, HH:mm', displayFormats: { hour: 'HH:mm', day: 'MMM dd' } },
            title: { display: true, text: 'Time (MT)' },
            ticks: { maxTicksLimit: 12 },
          },
          y: {
            title: { display: true, text: isDrmGroup ? 'Voltage (V)' : title },
            position: isDrmGroup ? 'left' as const : undefined,
          },
          ...(isDrmGroup && {
            y1: {
              title: { display: true, text: 'Power Status' },
              position: 'right' as const,
              grid: { drawOnChartArea: false },
            },
          }),
        },
      },
    };
  }, [data, sensorKeys, title, timeRange]);

  if (!chartData) {
    return <div className="text-center py-8 text-gray-400">No data available</div>;
  }

  return (
    <div className="w-full h-[280px] sm:h-[320px]">
      <Chart {...chartData} />
    </div>
  );
}
