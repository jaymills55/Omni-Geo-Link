import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { Tier, Link } from '@/src/types';
import QRCode from 'qrcode';
import { Zap, QrCode, Shield, Globe, Clock, MapPin, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function LinkGenerator({ onCreated }: { onCreated: () => void }) {
  const [url, setUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [tier, setTier] = useState<Tier>(Tier.Tier1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Tier 2/3 options
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState(500);

  const generateSlug = () => {
    return Math.random().toString(36).substring(2, 8);
  };

  const handleOmnify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    setError('');

    try {
      const finalSlug = slug || generateSlug();
      
      // Check if slug taken
      const q = query(collection(db, 'links'), where('shortSlug', '==', finalSlug), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        throw new Error('Slug already taken');
      }

      const redirectUrl = `${window.location.origin}/r/${finalSlug}`;
      
      // Generate QR Code (Standardization: high contrast, 4-module quiet zone)
      const qrDataUrl = await QRCode.toDataURL(redirectUrl, {
        margin: 4,
        scale: 10,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H'
      });

      const newLink: Partial<Link> = {
        originalUrl: url,
        shortSlug: finalSlug,
        tier,
        ownerId: auth.currentUser?.uid || 'anonymous',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        qrCodeUrl: qrDataUrl
      };

      if (tier !== Tier.Tier1) {
        if (startTime && endTime) {
          newLink.temporalGate = { start: startTime, end: endTime };
        }
        if (lat !== null && lng !== null) {
          newLink.spatialGate = { lat, lng, radius };
        }
      }

      await addDoc(collection(db, 'links'), newLink);
      
      setUrl('');
      setSlug('');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-neutral-900 border border-white/10 rounded-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-omni-yellow rounded-lg">
          <Zap className="w-5 h-5 text-black" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">OMNIFY ASSET</h2>
      </div>

      <form onSubmit={handleOmnify} className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Destination URL</label>
          <input 
            type="url" 
            placeholder="https://..."
            required
            className="w-full bg-black border border-white/10 px-4 py-3 rounded-lg focus:border-omni-yellow outline-none transition-colors font-mono text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Custom Slug (Optional)</label>
            <input 
              type="text" 
              placeholder="my-link"
              className="w-full bg-black border border-white/10 px-4 py-3 rounded-lg focus:border-omni-yellow outline-none transition-colors font-mono text-sm"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Priority Tier</label>
            <select 
              className="w-full bg-black border border-white/10 px-4 py-3 rounded-lg focus:border-omni-yellow outline-none transition-colors font-mono text-sm appearance-none"
              value={tier}
              onChange={(e) => setTier(e.target.value as Tier)}
            >
              <option value={Tier.Tier1}>Tier 1 (Free)</option>
              <option value={Tier.Tier2}>Tier 2 (Pro)</option>
              <option value={Tier.Tier3}>Tier 3 (Enterprise)</option>
            </select>
          </div>
        </div>

        <AnimatePresence>
          {tier !== Tier.Tier1 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-4 pt-4 border-t border-white/5 overflow-hidden"
            >
              <div className="flex items-center gap-2 text-omni-yellow mb-2">
                <Shield className="w-4 h-4" />
                <span className="text-[10px] uppercase font-bold tracking-widest">Space-Time Perimeter Active</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Start Window</label>
                  <input type="datetime-local" className="w-full bg-black border border-white/10 px-4 py-3 rounded-lg text-xs font-mono" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">End Window</label>
                  <input type="datetime-local" className="w-full bg-black border border-white/10 px-4 py-3 rounded-lg text-xs font-mono" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Lat</label>
                  <input type="number" step="any" placeholder="0.0" className="w-full bg-black border border-white/10 px-3 py-3 rounded-lg text-xs font-mono" onChange={e => setLat(parseFloat(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Lng</label>
                  <input type="number" step="any" placeholder="0.0" className="w-full bg-black border border-white/10 px-3 py-3 rounded-lg text-xs font-mono" onChange={e => setLng(parseFloat(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Radius (m)</label>
                  <input type="number" value={radius} className="w-full bg-black border border-white/10 px-3 py-3 rounded-lg text-xs font-mono" onChange={e => setRadius(parseInt(e.target.value))} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p className="text-red-500 text-xs font-mono">{error}</p>}

        <button 
          disabled={loading}
          className="w-full bg-omni-yellow text-black font-black py-4 rounded-lg flex items-center justify-center gap-2 hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>OMNIFY <ChevronRight className="w-5 h-5" /></>}
        </button>
      </form>
    </div>
  );
}
