// frontend/src/types/animal.ts
export type GalerieMedia = {
  id?: string;
  url?: string;                    // Full URL (preferred)
  key?: string;                    // S3 key (fallback)
  typ?: 'image' | 'video';         // BE uses "typ"
  type?: 'image' | 'video';        // FE tolerance
  active?: boolean;
};

export type Animal = {
  id: string;
  name?: string | null;
  jmeno?: string | null;
  description?: string | null;
  popis?: string | null;

  charakteristik?: string | null;  // NEW: short teaser
  birthDate?: string | null;       // NEW: ISO date string from BE
  bornYear?: number | null;        // NEW: estimated year

  active?: boolean;
  main?: string | null;            // derived on BE from galerie[0] if missing
  galerie?: GalerieMedia[];

  createdAt?: string;
  updatedAt?: string;
};