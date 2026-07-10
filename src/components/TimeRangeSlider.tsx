'use client';

import { useState, useMemo, useCallback } from 'react';

interface TimeRangeSliderProps {
  minTimestamp: number; // ms
  maxTimestamp: number; // ms
  value: [number, number]; // [start, end] in ms
  onChange: (range: [number, number]) => void;
}

export default function TimeRangeSlider({
  minTimestamp,
  maxTimestamp,
  value,
  onChange,
}: TimeRangeSliderProps) {
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);

  const range = maxTimestamp - minTimestamp;
  const leftPercent = ((value[0] - minTimestamp) / range) * 100;
  const rightPercent = ((value[1] - minTimestamp) / range) * 100;

  const formatTime = useCallback((ts: number) => {
    return new Date(ts).toLocaleString('en-US', {
      timeZone: 'America/Denver',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const handleMouseDown = useCallback((handle: 'left' | 'right') => {
    setDragging(handle);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;

    const slider = e.currentTarget;
    const rect = slider.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const timestamp = minTimestamp + percent * range;

    if (dragging === 'left') {
      onChange([Math.min(timestamp, value[1]), value[1]]);
    } else {
      onChange([value[0], Math.max(timestamp, value[0])]);
    }
  }, [dragging, minTimestamp, range, value, onChange]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    const slider = e.currentTarget;
    const rect = slider.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const timestamp = minTimestamp + percent * range;

    // Click to expand range symmetrically
    const halfWidth = (value[1] - value[0]) / 2;
    const newStart = Math.max(minTimestamp, timestamp - halfWidth);
    const newEnd = Math.min(maxTimestamp, timestamp + halfWidth);
    onChange([newStart, newEnd]);
  }, [minTimestamp, maxTimestamp, range, value, onChange]);

  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
        <span>{formatTime(value[0])}</span>
        <span>{formatTime(value[1])}</span>
      </div>
      <div
        className="relative h-8 bg-gray-200 dark:bg-gray-700 rounded cursor-pointer select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleTrackClick}
      >
        {/* Selected range */}
        <div
          className="absolute top-0 h-full bg-blue-500 dark:bg-blue-600 rounded"
          style={{ left: `${leftPercent}%`, width: `${rightPercent - leftPercent}%` }}
        />
        {/* Left handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-gray-900 border-2 border-blue-500 dark:border-blue-600 rounded-full cursor-ew-resize shadow"
          style={{ left: `${leftPercent}%`, transform: 'translate(-50%, -50%)' }}
          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown('left'); }}
        />
        {/* Right handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-gray-900 border-2 border-blue-500 dark:border-blue-600 rounded-full cursor-ew-resize shadow"
          style={{ left: `${rightPercent}%`, transform: 'translate(-50%, -50%)' }}
          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown('right'); }}
        />
      </div>
    </div>
  );
}
