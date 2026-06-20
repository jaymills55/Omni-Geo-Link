import React, { useState, FormEvent } from 'react';
import { Lock, RefreshCw, ShieldAlert, Globe } from 'lucide-react';
import { Navbar } from './Navbar';

interface Metric {
  slug: string;
  long_url: string;
  custom_domain: string | null;
  scan_count: number;
  created_at: string;
}

export const AdminAnalytix: React.FC = () => {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUnlock = (e: FormEvent) => {
    e.preventDefault();
    if (password === 'OMNI-SYS-OVERRIDE') {
      setUnlocked(true);
      fetchMetrics();
    } else {
      setError(true);
      setPassword('');
      setTimeout(() => setError(false), 2000);
    }
  };

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/metrics');
      const data = await response.json();
      if (response.ok) {
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFullUrl = (slug: string) => {
    const baseUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
    return `${baseUrl.replace(/\/$/, '')}/${slug}`;
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col font-mono text-omni-white justify-center items-center relative overflow-hidden">
        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,229,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
        
        <form onSubmit={handleUnlock} className="bg-black border border-omni-yellow shadow-[0_0_20px_rgba(255,255,0,0.2)] p-12 w-full max-w-md relative z-10 flex flex-col items-center">
          <ShieldAlert className={`w-16 h-16 mb-6 ${error ? 'text-red-500 animate-pulse' : 'text-omni-yellow'}`} />
          <h2 className="text-2xl font-black tracking-widest text-white mb-2 uppercase">Restricted Area</h2>
          <p className="text-neutral-500 text-xs tracking-widest uppercase mb-8 text-center">Authentication Required</p>
          
          <div className="w-full relative mb-6">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input 
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ENTER SECURE TOKEN"
              className={`w-full bg-neutral-900 border ${error ? 'border-red-500 shadow-[0_0_10px_rgba(255,0,0,0.5)]' : 'border-neutral-700 focus:border-omni-yellow focus:shadow-[0_0_10px_rgba(255,255,0,0.3)]'} outline-none px-12 py-4 text-center font-mono tracking-widest text-omni-yellow transition-all duration-300`}
            />
          </div>
          
          <button type="submit" className="w-full brutal-button text-sm flex items-center justify-center gap-2">
            UNLOCK CONSOLE
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col font-mono text-omni-white relative">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 py-12 w-full flex-grow relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-omni-blue/30 pb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase mb-2 text-white drop-shadow-[0_0_5px_rgba(255,255,0,0.8)]">
              Admin <span className="text-omni-yellow">Analytix</span>
            </h1>
            <p className="text-neutral-500 text-xs tracking-widest uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(0,255,0,0.8)]"></span>
              Live Grid Monitoring Active
            </p>
          </div>
          
          <button 
            onClick={fetchMetrics}
            disabled={loading}
            className="mt-6 md:mt-0 border border-omni-blue bg-omni-blue/10 hover:bg-omni-blue text-omni-blue hover:text-black font-bold px-6 py-3 uppercase tracking-widest transition-all duration-300 flex items-center gap-2 shadow-[0_0_10px_rgba(0,229,255,0.2)] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            POLL DATA
          </button>
        </header>

        <div className="bg-black border border-omni-yellow/50 shadow-[0_0_15px_rgba(255,255,0,0.1)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-900 border-b border-omni-yellow/50 text-[10px] tracking-widest uppercase text-neutral-400">
                  <th className="px-6 py-4 font-bold">Generated Link</th>
                  <th className="px-6 py-4 font-bold">Destination URL</th>
                  <th className="px-6 py-4 font-bold">Custom Domain</th>
                  <th className="px-6 py-4 font-bold text-center">Total Scans</th>
                  <th className="px-6 py-4 font-bold">Date Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {metrics.map((row) => (
                  <tr key={row.slug} className="hover:bg-neutral-900/50 transition-colors group">
                    <td className="px-6 py-4">
                      <a href={getFullUrl(row.slug)} target="_blank" rel="noreferrer" className="text-omni-yellow font-bold tracking-widest flex items-center gap-2 group-hover:drop-shadow-[0_0_8px_rgba(255,255,0,0.8)] transition-all">
                        <Globe className="w-3 h-3" />
                        {row.slug}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-xs text-neutral-300 truncate max-w-[300px]">
                      {row.long_url}
                    </td>
                    <td className="px-6 py-4 text-xs text-neutral-500 uppercase tracking-wider">
                      {row.custom_domain || 'Default'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center bg-omni-blue/10 border border-omni-blue text-omni-blue font-black px-3 py-1 min-w-[3rem] shadow-[0_0_5px_rgba(0,229,255,0.3)]">
                        {row.scan_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-neutral-500 font-mono">
                      {new Date(row.created_at + 'Z').toLocaleString()}
                    </td>
                  </tr>
                ))}
                {metrics.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-neutral-600 uppercase tracking-widest text-sm">
                      No Metrics Found in Database
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
