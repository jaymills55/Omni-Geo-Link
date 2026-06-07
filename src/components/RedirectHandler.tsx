import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, limit, addDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Link, Tier, Telemetry } from '@/src/types';
import { getDistance } from 'geolib';
import { Loader2, ShieldAlert, Globe, Clock, MapPin, Zap } from 'lucide-react';
import { motion } from 'motion/react';

export function RedirectHandler() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('Verifying Gating Logic...');
  const [error, setError] = useState<{ type: 'spatial' | 'temporal' | 'notFound', details?: string } | null>(null);

  useEffect(() => {
    if (slug) processRedirect();
  }, [slug]);

  const processRedirect = async () => {
    try {
      const q = query(collection(db, 'links'), where('shortSlug', '==', slug), limit(1));
      const snap = await getDocs(q);

      if (snap.empty) {
        setError({ type: 'notFound' });
        setLoading(false);
        return;
      }

      const link = snap.docs[0].data() as Link;
      const linkId = snap.docs[0].id;

      // Tier 1 logic: Immediate bypass
      if (link.tier === Tier.Tier1) {
        window.location.href = link.originalUrl;
        return;
      }

      // Tier 2/3 Logic
      setStatus('Engaging Space-Time Perimeter...');

      // 1. Temporal Check
      if (link.temporalGate) {
        const now = new Date();
        const start = new Date(link.temporalGate.start);
        const end = new Date(link.temporalGate.end);

        if (now < start || now > end) {
          setError({ type: 'temporal', details: `Window: ${start.toLocaleString()} - ${end.toLocaleString()}` });
          setLoading(false);
          return;
        }
      }

      // 2. Spatial Check
      if (link.spatialGate) {
        setStatus('Resolving Geo-Fence Coordinates...');
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });

          const distance = getDistance(
            { latitude: position.coords.latitude, longitude: position.coords.longitude },
            { latitude: link.spatialGate.lat, longitude: link.spatialGate.lng }
          );

          if (distance > link.spatialGate.radius) {
            setError({ type: 'spatial', details: `Distance: ${distance}m (Max: ${link.spatialGate.radius}m)` });
            setLoading(false);
            return;
          }

          // Tier 3: Strategic Telemetry
          if (link.tier === Tier.Tier3) {
            await pushTelemetry(linkId, position);
          }

        } catch (err) {
          setError({ type: 'spatial', details: 'Location access required for this secure link.' });
          setLoading(false);
          return;
        }
      }

      // 3. Telemetry for Tier 3 (even without spatial gate if needed)
      if (link.tier === Tier.Tier3 && !link.spatialGate) {
         try {
           const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
           await pushTelemetry(linkId, pos);
         } catch(e) {
           // Silently continue if telemetry fails but spatial gate wasn't required
         }
      }

      setStatus('Authorization Confirmed. Redirecting...');
      setTimeout(() => {
        window.location.href = link.originalUrl;
      }, 500);

    } catch (err) {
      console.error(err);
      setError({ type: 'notFound' });
      setLoading(false);
    }
  };

  const pushTelemetry = async (linkId: string, pos: GeolocationPosition) => {
    const telemetry: Partial<Telemetry> = {
      linkId,
      timestamp: new Date().toISOString(),
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      device: navigator.userAgent,
      network: (navigator as any).connection?.effectiveType || 'unknown',
    };
    await addDoc(collection(db, `links/${linkId}/telemetry`), telemetry);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-neutral-900 border-2 border-red-500/50 p-8 rounded-2xl space-y-6"
        >
          <div className="flex justify-center">
            <div className="p-4 bg-red-500/10 rounded-full">
              <ShieldAlert className="w-12 h-12 text-red-500" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tighter uppercase text-red-500 italic">Access Denied</h1>
            <p className="text-neutral-400 font-mono text-sm tracking-tight">Space-Time Perimeter Violation</p>
          </div>

          <div className="bg-black/50 p-4 rounded-lg border border-white/5 font-mono text-left space-y-2">
             <div className="flex items-center gap-2 text-[10px] uppercase text-neutral-500 tracking-widest font-bold">
                <Globe className="w-3 h-3" /> System Logs
             </div>
             <p className="text-red-400 text-xs">ERR_GATEWAY_FAILURE: {error.type.toUpperCase()}</p>
             {error.details && <p className="text-neutral-500 text-[10px]">{error.details}</p>}
          </div>

          <button 
            onClick={() => navigate('/')}
            className="w-full bg-white text-black font-black py-4 rounded-lg uppercase tracking-widest hover:bg-neutral-200 transition-colors"
          >
            Return to Base
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="text-center space-y-8 max-w-sm w-full">
        <div className="relative inline-block">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="relative"
          >
            <Zap className="w-16 h-16 text-omni-yellow fill-omni-yellow" />
          </motion.div>
          <div className="absolute inset-0 blur-2xl bg-omni-yellow/20 animate-pulse" />
        </div>

        <div className="space-y-4">
          <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase italic">Omni Redirector</h2>
          <div className="flex flex-col items-center gap-3">
             <div className="flex items-center gap-2 text-neutral-500 font-mono text-xs uppercase tracking-[0.2em]">
                <Loader2 className="w-3 h-3 animate-spin" /> {status}
             </div>
             <div className="w-full h-[1px] bg-white/10 relative overflow-hidden">
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 bg-omni-yellow"
                />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
