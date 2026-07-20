import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { TowerDataPoint } from '../types';

interface Props {
  data: TowerDataPoint[];
}

function polarFromWind(u: number, v: number): { r: number; theta: number } | null {
  const speed = Math.sqrt(u * u + v * v);
  if (speed < 0.01) return null;

  let deg = (Math.atan2(v, u) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  let theta = 90 - deg;
  if (theta < 0) theta += 360;

  return { r: speed, theta };
}

function speedColor(speed: number): string {
  const maxSpeed = 15;
  const t = Math.min(speed / maxSpeed, 1);
  const h = 210 * (1 - t);
  return `hsl(${h}, 85%, ${45 + 15 * (1 - t)}%)`;
}

export default function WindRoseChart({ data }: Props) {
  const traceData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const points: number[] = [];
    const thetas: number[] = [];
    const texts: string[] = [];
    let maxSpeed = 0;

    for (const p of data) {
      const u = Number(p.U);
      const v = Number(p.V);
      if (isNaN(u) || isNaN(v)) continue;

      const result = polarFromWind(u, v);
      if (!result) continue;

      if (result.r > maxSpeed) maxSpeed = result.r;

      let deg = (Math.atan2(v, u) * 180) / Math.PI;
      if (deg < 0) deg += 360;

      points.push(result.r);
      thetas.push(result.theta);
      texts.push(`Speed: ${result.r.toFixed(2)} m/s\nDir: ${deg.toFixed(1)}°`);
    }

    if (points.length === 0) return null;

    const maxPoints = 2000;
    const step = Math.max(1, Math.floor(points.length / maxPoints));
    const sampledR = points.filter((_, i) => i % step === 0);
    const sampledTheta = thetas.filter((_, i) => i % step === 0);
    const sampledText = texts.filter((_, i) => i % step === 0);

    return {
      type: 'scatterpolar' as const,
      mode: 'markers' as const,
      r: sampledR,
      theta: sampledTheta,
      text: sampledText,
      marker: {
        size: 4,
        color: sampledR.map(speedColor),
        opacity: 0.7,
        line: { width: 0.5, color: 'rgba(255,255,255,0.3)' },
      },
    };
  }, [data]);

  const layout = useMemo(() => ({
    polar: {
      radialaxis: {
        title: { text: 'Wind Speed (m/s)', font: { size: 12 } },
        tickfont: { size: 10 },
        range: traceData ? [0, Math.ceil(Math.max(...(traceData.r as number[]) || [15]))] : [0, 15],
      },
      angularaxis: {
        direction: 'clockwise' as const,
        rotation: 90,
        tickfont: { size: 11 },
        tickvals: [0, 45, 90, 135, 180, 225, 270, 315],
        ticktext: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
      },
    },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 40, r: 40, t: 40, b: 40 },
    showlegend: false,
    annotations: [{
      text: 'Wind Rose: Uncorrected N-Spar',
      x: 0.5, y: 1.08, xref: 'paper', yref: 'paper',
      showarrow: false, font: { size: 14, weight: 'bold' },
    }],
  }), [traceData]);

  if (!traceData) {
    return <div className="text-center py-8 text-gray-400">No U/V data for wind rose</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Plot
        data={[traceData as any]}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        useResizeHandler
      />
    </div>
  );
}
