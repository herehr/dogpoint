// frontend/src/types/animal.ts
export type GalerieMedia = {
  id: string;
  url?: string;         // Full URL (preferred)
  key?: string;         // S3 key (fallback)
  type?: 'image' | 'video';
  active?: boolean;
};

export type Animal = {
  id: string;
  name?: string;        // EN-friendly
  jmeno?: string;       // CZ-friendly – some DBs use this
  description?: string;
  popis?: string;
  galerie?: GalerieMedia[];
  active?: boolean;
};