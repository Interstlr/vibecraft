export interface CraftingResult {
  item: string;
  count: number;
}

export interface CraftingRecipe {
  id: string;
  type: 'shapeless' | 'shaped';
  maxGridSize: 2 | 3;
  ingredients?: string[]; // For shapeless: ['wood']
  pattern?: string[];     // For shaped: ['AA', 'BB']
  key?: Record<string, string>; // For shaped: { A: 'wood', B: 'stone' }
  result: CraftingResult;
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'planks_from_wood',
    type: 'shapeless',
    maxGridSize: 2,
    ingredients: ['wood'],
    result: { item: 'oak_planks', count: 4 }
  },
  {
    id: 'stick',
    type: 'shaped',
    maxGridSize: 2,
    pattern: ['P', 'P'],
    key: { P: 'oak_planks' },
    result: { item: 'stick', count: 4 }
  },
  {
    id: 'crafting_table',
    type: 'shaped',
    maxGridSize: 2,
    pattern: ['PP', 'PP'],
    key: { P: 'oak_planks' },
    result: { item: 'workbench', count: 1 }
  },
  {
    id: 'torch',
    type: 'shaped',
    maxGridSize: 2,
    pattern: ['C', 'S'],
    key: { C: 'coal', S: 'stick' },
    result: { item: 'torch', count: 4 }
  },
  {
    id: 'wooden_pickaxe',
    type: 'shaped',
    maxGridSize: 3,
    pattern: ['PPP', ' S ', ' S '],
    key: { P: 'oak_planks', S: 'stick' },
    result: { item: 'wooden_pickaxe', count: 1 }
  },
  {
    id: 'wooden_axe',
    type: 'shaped',
    maxGridSize: 3,
    pattern: ['PP', 'PS', ' S'],
    key: { P: 'oak_planks', S: 'stick' },
    result: { item: 'wooden_axe', count: 1 }
  },
  {
    id: 'wooden_shovel',
    type: 'shaped',
    maxGridSize: 3,
    pattern: [' P ', ' S ', ' S '],
    key: { P: 'oak_planks', S: 'stick' },
    result: { item: 'wooden_shovel', count: 1 }
  },
  {
    id: 'wooden_sword',
    type: 'shaped',
    maxGridSize: 3,
    pattern: [' P ', ' P ', ' S '],
    key: { P: 'oak_planks', S: 'stick' },
    result: { item: 'wooden_sword', count: 1 }
  },
  {
    id: 'stone_pickaxe',
    type: 'shaped',
    maxGridSize: 3,
    pattern: ['SSS', ' S ', ' S '],
    key: { S: 'stone' },
    result: { item: 'stone_pickaxe', count: 1 }
  },
  {
    id: 'stone_axe',
    type: 'shaped',
    maxGridSize: 3,
    pattern: ['SS', 'SS', ' S'],
    key: { S: 'stone' },
    result: { item: 'stone_axe', count: 1 }
  },
  {
    id: 'stone_shovel',
    type: 'shaped',
    maxGridSize: 3,
    pattern: [' S ', ' S ', ' S '],
    key: { S: 'stone' },
    result: { item: 'stone_shovel', count: 1 }
  },
  {
    id: 'stone_sword',
    type: 'shaped',
    maxGridSize: 3,
    pattern: [' S ', ' S ', ' H '],
    key: { S: 'stone', H: 'stick' },
    result: { item: 'stone_sword', count: 1 }
  }
];
