import { useMemo } from "react";
import type { TowerDataPoint, SensorGroup } from "../types";

interface StatsEntry {
	key: string;
	count: number;
	min: number;
	max: number;
	mean: number;
	stdev: number;
	duration: string;
}

const KEY_NAMES: Record<string, string> = {
	U: "Wind U",
	V: "Wind V",
	W: "Wind W",
	TEMP: "Sonic Temp (C)",
	TA_1_1_1: "Air T (C)",
	TC_1_1_1: "Canopy T (C)",
	TCNR4_C_1_1_1: "CNR4 Thermistor (C)",
	RH_1_1_1: "Humidity",
	TS_1_1_1: "TS_1_1_1(5cm)",
	TS_2_1_1: "TS_2_1_1(5cm)",
	TS_3_1_1: "TS_3_1_1(5cm)",
	SWC_1_1_1: "Soil M1",
	SWC_2_1_1: "Soil M2",
	SWC_3_1_1: "Soil M3",
	PPFD_1_1_1: "PAR (W/m²)",
	RN_1_1_1: "Net Rad",
	ALB_1_1_1: "Albedo",
};

function formatKey(key: string): string {
	return KEY_NAMES[key] || key;
}

interface Props {
	data: TowerDataPoint[];
	sensorGroups: SensorGroup[];
}

export default function StatsTable({ data, sensorGroups }: Props) {
	const stats = useMemo<StatsEntry[]>(() => {
		if (data.length === 0) return [];

		// Build conversion map
		const conversionMap = new Map<string, (v: number) => number>();
		for (const g of sensorGroups) {
			if (g.convert === "multiply_0.51") {
				g.keys.forEach((key) => conversionMap.set(key, (v) => v * 0.51));
			}
		}

		const groups = new Map<
			string,
			{ values: number[]; firstTs: number; lastTs: number }
		>();

		for (const point of data) {
			for (const [key, value] of Object.entries(point)) {
				if (["timestamp", "SECONDS", "NANOSECONDS"].includes(key)) continue;
				if (typeof value !== "number" || isNaN(value)) continue;

				const converter = conversionMap.get(key);
				const convertedValue = converter ? converter(value) : value;

				if (!groups.has(key)) {
					groups.set(key, {
						values: [],
						firstTs: point.timestamp,
						lastTs: point.timestamp,
					});
				}
				const g = groups.get(key)!;
				g.values.push(convertedValue);
				if (point.timestamp < g.firstTs) g.firstTs = point.timestamp;
				if (point.timestamp > g.lastTs) g.lastTs = point.timestamp;
			}
		}

		return Array.from(groups.entries())
			.map(([key, g]) => {
				const values = g.values;
				const durationMs = g.lastTs - g.firstTs;
				const durationMin = Math.round(durationMs / 60000);
				const mean = values.reduce((a, b) => a + b, 0) / values.length;
				const variance =
					values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
				return {
					key,
					count: values.length,
					min: Math.min(...values),
					max: Math.max(...values),
					mean,
					stdev: Math.sqrt(variance),
					duration: `${durationMin} min`,
				};
			})
			.sort((a, b) => a.key.localeCompare(b.key));
	}, [data, sensorGroups]);

	if (stats.length === 0) return null;

	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm border-collapse">
				<thead>
					<tr className="border-b border-gray-300 dark:border-gray-600">
						<th className="text-left py-2 px-3 font-semibold">Key</th>
						<th className="text-right py-2 px-3 font-semibold">Count</th>
						<th className="text-right py-2 px-3 font-semibold">Min</th>
						<th className="text-right py-2 px-3 font-semibold">Max</th>
						<th className="text-right py-2 px-3 font-semibold">Mean</th>
						<th className="text-right py-2 px-3 font-semibold">StDev</th>
						<th className="text-right py-2 px-3 font-semibold">Duration</th>
					</tr>
				</thead>
				<tbody>
					{stats.map((s) => (
						<tr
							key={s.key}
							className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
						>
							<td className="py-1.5 px-3 font-mono text-xs">
								{formatKey(s.key)}
							</td>
							<td className="py-1.5 px-3 text-right">{s.count}</td>
							<td className="py-1.5 px-3 text-right">{s.min.toFixed(2)}</td>
							<td className="py-1.5 px-3 text-right">{s.max.toFixed(2)}</td>
							<td className="py-1.5 px-3 text-right">{s.mean.toFixed(2)}</td>
							<td className="py-1.5 px-3 text-right">{s.stdev.toFixed(2)}</td>
							<td className="py-1.5 px-3 text-right">{s.duration}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
