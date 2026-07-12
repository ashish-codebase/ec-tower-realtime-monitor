'use client';

import { Site } from '@/types';

interface Props {
  sites: Site[];
  selected: string;
  onChange: (ip: string) => void;
  status?: 'live' | 'not-found' | 'checking';
}

export default function SiteSelector({ sites, selected, onChange, status }: Props) {
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {sites.map((site) => {
        const isSelected = selected === site.ip;
        
        return (
          <label
            key={site.ip}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer select-none transition-all
              ${isSelected 
                ? 'bg-blue-600 text-white shadow-lg scale-105' 
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}
            `}
          >
            <input
              type="radio"
              name="site"
              value={site.ip}
              checked={isSelected}
              onChange={() => onChange(site.ip)}
              className="accent-blue-500 w-4 h-4"
            />
            
            {/* Status Icon */}
            <span className="text-lg">
              {status === 'live' && '🟢'}
              {status === 'not-found' && '⚪'}
              {status === 'checking' && '🔄'}
            </span>
            
            {/* Site Name */}
            <span className="text-sm font-medium">
              {site.name}
            </span>
          </label>
        );
      })}
    </div>
  );
}
