export interface ProceduralConfig {
  color1: string;
  color2?: string;
  type?: 'noise' | 'wood_side' | 'workbench' | 'color' | 'flat';
}

export interface BlockFaceDefinition {
  texture?: string;
  procedural?: ProceduralConfig;
}

export interface BlockConfig {
  id: number;
  hardness: number;
  drops?: string;
  tick?: boolean;
  facesSun?: boolean;
  transparent?: boolean;
  cullSame?: boolean;
  opacity?: number;
  lightLevel?: number;
  isTool?: boolean;
  solid?: boolean;
  texture?: string;
  procedural?: ProceduralConfig;
  faces?: {
      top?: BlockFaceDefinition;
      bottom?: BlockFaceDefinition;
      left?: BlockFaceDefinition;
      right?: BlockFaceDefinition;
      front?: BlockFaceDefinition;
      back?: BlockFaceDefinition;
      side?: BlockFaceDefinition;
  }
}

// Alias for backward compatibility if needed, or use BlockConfig everywhere
export type BlockDefinition = BlockConfig;

export const BLOCKS: Record<string, BlockConfig> = {
  grass:     { 
    id: 1,  
    hardness: 0.6, 
    drops: 'dirt',     
    tick: true,
    faces: {
      top: { texture: 'assets/textures/grass-top.webp', procedural: { color1: '#567d46', color2: '#4a6b3c', type: 'noise' } },
      side: { texture: 'assets/textures/grass-side.webp', procedural: { color1: '#567d46', color2: '#594230', type: 'wood_side' } },
      bottom: { texture: 'assets/textures/dirt.png', procedural: { color1: '#594230', color2: '#4a3728', type: 'noise' } }
    }
  },
  dirt:      { 
    id: 2,  
    hardness: 0.5, 
    drops: 'dirt',
    texture: 'assets/textures/dirt.png',
    procedural: { color1: '#594230', color2: '#4a3728', type: 'noise' }
  },
  stone:     { 
    id: 3,  
    hardness: 1.5, 
    drops: 'cobble',
    texture: 'assets/textures/stone.png',
    procedural: { color1: '#7d7d7d', color2: '#6b6b6b', type: 'noise' }
  },
  cobble:    { 
    id: 4,  
    hardness: 2.0, 
    drops: 'cobble',
    procedural: { color1: '#606060', color2: '#505050', type: 'noise' }
  },
  wood:      { 
    id: 5,  
    hardness: 2.0, 
    drops: 'wood',
    faces: {
      top: { texture: 'assets/textures/oak-top.webp', procedural: { color1: '#A0522D', color2: '#8B4513', type: 'noise' } },
      bottom: { texture: 'assets/textures/oak-top.webp', procedural: { color1: '#A0522D', color2: '#8B4513', type: 'noise' } },
      side: { texture: 'assets/textures/oak-side.png', procedural: { color1: '#5D4037', color2: '#3E2723', type: 'wood_side' } }
    }
  },
  oak_planks: { 
    id: 6,  
    hardness: 2.0, 
    drops: 'oak_planks',
    texture: 'assets/textures/oak_planks.png',
    procedural: { color1: '#C19A6B', color2: '#A67B5B', type: 'wood_side' }
  },
  leaves:    { 
    id: 7,  
    hardness: 0.2, 
    drops: 'sapling', 
    transparent: true,
    texture: 'assets/textures/leaves.webp',
    procedural: { color1: '#228B22', color2: '#006400', type: 'noise' }
  },
  workbench: { 
    id: 8,  
    hardness: 2.5, 
    drops: 'workbench',
    faces: {
      top: { texture: 'assets/textures/workbench_top.png', procedural: { color1: '#D2691E', color2: '#A0522D', type: 'workbench' } },
      side: { texture: 'assets/textures/workbench_side.webp', procedural: { color1: '#D2691E', color2: '#A0522D', type: 'workbench' } },
      bottom: { texture: 'assets/textures/oak_planks.png', procedural: { color1: '#C19A6B', color2: '#A67B5B', type: 'wood_side' } }
    }
  },
  sand:      { 
    id: 9,  
    hardness: 0.5, 
    drops: 'sand', 
    texture: 'assets/textures/sand.webp',
  },
  water:     { id: 10, hardness: 100, drops: '', transparent: true, cullSame: true, opacity: 0.3, solid: false, procedural: { color1: '#4FC3F7', color2: '#29B6F6', type: 'flat' } },
  bedrock:   { id: 0,  hardness: -1, procedural: { color1: '#000000', color2: '#222222', type: 'noise' } },
  
  // Items that might be referenced
  stick: { id: 100, hardness: 0, procedural: { color1: '#8D6E63' } },
  coal:  { id: 101, hardness: 0, procedural: { color1: '#212121', color2: '#000000', type: 'noise' } },
} as const;
