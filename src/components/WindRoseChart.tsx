'use client';

import { useMemo, useRef } from 'react';
import { TowerDataPoint } from '@/types';
import dynamic from 'next/dynamic';

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface Props {
  data: TowerDataPoint[];
}

// Convert wind speed + direction (degrees, meteorological) → polar coordinates
function polarFromWind(u: number, v: number): { r: number; theta: number; speed: number } | null {
  const speed = Math.sqrt(u * u + v * v);
  if (speed < 0.01) return null; // skip near-zero
  
  // Meteorological direction: angle FROM which wind blows
  // atan2(V, U) gives angle from +U axis toward +V axis in radians
  let deg = (Math.atan2(v, u) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  
  // Plotly polar: theta=0 is East (right), increases counterclockwise
  // Meteorological: 0° = from North, 90° = from East
  // Convert: plotly_theta = 90 - meteorological_degrees
  let theta = 90 - deg;
  if (theta < 0) theta += 360;
  
  return { r: speed, theta, speed };
}

function speedColor(speed: number): string {
  // Blue (calm) → Cyan → Green → Yellow → Red (strong)
  const maxSpeed = 15; // typical max for EC towers
  const t = Math.min(speed / maxSpeed, 1);
  const h = 210 * (1 - t);
  return `hsl(${h}, 85%, ${45 + 15 * (1 - t)}%)`;
}

export default function WindRoseChart({ data }: Props) {
  const plotDivRef = useRef<HTMLDivElement>(null);

  const traceData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Group points into wind speed bins by direction sector
    // Plotly wind rose: polar scatter with color encoding
    const points: { r: number; theta: number; text: string; color: string }[] = [];
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
      const dir = ((deg + 180) % 360).toFixed(1);
      
      points.push({
        r: result.r,
        theta: result.theta,
        text: `Speed: ${result.r.toFixed(2)} m/s\nDir: ${dir}°`,
        color: speedColor(result.speed),
      });
    }

    if (points.length === 0) return null;

    // Use a subset for performance (every Nth point)
    const maxPoints = 2000;
    const step = Math.max(1, Math.floor(points.length / maxPoints));
    const sampled = points.filter((_, i) => i % step === 0);

    return {
      type: 'scatterpolar' as const,
      mode: 'markers' as const,
      r: sampled.map(p => p.r),
      theta: sampled.map(p => p.theta),
      text: sampled.map(p => p.text),
      marker: {
        size: 4,
        color: sampled.map(p => speedColor(parseFloat(p.color))),
        opacity: 0.7,
        line: { width: 0.5, color: 'rgba(255,255,255,0.3)' },
      },
    };
  }, [data]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layout = useMemo(() => ({
    polar: {
      radialaxis: {
        title: { text: 'Wind Speed (m/s)', font: { size: 12 } },
        tickfont: { size: 10 },
        range: traceData ? [0, Math.ceil(Math.max(...(traceData.r as number[]) || [15]))] : [0, 15],
      },
      angularaxis: {
        direction: 'clockwise' as const, // meteorological convention
        rotation: 90, // North at top
        tickfont: { size: 11 },
        tickvals: [0, 45, 90, 135, 180, 225, 270, 315],
        ticktext: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
      },
    },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 40, r: 40, t: 40, b: 40 },
    showlegend: false,
    annotations: [
      {
        text: 'Uncorrected Wind Rose (North Spar Unaccounted)',
        x: 0.5,
        y: 1.08,
        xref: 'paper',
        yref: 'paper',
        showarrow: false,
        font: { size: 14, weight: 'bold' },
      },
    ],
  }), [traceData]);

  const config = useMemo(() => ({
    displayModeBar: false,
    responsive: true,
  }), []);

  if (!traceData) {
    return <div className="text-center py-8 text-gray-400">No U/V data for wind rose</div>;
  }

  return (
    <div ref={plotDivRef} style={{ width: '100%', height: '100%' }}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Plot
        data={[traceData as any]}
        layout={layout}
        config={config}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
