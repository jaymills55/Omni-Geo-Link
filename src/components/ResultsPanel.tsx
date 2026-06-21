import React, { useState, useRef } from 'react';
import { Copy, Check, ShieldCheck, Download, RotateCcw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface ResultsPanelProps {
  slug: string;
  shortUrl: string;
  logoUrl?: string;
  onReset?: () => void;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ slug, shortUrl, logoUrl, onReset }) => {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<SVGSVGElement>(null);
  
  // Clean up URL for display
  const displayUrl = shortUrl.replace(/^https?:\/\//, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    if (!qrRef.current) return;
    const svgData = new XMLSerializer().serializeToString(qrRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `omni-qr-${slug}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mt-8 border border-omni-yellow shadow-[0_0_15px_rgba(255,255,0,0.3)] bg-black/80 p-8 flex flex-col md:flex-row gap-8 items-center animate-in fade-in slide-in-from-top-4 duration-500 relative overflow-hidden">
      {/* Decorative scanline overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,229,255,0.03)_50%,transparent_50%)] bg-[length:100%_4px] pointer-events-none"></div>
      
      {/* QR Code Section */}
      <div className="relative group shrink-0 flex flex-col items-center gap-4 z-10">
        <div className="relative border border-omni-yellow bg-black p-4 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,0,0.4)]">
          <QRCodeSVG 
            ref={qrRef}
            value={shortUrl} 
            size={160}
            bgColor="#0a0a0a"
            fgColor="#eaff00"
            level="H"
            includeMargin={false}
            imageSettings={logoUrl ? {
              src: logoUrl,
              height: 40,
              width: 40,
              excavate: true,
            } : undefined}
          />
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-black bg-omni-yellow px-4 py-2 hover:bg-white hover:shadow-[0_0_15px_rgba(255,255,0,0.8)] transition-all duration-300"
        >
          <Download className="w-4 h-4" /> Export SVG
        </button>
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

        {onReset && (
          <button 
            onClick={onReset}
            className="mt-4 flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-neutral-500 hover:text-omni-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Generate Another
          </button>
        )}
      </div>
    </div>
  );
};
