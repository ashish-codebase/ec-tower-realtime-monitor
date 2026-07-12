'use client';

import { Site } from '@/types';

interface Props {
  sites: Site[];
  selected: string;
  onChange: (ip: string) => void;
  siteStatuses?: { [key: string]: 'live' | 'not-found' | 'checking' };
}

export default function SiteSelector({ sites, selected, onChange, siteStatuses }: Props) {
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {sites.map((site) => {
        const isSelected = selected === site.ip;
        const status = siteStatuses?.[site.ip] || 'checking';
        
        return (
          <label
            key={site.ip}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer select-none transition-all
              ${isSelected 
                ? 'bg-blue-600 text-white shadow-lg scale-105' 
                : status === 'not-found'
                ? 'bg-gray-200 dark:bg-gray-700 opacity-50'
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}
            `}
          >
            <input
              type="radio"
              name="site"
              value={site.ip}
              checked={isSelected}
              onChange={() => onChange(site.ip)}
              className={`w-4 h-4 ${status === 'not-found' ? 'accent-red-600' : 'accent-blue-500'}`}
              disabled={status === 'not-found' && !isSelected}
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
