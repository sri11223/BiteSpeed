import { useEffect, useState } from 'react';
import { checkHealth } from '../services/api';

export function Header() {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        await checkHealth();
        setHealthy(true);
      } catch {
        setHealthy(false);
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Bitespeed</h1>
              <p className="text-xs text-gray-500 -mt-0.5">Identity Reconciliation</p>
            </div>
          </div>

          {/* Health Status */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  healthy === null
                    ? 'bg-gray-300 animate-pulse'
                    : healthy
                    ? 'bg-green-500'
                    : 'bg-red-500'
                }`}
              />
              <span className="text-gray-600">
                {healthy === null ? 'Checking...' : healthy ? 'API Online' : 'API Offline'}
              </span>
            </div>
            <a
              href="/api-docs"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              API Docs &rarr;
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
