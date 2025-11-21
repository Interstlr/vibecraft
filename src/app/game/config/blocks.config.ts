export interface BlockConfig {
  id: number;
  hardness: number;
  drops?: string;
  tick?: boolean;
  facesSun?: boolean;
  transparent?: boolean;
  lightLevel?: number;
  isTool?: boolean;
  procedural?: {
      color1?: string;
  }
}

export const BLOCKS: Record<string, BlockConfig> = {
  grass:     { id: 1,  hardness: 0.6, drops: 'dirt',     tick: true },
  dirt:      { id: 2,  hardness: 0.5, drops: 'dirt' },
  stone:     { id: 3,  hardness: 1.5, drops: 'cobble' },
  cobble:    { id: 4,  hardness: 2.0, drops: 'cobble' },
  wood:      { id: 5,  hardness: 2.0, drops: 'wood' },
  oak_planks: { id: 6,  hardness: 2.0, drops: 'oak_planks' },
  leaves:    { id: 7,  hardness: 0.2, drops: 'sapling', transparent: true },
  workbench: { id: 8,  hardness: 2.5, drops: 'workbench' },
  sand:      { id: 9,  hardness: 0.5, drops: 'sand' },
  bedrock:   { id: 0,  hardness: -1 },
  
  // Items that might be referenced
  stick: { id: 100, hardness: 0, procedural: { color1: '#8D6E63' } },
  coal:  { id: 101, hardness: 0 },
} as const;

