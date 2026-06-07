export enum Tier {
  Tier1 = 'tier1',
  Tier2 = 'tier2',
  Tier3 = 'tier3'
}

export interface Link {
  id?: string;
  originalUrl: string;
  shortSlug: string;
  tier: Tier;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  temporalGate?: {
    start: string;
    end: string;
  };
  spatialGate?: {
    lat: number;
    lng: number;
    radius: number;
  };
  qrCodeUrl?: string;
}

export interface Telemetry {
  id?: string;
  linkId: string;
  timestamp: string;
  lat: number;
  lng: number;
  device: string;
  network: string;
  locationName?: string;
}

export interface Click {
  linkId: string;
  timestamp: string;
  count: number;
}
