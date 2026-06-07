import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './Navbar';
import { collection, query, orderBy, onSnapshot, collectionGroup } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Telemetry, Link } from '@/src/types';
import { Globe, MapPin, Activity, Zap, Cpu, Search } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import * as d3 from 'd3';

export function OmniVista() {
  const [telemetry, setTelemetry] = useState<Telemetry[]>([]);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // Listen for all telemetry across all links using collectionGroup
    const q = query(collectionGroup(db, 'telemetry'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Telemetry));
      setTelemetry(data);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!svgRef.current || telemetry.length === 0) return;

    // Very simple D3 heatmap/visualization
    const svg = d3.select(svgRef.current);
    const width = 800;
    const height = 400;
    
    svg.selectAll("*").remove();

    // Mock map background (just a grid for Omni feel)
    svg.append("g")
       .attr("class", "grid")
       .selectAll("line")
       .data(d3.range(0, width, 40))
       .enter().append("line")
       .attr("x1", d => d)
       .attr("y1", 0)
       .attr("x2", d => d)
       .attr("y2", height)
       .attr("stroke", "rgba(255,255,255,0.05)");

    svg.append("g")
       .attr("class", "grid")
       .selectAll("line")
       .data(d3.range(0, height, 40))
       .enter().append("line")
       .attr("x1", 0)
       .attr("y1", d => d)
       .attr("x2", width)
       .attr("y2", d => d)
       .attr("stroke", "rgba(255,255,255,0.05)");

    const projection = d3.geoMercator()
                         .scale(130)
                         .translate([width / 2, height / 1.5]);

    // Draw points
    svg.selectAll("circle")
       .data(telemetry)
       .enter()
       .append("circle")
       .attr("cx", (d: any) => projection([d.lng, d.lat])?.[0] || 0)
       .attr("cy", (d: any) => projection([d.lng, d.lat])?.[1] || 0)
       .attr("r", 4)
       .attr("fill", "#FFFF00")
       .attr("opacity", 0.6)
       .append("title")
       .text((d: any) => `Link: ${d.linkId} | Device: ${d.device}`);

  }, [telemetry]);

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-grow flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar Controls */}
        <div className="w-full lg:w-96 border-r border-white/5 bg-black/50 p-6 flex flex-col gap-6 overflow-y-auto">
           <header className="space-y-1">
             <h2 className="text-2xl font-black italic tracking-tighter uppercase">Omni-Vista</h2>
             <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Global Scan Intelligence</p>
           </header>

           <div className="space-y-4">
              <div className="bg-neutral-900 border border-white/5 p-4 rounded-lg space-y-2">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Global Pings</span>
                    <Activity className="w-3 h-3 text-omni-yellow" />
                 </div>
                 <div className="text-3xl font-mono font-black">{telemetry.length}</div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] uppercase text-neutral-500 font-bold tracking-widest flex items-center gap-2">
                    <Search className="w-3 h-3" /> Live Feed
                 </label>
                 <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {telemetry.map(t => (
                      <div key={t.id} className="p-3 bg-neutral-900/50 border border-white/5 rounded-md hover:bg-neutral-900 transition-colors cursor-crosshair group">
                         <div className="flex justify-between items-start mb-1">
                            <span className="text-[10px] font-mono text-omni-yellow font-bold">SCAN_EVENT</span>
                            <span className="text-[8px] font-mono text-neutral-600">{new Date(t.timestamp).toLocaleTimeString()}</span>
                         </div>
                         <div className="text-[10px] font-mono text-white truncate group-hover:text-omni-yellow transition-colors">
                            {t.linkId.substring(0, 8)}...
                         </div>
                         <div className="flex items-center gap-2 mt-2">
                            <div className="flex-grow h-[1px] bg-white/5" />
                            <div className="flex items-center gap-1 text-[8px] font-mono text-neutral-500">
                               <MapPin className="w-2 h-2" /> {t.lat.toFixed(4)}, {t.lng.toFixed(4)}
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
           </div>

           <div className="mt-auto pt-6 border-t border-white/5 space-y-3">
              <div className="flex items-center gap-3 p-3 bg-neutral-900 rounded-lg">
                 <Cpu className="w-5 h-5 text-neutral-500" />
                 <div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Neural Engine</div>
                    <div className="text-[10px] font-mono text-neutral-600 uppercase italic">Parsing Geo-Clusters</div>
                 </div>
              </div>
           </div>
        </div>

        {/* Map Visualization */}
        <div className="flex-grow bg-black relative flex items-center justify-center p-8 overflow-hidden omni-grid">
           <div className="absolute top-6 left-6 flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-black/80 border border-white/10 rounded-full">
                 <Zap className="w-3 h-3 text-omni-yellow" />
                 <span className="text-[10px] font-mono text-white uppercase tracking-widest">Real-Time</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-black/80 border border-white/10 rounded-full">
                 <Globe className="w-3 h-3 text-omni-yellow" />
                 <span className="text-[10px] font-mono text-white uppercase tracking-widest">Global Drift: 0.0004s</span>
              </div>
           </div>

           <div className="w-full max-w-4xl aspect-[2/1] relative">
              <svg 
                ref={svgRef} 
                className="w-full h-full"
                viewBox="0 0 800 400"
              />
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-omni-yellow" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-omni-yellow" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-omni-yellow" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-omni-yellow" />
           </div>
        </div>
      </main>
    </div>
  );
}
