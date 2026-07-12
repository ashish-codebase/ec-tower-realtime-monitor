'use client';

import { useState, useEffect } from 'react';
import { Site } from '@/types';

interface Props {
  sites: Site[];
  selected: string;
  onChange: (ip: string) => void;
}

interface SiteStatus {
  [key: string]: 'live' | 'not-found' | 'checking';
}

export default function SiteSelector({ sites, selected, onChange }: Props) {
  const [statuses, setStatuses] = useState<SiteStatus>({});

  // Check status of all sites
  useEffect(() => {
    const checkStatuses = async () => {
      const newStatuses: SiteStatus = {};
      
      for (const site of sites) {
        try {
          const res = await fetch(`/api/data/${site.name}.json?limit=1`, {
            signal: AbortSignal.timeout(3000)
          });
          newStatuses[site.ip] = res.ok ? 'live' : 'not-found';
        } catch {
          newStatuses[site.ip] = 'not-found';
        }
      }
      
      setStatuses(newStatuses);
    };
    
    checkStatuses();
    // Refresh every 30 seconds
    const interval = setInterval(checkStatuses, 30000);
    return () => clearInterval(interval);
  }, [sites]);

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {sites.map((site) => {
        const status = statuses[site.ip] || 'checking';
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
            <span className={`text-lg`}>
              {status === 'live' && <span title="Live">🟢</span>}
              {status === 'not-found' && <span title="Not Found">⚪</span>}
              {status === 'checking' && <span title="Checking...">🔄</span>}
            </span>
            
            {/* Site Name */}
            <span className={`text-sm font-medium`}>
              {site.name}
            </span>
            
            {/* Status Label */}
            <span className={`
              text-xs px-2 py-0.5 rounded-full
              ${status === 'live' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                : status === 'not-found'
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}
            `}>
              {status === 'live' ? 'Live' : status === 'not-found' ? 'Not Found' : 'Checking'}
            </span>
          </label>
        );
      })}
    </div>
  );
}
