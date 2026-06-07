import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, getDocs, where } from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { Link, Tier } from '@/src/types';
import { formatTimestamp } from '@/src/lib/utils';
import { ExternalLink, QrCode, Trash2, Clock, MapPin, BarChart2 } from 'lucide-react';

export function LinkList() {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app we'd filter by ownerId, but for demo we show all
    const q = query(collection(db, 'links'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Link));
      setLinks(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="animate-pulse text-xs text-neutral-500 font-mono">LINKING TO DATABASE...</div>;

  return (
    <div className="space-y-4">
      {links.map((link) => (
        <div key={link.id} className="group relative bg-neutral-900 border border-white/5 hover:border-white/20 transition-all rounded-lg overflow-hidden flex">
          {/* QR Preview */}
          <div className="w-24 h-24 bg-white p-2 flex-shrink-0 group-hover:opacity-100 opacity-90 transition-opacity">
            <img src={link.qrCodeUrl} alt="QR" className="w-full h-full object-contain" />
          </div>
          
          <div className="p-4 flex-grow grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "tier-badge",
                  link.tier === Tier.Tier1 && "bg-neutral-500 text-black",
                  link.tier === Tier.Tier2 && "bg-blue-600 text-white",
                  link.tier === Tier.Tier3 && "bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                )}>
                  {link.tier}
                </span>
                <span className="font-mono text-sm font-bold text-omni-yellow">/{link.shortSlug}</span>
              </div>
              <p className="text-neutral-500 text-[10px] font-mono truncate max-w-xs">{link.originalUrl}</p>
            </div>

            <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
               <div className="flex items-center gap-4 text-neutral-400 text-[10px] font-mono uppercase tracking-widest">
                  {link.temporalGate && <Clock className="w-3 h-3 text-omni-yellow" />}
                  {link.spatialGate && <MapPin className="w-3 h-3 text-omni-yellow" />}
               </div>
               <div className="h-6 w-[1px] bg-white/10 mx-2" />
               <a 
                href={link.qrCodeUrl} 
                download={`qr-${link.shortSlug}.png`}
                className="p-2 hover:bg-white/10 rounded-md transition-colors"
                title="Download QR"
               >
                <QrCode className="w-4 h-4" />
               </a>
               <button className="p-2 hover:bg-white/10 rounded-md transition-colors text-red-500">
                <Trash2 className="w-4 h-4" />
               </button>
            </div>
          </div>
        </div>
      ))}
      
      {links.length === 0 && (
        <div className="py-12 border-2 border-dashed border-white/5 rounded-xl text-center">
          <p className="text-neutral-600 font-mono text-xs uppercase tracking-widest">No active deployments</p>
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
