'use client';

import { useMemo, useRef } from 'react';
import { TowerDataPoint } from '@/types';
import '@/lib/chart-init';
import { Chart as ChartComponent } from 'react-chartjs-2';
import {
  Chart,
  ScatterController,
  CategoryScale,
  LinearScale,
  Tooltip,
  PointElement,
} from 'chart.js';

Chart.register(ScatterController, PointElement, CategoryScale, LinearScale, Tooltip);

interface Props {
  data: TowerDataPoint[];
}

// Draw arrow at chart pixel position (px, py), angle in radians, length in px
function drawArrow(ctx: CanvasRenderingContext2D, px: number, py: number, angle: number, length: number) {
  const headLen = Math.min(8, length * 0.4);

  const dx = Math.cos(angle) * length;
  const dy = Math.sin(angle) * length;

  // Shaft
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + dx, py + dy);
  ctx.stroke();

  // Arrowhead
  const tipX = px + dx;
  const tipY = py + dy;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - headLen * Math.cos(angle - Math.PI / 6),
    tipY - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    tipX - headLen * Math.cos(angle + Math.PI / 6),
    tipY - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

export default function WindRoseChart({ data }: Props) {
  const chartRef = useRef<Chart<'scatter'> | null>(null);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Compute wind speed & direction for each point that has both U and V
    const points: { x: number; y: number; speed: number; dir: number }[] = [];
    let maxSpeed = 0;

    for (const p of data) {
      const u = Number(p.U);
      const v = Number(p.V);
      if (isNaN(u) || isNaN(v)) continue;
      // Skip near-zero to avoid wild direction flips
      if (Math.abs(u) < 0.01 && Math.abs(v) < 0.01) continue;

      const speed = Math.sqrt(u * u + v * v);
      if (speed > maxSpeed) maxSpeed = speed;
      // atan2(V, U) gives angle from +U axis toward +V axis
      // In screen coords: U→right, V→down => angle matches visual direction
      const dir = Math.atan2(v, u);
      points.push({ x: u, y: v, speed, dir });
    }

    if (points.length === 0) return null;

    // Color scale: blue (calm) → cyan → green → yellow → red (strong)
    function speedColor(speed: number): string {
      const t = Math.min(speed / maxSpeed, 1);
      // Use HSL: hue 210 (blue) → 0 (red)
      const h = 210 * (1 - t);
      return `hsl(${h}, 85%, ${45 + 15 * (1 - t)}%)`;
    }

    return {
      datasets: [
        {
          label: 'Wind Rose',
          data: points.map((p) => ({ x: p.x, y: p.y, speed: p.speed, dir: p.dir })),
          backgroundColor: points.map((p) => speedColor(p.speed)),
          pointRadius: 3,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [data]);

  // Arrow drawing plugin — runs after points are drawn
  const arrowPlugin = {
    id: 'windArrows' as string,
    afterDatasetsDraw(chart: Chart) {
      const meta = chart.getDatasetMeta(0);
      if (!meta?.data || !chartRef.current) return;

      const ctx = chart.ctx;
      const origStroke = ctx.stroke.bind(ctx);
      const origFill = ctx.fill.bind(ctx);

      ctx.strokeStyle = 'rgba(50, 50, 50, 0.5)';
      ctx.fillStyle = 'rgba(50, 50, 50, 0.6)';
      ctx.lineWidth = 1;

      for (let i = 0; i < meta.data.length; i++) {
        const el = meta.data[i] as any;
        if (!el?.x || !el?.y) continue;

        const pt = chartData!.datasets[0].data[i] as any;
        if (!pt?.speed) continue;

        // Scale arrow length: 8px for calm, up to 35px for max speed
        const arrowLen = 8 + (pt.speed / Math.max(maxSpeed(chartData!.datasets[0].data), 1)) * 27;
        drawArrow(ctx, el.x, el.y, pt.dir, arrowLen);
      }

      ctx.stroke = origStroke;
      ctx.fill = origFill;
    },
  };

  // Helper: get max speed from dataset
  function maxSpeed(datasetData: any[]): number {
    let m = 0;
    for (const d of datasetData) {
      if (d.speed > m) m = d.speed;
    }
    return m || 1;
  }

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      title: {
        display: true,
        text: 'Wind Rose (U vs V)',
        font: { size: 14 },
      },
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item: any) => {
            const d = item.raw;
            if (!d) return '';
            const speed = Math.sqrt(d.x * d.x + d.y * d.y).toFixed(2);
            // Convert to meteorological direction (from where wind comes)
            let deg = (Math.atan2(d.y, d.x) * 180) / Math.PI;
            if (deg < 0) deg += 360;
            const dir = ((deg + 180) % 360).toFixed(1);
            return [`Speed: ${speed} m/s`, `Direction: ${dir}°`];
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'U (N-S, +N)', font: { size: 12 } },
        grid: { color: 'rgba(128,128,128,0.15)' },
      },
      y: {
        title: { display: true, text: 'V (E-W, +E)', font: { size: 12 } },
        grid: { color: 'rgba(128,128,128,0.15)' },
      },
    },
  }), [chartData]);

  if (!chartData) {
    return <div className="text-center py-8 text-gray-400">No U/V data for wind rose</div>;
  }

  return (
    <div className="w-full h-[320px] sm:h-[360px]">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ChartComponent
        ref={chartRef as any}
        type="scatter"
        data={chartData}
        options={options}
        plugins={[arrowPlugin]}
      />
    </div>
  );
}
