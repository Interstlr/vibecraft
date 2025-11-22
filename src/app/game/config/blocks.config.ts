
export interface ProceduralConfig {
  color1: string;
  color2?: string;
  type?: 'noise' | 'wood_side' | 'workbench' | 'color' | 'flat';
}

export interface BlockFaceDefinition {
  texture?: string;
  procedural?: ProceduralConfig;
  tint?: string;
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
  tint?: string;
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
      top: { texture: 'assets/minecraft/textures/block/grass_block_top.png', tint: '#79C05A', procedural: { color1: '#567d46', color2: '#4a6b3c', type: 'noise' } },
      side: { texture: 'assets/minecraft/textures/block/grass_block_side.png', procedural: { color1: '#567d46', color2: '#594230', type: 'wood_side' } },
      bottom: { texture: 'assets/minecraft/textures/block/dirt.png', procedural: { color1: '#594230', color2: '#4a3728', type: 'noise' } }
    }
  },
  dirt:      { 
    id: 2,  
    hardness: 0.5, 
    drops: 'dirt',
    texture: 'assets/minecraft/textures/block/dirt.png',
    procedural: { color1: '#594230', color2: '#4a3728', type: 'noise' }
  },
  stone:     { 
    id: 3,  
    hardness: 1.5, 
    drops: 'cobble',
    texture: 'assets/minecraft/textures/block/stone.png',
    procedural: { color1: '#7d7d7d', color2: '#6b6b6b', type: 'noise' }
  },
  cobble:    { 
    id: 4,  
    hardness: 2.0, 
    drops: 'cobble',
    texture: 'assets/minecraft/textures/block/cobblestone.png',
    procedural: { color1: '#606060', color2: '#505050', type: 'noise' }
  },
  wood:      { 
    id: 5,  
    hardness: 2.0, 
    drops: 'wood',
    faces: {
      top: { texture: 'assets/minecraft/textures/block/oak_log_top.png', procedural: { color1: '#A0522D', color2: '#8B4513', type: 'noise' } },
      bottom: { texture: 'assets/minecraft/textures/block/oak_log_top.png', procedural: { color1: '#A0522D', color2: '#8B4513', type: 'noise' } },
      side: { texture: 'assets/minecraft/textures/block/oak_log.png', procedural: { color1: '#5D4037', color2: '#3E2723', type: 'wood_side' } }
    }
  },
  oak_planks: { 
    id: 6,  
    hardness: 2.0, 
    drops: 'oak_planks',
    texture: 'assets/minecraft/textures/block/oak_planks.png',
    procedural: { color1: '#C19A6B', color2: '#A67B5B', type: 'wood_side' }
  },
  leaves:    { 
    id: 7,  
    hardness: 0.2, 
    drops: 'leaves', 
    transparent: true,
    texture: 'assets/minecraft/textures/block/oak_leaves.png',
    tint: '#79C05A',
    procedural: { color1: '#228B22', color2: '#006400', type: 'noise' }
  },
  workbench: { 
    id: 8,  
    hardness: 2.5, 
    drops: 'workbench',
    faces: {
      top: { texture: 'assets/minecraft/textures/block/crafting_table_top.png', procedural: { color1: '#D2691E', color2: '#A0522D', type: 'workbench' } },
      side: { texture: 'assets/minecraft/textures/block/crafting_table_side.png', procedural: { color1: '#D2691E', color2: '#A0522D', type: 'workbench' } },
      bottom: { texture: 'assets/minecraft/textures/block/oak_planks.png', procedural: { color1: '#C19A6B', color2: '#A67B5B', type: 'wood_side' } }
    }
  },
  sand:      { 
    id: 9,  
    hardness: 0.5, 
    drops: 'sand', 
    texture: 'assets/minecraft/textures/block/sand.png',
  },
  water:     { id: 10, hardness: 100, drops: '', transparent: true, cullSame: true, opacity: 0.3, solid: false, procedural: { color1: '#4FC3F7', color2: '#29B6F6', type: 'flat' } },
  bedrock:   { id: 0,  hardness: -1, texture: 'assets/minecraft/textures/block/bedrock.png', procedural: { color1: '#000000', color2: '#222222', type: 'noise' } },
  
  // Items that might be referenced
  stick: { id: 100, hardness: 0, texture: 'assets/minecraft/textures/item/stick.png', transparent: true, solid: false, procedural: { color1: '#8D6E63' } },
  coal:  { id: 101, hardness: 0, texture: 'assets/minecraft/textures/item/coal.png', transparent: true, solid: false, procedural: { color1: '#212121', color2: '#000000', type: 'noise' } },
  sapling: { id: 102, hardness: 0, texture: 'assets/minecraft/textures/block/oak_sapling.png', transparent: true, solid: false, procedural: { color1: '#228B22' } },

  // Tools
  wooden_shovel: { id: 200, hardness: 0, isTool: true, texture: 'assets/minecraft/textures/item/wooden_shovel.png', transparent: true, procedural: { color1: '#C19A6B' } },
  wooden_pickaxe: { id: 201, hardness: 0, isTool: true, texture: 'assets/minecraft/textures/item/wooden_pickaxe.png', transparent: true, procedural: { color1: '#C19A6B' } },
  wooden_axe: { id: 202, hardness: 0, isTool: true, texture: 'assets/minecraft/textures/item/wooden_axe.png', transparent: true, procedural: { color1: '#C19A6B' } },
  wooden_sword: { id: 203, hardness: 0, isTool: true, texture: 'assets/minecraft/textures/item/wooden_sword.png', transparent: true, procedural: { color1: '#C19A6B' } },

  // Stone Tools
  stone_shovel: { id: 210, hardness: 0, isTool: true, texture: 'assets/minecraft/textures/item/stone_shovel.png', transparent: true, procedural: { color1: '#7d7d7d' } },
  stone_pickaxe: { id: 211, hardness: 0, isTool: true, texture: 'assets/minecraft/textures/item/stone_pickaxe.png', transparent: true, procedural: { color1: '#7d7d7d' } },
  stone_axe: { id: 212, hardness: 0, isTool: true, texture: 'assets/minecraft/textures/item/stone_axe.png', transparent: true, procedural: { color1: '#7d7d7d' } },
  stone_sword: { id: 213, hardness: 0, isTool: true, texture: 'assets/minecraft/textures/item/stone_sword.png', transparent: true, procedural: { color1: '#7d7d7d' } },
} as const;

