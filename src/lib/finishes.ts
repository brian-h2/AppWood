/**
 * Finish catalogue for the 3D viewer.
 *
 * Each finish defines a display colour and PBR material properties
 * (roughness, metalness) that simulate different board surfaces.
 * These are purely visual — they do not affect structural calculations.
 */

export interface Finish {
  id: string;
  /** Display name in Spanish */
  nameEs: string;
  /** Hex colour used as the base albedo in Three.js MeshStandardMaterial */
  color: string;
  /** 0 = mirror-smooth, 1 = fully rough */
  roughness: number;
  /** 0 = dielectric, 1 = fully metallic */
  metalness: number;
}

export const FINISHES: Finish[] = [
  // ---- Wood tones ----
  {
    id: 'madera-natural',
    nameEs: 'Madera Natural',
    color: '#C8A96E',
    roughness: 0.65,
    metalness: 0.05,
  },
  {
    id: 'roble-claro',
    nameEs: 'Roble Claro',
    color: '#D4B483',
    roughness: 0.70,
    metalness: 0.02,
  },
  {
    id: 'nogal',
    nameEs: 'Nogal',
    color: '#6B4226',
    roughness: 0.68,
    metalness: 0.03,
  },
  {
    id: 'cerezo',
    nameEs: 'Cerezo',
    color: '#9B4A2E',
    roughness: 0.62,
    metalness: 0.04,
  },
  {
    id: 'wengue',
    nameEs: 'Wengué',
    color: '#2C1A0E',
    roughness: 0.72,
    metalness: 0.02,
  },
  // ---- Melamine / lacquered ----
  {
    id: 'blanco-liso',
    nameEs: 'Blanco Liso',
    color: '#F5F5F0',
    roughness: 0.30,
    metalness: 0.0,
  },
  {
    id: 'blanco-perla',
    nameEs: 'Blanco Perla',
    color: '#EDE8E0',
    roughness: 0.35,
    metalness: 0.05,
  },
  {
    id: 'gris-antracita',
    nameEs: 'Gris Antracita',
    color: '#3A3A3A',
    roughness: 0.40,
    metalness: 0.08,
  },
  {
    id: 'gris-perla',
    nameEs: 'Gris Perla',
    color: '#B0AEA8',
    roughness: 0.38,
    metalness: 0.05,
  },
  {
    id: 'negro-mate',
    nameEs: 'Negro Mate',
    color: '#1A1A1A',
    roughness: 0.80,
    metalness: 0.0,
  },
  // ---- Colour accents ----
  {
    id: 'verde-salvia',
    nameEs: 'Verde Salvia',
    color: '#7A9E7E',
    roughness: 0.45,
    metalness: 0.0,
  },
  {
    id: 'azul-marino',
    nameEs: 'Azul Marino',
    color: '#1B3A5C',
    roughness: 0.42,
    metalness: 0.0,
  },
  {
    id: 'terracota',
    nameEs: 'Terracota',
    color: '#C1603A',
    roughness: 0.55,
    metalness: 0.0,
  },
];

export const DEFAULT_FINISH_ID = 'madera-natural';

export function getFinish(id: string): Finish {
  return FINISHES.find((f) => f.id === id) ?? FINISHES[0];
}
