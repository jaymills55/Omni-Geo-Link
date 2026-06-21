/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { RedirectHandler } from './components/RedirectHandler';
import { OmniVista } from './components/OmniVista';
import { Zap, Shield } from 'lucide-react';
import { useState } from 'react';
import { ResultsPanel } from './components/ResultsPanel';
import { AdminAnalytix } from './components/AdminAnalytix';

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", 
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", 
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", 
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", 
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const Dashboard = () => {
  const [url, setUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSlug, setGeneratedSlug] = useState<string | null>(null);
  const [generatedShortUrl, setGeneratedShortUrl] = useState<string | null>(null);
  
  // Tier 2 Geo-Fencing State
  const [geoActive, setGeoActive] = useState(false);
  const [targetRegion, setTargetRegion] = useState('');
  const [alternateUrl, setAlternateUrl] = useState('');

  // Tier 3 Advanced QR Customization
  const [logoUrl, setLogoUrl] = useState('');

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setIsGenerating(true);
    setGeneratedSlug(null);
    setGeneratedShortUrl(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          longUrl: url,
          geoActive,
          targetRegion: geoActive ? targetRegion : null,
          alternateUrl: geoActive ? alternateUrl : null,
          logoUrl: logoUrl || null
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setGeneratedSlug(data.slug);
        setGeneratedShortUrl(data.shortUrl);
        setQrBase64(data.qrBase64);
      } else {
        console.error('Generation failed:', data.error);
      }
    } catch (error) {
      console.error('Network error during generation:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 omni-grid flex flex-col font-mono text-omni-white">
      <Navbar />
      
      <main className="max-w-2xl mx-auto px-4 py-20 flex-grow w-full flex flex-col justify-center">
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-omni-yellow/10 border border-omni-yellow/50 mb-6 shadow-[0_0_15px_rgba(255,255,0,0.15)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-omni-yellow opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-omni-yellow"></span>
            </span>
            <span className="text-[10px] text-omni-yellow font-bold uppercase tracking-widest">Tier 1 Operational Console</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter uppercase mb-4 text-white">
            Secure Geo-Link <span className="text-omni-yellow drop-shadow-[0_0_5px_rgba(255,255,0,0.8)]">Generator</span>
          </h1>
          <p className="text-neutral-500 text-sm tracking-widest uppercase">
            Awaiting destination coordinates...
          </p>
        </header>

        <form onSubmit={handleInitiate} className="space-y-8 relative z-10">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-omni-blue/30 blur opacity-50 group-focus-within:opacity-100 group-focus-within:shadow-[0_0_10px_rgba(0,229,255,0.6),0_0_20px_rgba(0,229,255,0.4)] transition duration-500"></div>
            <div className="relative flex bg-black border border-omni-blue/50 focus-within:border-omni-blue transition-colors duration-300">
              <div className="flex items-center px-4 border-r border-omni-blue/30 bg-omni-blue/10 text-omni-blue font-bold tracking-widest text-xs shrink-0">
                TARGET_URL
              </div>
              <input 
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://long-destination-url.com/path/to/resource"
                className="flex-1 bg-transparent px-6 py-4 text-white placeholder-neutral-700 outline-none w-full font-mono min-w-0"
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Advanced Routing Section */}
          <div className="border border-neutral-800 bg-black/50 p-6 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={geoActive}
                onChange={(e) => setGeoActive(e.target.checked)}
                className="w-4 h-4 bg-transparent border border-omni-blue/50 appearance-none checked:bg-omni-yellow checked:border-omni-yellow relative before:content-[''] before:absolute before:inset-0 before:opacity-0 checked:before:opacity-100 before:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwb2x5bGluZSBwb2ludHM9IjIwIDYgOSAxNyA0IDEyIj48L3BvbHlsaW5lPjwvc3ZnPg==')] before:bg-no-repeat before:bg-center cursor-pointer outline-none transition-all shadow-[0_0_10px_rgba(255,255,0,0)] checked:shadow-[0_0_10px_rgba(255,255,0,0.5)]"
              />
              <span className={`text-sm tracking-widest uppercase font-bold transition-colors ${geoActive ? 'text-omni-yellow' : 'text-neutral-500 group-hover:text-omni-white'}`}>
                Enable Geo-Fencing (Tier 2)
              </span>
            </label>

            {geoActive && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-neutral-800 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="relative">
                  <div className="text-[10px] text-omni-yellow font-bold tracking-widest uppercase mb-2">Target Region (State)</div>
                  <select 
                    required={geoActive}
                    value={targetRegion}
                    onChange={(e) => setTargetRegion(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 focus:border-omni-yellow focus:shadow-[0_0_10px_rgba(255,255,0,0.3)] text-omni-white px-4 py-3 outline-none font-mono text-sm appearance-none cursor-pointer"
                  >
                    <option value="" disabled>SELECT STATE</option>
                    {US_STATES.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                
                <div className="relative">
                  <div className="text-[10px] text-omni-yellow font-bold tracking-widest uppercase mb-2">Alternate URL</div>
                  <input 
                    type="url"
                    required={geoActive}
                    value={alternateUrl}
                    onChange={(e) => setAlternateUrl(e.target.value)}
                    placeholder="https://regional-destination.com"
                    className="w-full bg-neutral-900 border border-neutral-700 focus:border-omni-yellow focus:shadow-[0_0_10px_rgba(255,255,0,0.3)] text-omni-white px-4 py-3 outline-none font-mono text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Visual Branding Section */}
          <div className="border border-neutral-800 bg-black/50 p-6 space-y-4">
            <h3 className="text-sm tracking-widest uppercase font-bold text-omni-yellow">Visual Branding (Tier 3)</h3>
            <div className="relative">
              <div className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase mb-2">QR Center Logo (URL)</div>
              <input 
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full bg-neutral-900 border border-neutral-700 focus:border-omni-yellow focus:shadow-[0_0_10px_rgba(255,255,0,0.3)] text-omni-white px-4 py-3 outline-none font-mono text-sm"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isGenerating || !url}
            className="w-full brutal-button disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group relative overflow-hidden"
          >
            {isGenerating ? (
              <>
                <span className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full group-hover:border-black group-hover:border-t-transparent border-omni-yellow border-t-transparent"></span>
                <span className="tracking-widest">PROCESSING SEQUENCE...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="tracking-widest font-black text-lg">INITIATE OMNI-LINK</span>
              </>
            )}
          </button>
        </form>

        {generatedSlug && generatedShortUrl && (
          <ResultsPanel 
            slug={generatedSlug} 
            shortUrl={generatedShortUrl} 
            logoUrl={logoUrl}
            onReset={() => {
              setGeneratedSlug(null);
              setGeneratedShortUrl(null);
              setUrl('');
              setGeoActive(false);
              setTargetRegion('');
              setAlternateUrl('');
              setLogoUrl('');
            }}
          />
        )}
      </main>

      <footer className="border-t border-omni-blue/20 py-6 bg-black/80 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-[10px] tracking-widest text-neutral-500 uppercase">
           <div className="font-bold text-omni-white opacity-50 hover:opacity-100 transition-opacity flex items-center gap-2">
             <Shield className="w-3 h-3" />
             OMNI ANALYTIX
           </div>
           <div className="flex gap-6 mt-4 md:mt-0">
             <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-omni-yellow inline-block shadow-[0_0_10px_rgba(255,255,0,0.6),0_0_20px_rgba(255,255,0,0.4)]"></span> SYS_ACTIVE</span>
             <span>ENCRYPTION: AES-256</span>
             <span>© 2026</span>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/vista" element={<OmniVista />} />
        <Route path="/omni-admin" element={<AdminAnalytix />} />
        <Route path="/r/:slug" element={<RedirectHandler />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
