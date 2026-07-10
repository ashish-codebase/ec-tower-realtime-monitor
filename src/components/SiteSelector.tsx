'use client';

import { Site } from '@/types';

interface Props {
  sites: Site[];
  selected: string;
  onChange: (ip: string) => void;
}

export default function SiteSelector({ sites, selected, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {sites.map((site) => (
        <label key={site.ip} className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="radio"
            name="site"
            value={site.ip}
            checked={selected === site.ip}
            onChange={() => onChange(site.ip)}
            className="accent-blue-500 w-4 h-4"
          />
          <span className={`text-sm ${selected === site.ip ? 'font-semibold' : ''}`}>
            {site.name}
          </span>
        </label>
      ))}
    </div>
  );
}
