import { useMemo } from "react";
import Plot from "react-plotly.js";
import type { TowerDataPoint } from "../types";

interface Props {
	data: TowerDataPoint[];
	siteName: string;
}

/** Convert U,V wind vector to speed + compass direction (0=N, clockwise). */
function windToPolar(
	u: number,
	v: number,
): { r: number; theta: number } | null {
	const speed = Math.sqrt(u * u + v * v);
	if (speed < 0.01) return null;

	// atan2(v,u) → angle from East, CCW. Convert to compass: 0=N, clockwise.
	let theta = 90 - (Math.atan2(v, u) * 180) / Math.PI;
	theta = ((theta % 360) + 360) % 360;

	return { r: speed, theta };
}

function speedColor(speed: number, maxSpeed: number): string {
	const t = Math.min(speed / maxSpeed, 1);
	const h = 210 * (1 - t);
	return `hsl(${h}, 85%, ${45 + 15 * (1 - t)}%)`;
}

export default function WindRoseChart({ data, siteName }: Props) {
	const chartInfo = useMemo(() => {
		if (!data || data.length === 0) return null;

		const points: number[] = [];
		const thetas: number[] = [];
		const texts: string[] = [];

		for (const p of data) {
			const u = Number(p.U);
			const v = Number(p.V);
			if (isNaN(u) || isNaN(v)) continue;

			const result = windToPolar(u, v);
			if (!result) continue;

			points.push(result.r);
			thetas.push(result.theta);
			texts.push(
				`Speed: ${result.r.toFixed(2)} m/s\nDir: ${result.theta.toFixed(1)}°`,
			);
		}

		if (points.length === 0) return null;

		const maxSpeed = Math.max(...points);
		const ceiling = Math.min(20, Math.ceil(maxSpeed * 1.1));

		const maxPoints = 2000;
		const step = Math.max(1, Math.floor(points.length / maxPoints));
		const sampledR = points.filter((_, i) => i % step === 0);

		return {
			r: sampledR,
			theta: thetas.filter((_, i) => i % step === 0),
			text: texts.filter((_, i) => i % step === 0),
			colors: sampledR.map((r) => speedColor(r, maxSpeed)),
			ceiling,
		};
	}, [data]);

	const title = siteName ? `${siteName}: Wind (U,V,W)` : "Wind (U,V,W)";

	return (
		<div className="aspect-square w-full">
			<Plot
				data={
					chartInfo
						? ([
								{
									type: "scatterpolar",
									mode: "markers",
									r: chartInfo.r,
									theta: chartInfo.theta,
									text: chartInfo.text,
									marker: {
										size: 8,
										color: chartInfo.colors,
										opacity: 0.7,
										line: { width: 0.5, color: "rgba(255,255,255,0.3)" },
									},
								},
							] as any[])
						: []
				}
				layout={{
					polar: {
						radialaxis: {
							title: { text: "Wind Speed (m/s)", font: { size: 12 } },
							tickfont: { size: 10 },
							range: chartInfo ? [0, chartInfo.ceiling] : [0, 15],
						},
						angularaxis: {
							direction: "clockwise",
							tickfont: { size: 11 },
							tickvals: [0, 45, 90, 135, 180, 225, 270, 315],
							ticktext: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
						},
					},
					title: { text: title, font: { size: 14 } },
					paper_bgcolor: "rgba(0,0,0,0)",
					plot_bgcolor: "rgba(0,0,0,0)",
					margin: { l: 40, r: 40, t: 60, b: 40 },
					showlegend: false,
				}}
				config={{ displayModeBar: false, responsive: true }}
				useResizeHandler
			/>
		</div>
	);
}
