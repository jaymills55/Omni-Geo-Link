import React, { useState } from 'react';
import { Copy, Check, ShieldCheck } from 'lucide-react';

interface ResultsPanelProps {
  slug: string;
  shortUrl: string;
  qrBase64: string;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ slug, shortUrl, qrBase64 }) => {
  const [copied, setCopied] = useState(false);
  
  // Clean up URL for display (optional, but requested to "use this baseUrl")
  const displayUrl = shortUrl.replace(/^https?:\/\//, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-8 border border-omni-yellow shadow-[0_0_15px_rgba(255,255,0,0.3)] bg-black/80 p-8 flex flex-col md:flex-row gap-8 items-center animate-in fade-in slide-in-from-top-4 duration-500 relative overflow-hidden">
      {/* Decorative scanline overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,229,255,0.03)_50%,transparent_50%)] bg-[length:100%_4px] pointer-events-none"></div>
      
      {/* QR Code Section */}
      <div className="relative group shrink-0">
        <div className="absolute -inset-1 bg-omni-yellow/20 blur-md group-hover:bg-omni-yellow/40 transition-all duration-300"></div>
        <div className="relative border border-omni-yellow bg-black p-2 flex items-center justify-center min-w-[120px] min-h-[120px]">
          {qrBase64 ? (
            <img src={qrBase64} alt="QR Code" className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(255,255,0,0.5)]" />
          ) : (
            <div className="w-[120px] h-[120px] border border-dashed border-omni-yellow/50 flex items-center justify-center">
              <span className="text-[10px] text-omni-yellow/50 font-mono text-center">GENERATING<br/>MATRIX</span>
            </div>
          )}
        </div>
      </div>

      {/* URL Details Section */}
      <div className="flex-1 w-full space-y-4 relative z-10">
        <div className="flex items-center gap-2 text-omni-blue text-xs tracking-widest uppercase font-bold drop-shadow-[0_0_5px_rgba(0,229,255,0.8)]">
          <ShieldCheck className="w-4 h-4" />
          <span>Secure Routing Established</span>
        </div>
        
        <div className="flex bg-neutral-900 border border-neutral-700 focus-within:border-omni-blue focus-within:shadow-[0_0_10px_rgba(0,229,255,0.6),0_0_20px_rgba(0,229,255,0.4)] transition-all duration-300">
          <div className="px-4 flex items-center border-r border-neutral-700 bg-black text-neutral-500 font-mono text-sm">
            URL
          </div>
          <input 
            type="text" 
            readOnly 
            value={displayUrl} 
            className="flex-1 bg-transparent px-4 py-3 font-mono text-omni-yellow font-bold tracking-[0.2em] outline-none w-full text-center"
          />
          <button 
            onClick={handleCopy}
            className="px-6 py-3 bg-neutral-900 hover:bg-omni-yellow hover:text-black hover:shadow-[0_0_15px_rgba(255,255,0,0.5)] transition-all duration-300 border-l border-neutral-700 flex items-center justify-center group"
            title="Copy to Clipboard"
          >
            {copied ? <Check className="w-5 h-5 text-green-400 group-hover:text-black scale-110 transition-transform" /> : <Copy className="w-5 h-5 text-neutral-400 group-hover:text-black group-hover:scale-125 transition-transform" />}
          </button>
        </div>
      </div>
    </div>
  );
};
