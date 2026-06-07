import { Link as RouterLink } from 'react-router-dom';
import { Zap, Shield, BarChart3, Globe } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export function Navbar() {
  return (
    <nav className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <RouterLink to="/" className="flex items-center gap-2 group">
          <Zap className="w-8 h-8 text-omni-yellow fill-omni-yellow group-hover:scale-110 transition-transform" />
          <span className="font-display font-black text-2xl tracking-tighter italic">OMNI GEO-LINK</span>
        </RouterLink>
        
        <div className="flex items-center gap-8 font-mono text-xs uppercase tracking-widest text-neutral-400">
          <RouterLink to="/dashboard" className="hover:text-omni-yellow transition-colors flex items-center gap-1">
            <BarChart3 className="w-3 h-3" /> Dashboard
          </RouterLink>
          <RouterLink to="/vista" className="hover:text-omni-yellow transition-colors flex items-center gap-1">
            <Globe className="w-3 h-3" /> Omni Vista
          </RouterLink>
          <div className="h-4 w-[1px] bg-white/20" />
          <span className="text-white font-bold">OPERATIONAL</span>
        </div>
      </div>
    </nav>
  );
}
