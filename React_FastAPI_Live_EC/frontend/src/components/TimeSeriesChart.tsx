import { useMemo } from "react";
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Title,
	Tooltip,
	Legend,
	TimeScale,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import "chartjs-adapter-date-fns";
import type { TowerDataPoint } from "../types";
import { SENSOR_COLORS, getConversionMap } from "../utils";

ChartJS.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Title,
	Tooltip,
	Legend,
	TimeScale,
);

interface Props {
	data: TowerDataPoint[];
	sensorKeys: string[];
	siteName: string;
	title: string;
	timeRange?: [number, number];
}

const KEY_NAMES: Record<string, string> = {
	U: "U (N-S)",
	V: "V (E-W)",
	W: "W (vert)",
	TEMP: "Sonic Temp (C)",
	TA_1_1_1: "Air Temp (C)",
	TC_1_1_1: "Canopy Temp (C)",
	TCNR4_C_1_1_1: "CNR4 Thermistor (C)",
	RH_1_1_1: "Rel Humidity",
	TS_1_1_1: "TS_1_1_1(5cm)",
	TS_2_1_1: "TS_2_1_1(5cm)",
	TS_3_1_1: "TS_3_1_1(5cm)",
	TS_4_1_1: "TS_4_1_1(20cm)",
	TS_5_1_1: "TS_5_1_1(40cm)",
	TS_6_1_1: "TS_6_1_1(60cm)",
	SWC_1_1_1: "SWC1",
	SWC_2_1_1: "SWC2",
	SWC_3_1_1: "SWC3",
	PPFD_1_1_1: "PAR",
	RN_1_1_1: "Net Rad",
	ALB_1_1_1: "Albedo",
};

// Filter cutoff: Jan 1, 2023 UTC — anything older is likely garbage epoch data
const TS_CUTOFF_MS = 1672531200000;

function pickTimeUnit(minTs: number, maxTs: number): string {
	const spanHours = (maxTs - minTs) / 3_600_000;
	if (spanHours <= 48) return "hour";
	if (spanHours <= 720) return "day";
	return "month";
}

export default function TimeSeriesChart({
	data,
	sensorKeys,
	siteName,
	title,
}: Props) {
	const chartData = useMemo(() => {
		// Build conversion map from sensor group name
		const hasPPFD = sensorKeys.includes("PPFD_1_1_1");
		const conversionMap = hasPPFD
			? getConversionMap([
					{
						name: "Radiation (PPFD)",
						keys: ["PPFD_1_1_1"],
						convert: "multiply_0.51",
					},
				])
			: new Map();

		// Group by key — even if no data, keep the keys for legend
		const sensorKeyPoints: Record<string, { x: number; y: number }[]> = {};
		for (const key of sensorKeys) {
			sensorKeyPoints[key] = [];
		}

		if (data.length > 0) {
			const validData = data.filter(
				(p) => p.timestamp >= TS_CUTOFF_MS && !isNaN(p.timestamp),
			);
			for (const point of validData) {
				for (const key of sensorKeys) {
					const converter = conversionMap.get(key);
					const value = point[key];
					if (value === undefined || value === null) continue;
					const convertedValue = converter
						? converter(value as number)
						: (value as number);
					sensorKeyPoints[key].push({ x: point.timestamp, y: convertedValue });
				}
			}
		}

		const hasVMain = sensorKeys.includes("DRM_V_MAIN_1_1_1");
		const hasPowerStatus = sensorKeys.includes("DRM_POWER_STATUS_1_1_1");
		const isDrmGroup = hasVMain && hasPowerStatus;

		// Determine actual time range for dynamic unit selection
		let minTs = Infinity;
		let maxTs = -Infinity;
		for (const points of Object.values(sensorKeyPoints)) {
			for (const p of points) {
				if (p.x < minTs) minTs = p.x;
				if (p.x > maxTs) maxTs = p.x;
			}
		}
		const timeUnit =
			isFinite(minTs) && isFinite(maxTs) ? pickTimeUnit(minTs, maxTs) : "hour";

		// Always include all keys in legend even if empty
		const allDatasets = Object.entries(sensorKeyPoints).map(
			([key, points], i) => ({
				label: KEY_NAMES[key] || key,
				data: points.sort((a, b) => a.x - b.x),
				borderColor: SENSOR_COLORS[i % SENSOR_COLORS.length],
				borderWidth: 1.5,
				pointRadius: 2,
				pointBackgroundColor: SENSOR_COLORS[i % SENSOR_COLORS.length],
				tension: 0,
				fill: false,
				yAxisID: isDrmGroup && key === "DRM_POWER_STATUS_1_1_1" ? "y1" : "y",
				// Hide empty datasets from chart area but keep in legend
				hidden: points.length === 0,
			}),
		);

		return {
			type: "line" as const,
			data: { datasets: allDatasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: { duration: 300 },
				interaction: { mode: "nearest" as const, intersect: false },
				plugins: {
					title: {
						display: true,
						text: siteName ? `${siteName}: ${title}` : title,
						font: { size: 14 },
					},
					legend: { display: true, position: "top" as const },
					tooltip: {
						callbacks: {
							title: (items: any[]) => {
								if (!items?.length) return "";
								return new Date(items[0].parsed.x).toLocaleString("en-US", {
									timeZone: "America/Denver",
								});
							},
							label: (item: any) => `${item.dataset.label}: ${item.parsed.y}`,
						},
					},
				},
				scales: {
					x: {
						type: "time" as const,
						time: {
							unit: timeUnit as any,
							tooltipFormat: "MMM dd, HH:mm",
							displayFormats: {
								hour: "HH:mm",
								day: "MMM dd",
								month: "yyyy-MM",
							},
						},
						title: { display: true, text: "Time (MT)" },
						ticks: { maxTicksLimit: 12 },
					},
					y: {
						title: { display: true, text: isDrmGroup ? "Voltage (V)" : title },
						position: isDrmGroup ? ("left" as const) : undefined,
					},
					...(isDrmGroup && {
						y1: {
							title: { display: true, text: "Power Status" },
							position: "right" as const,
							grid: { drawOnChartArea: false },
						},
					}),
				},
			},
		};
	}, [data, sensorKeys, siteName, title]);

	return (
		<div className="w-full h-[280px] sm:h-[320px]">
			<Chart {...chartData} />
		</div>
	);
}
