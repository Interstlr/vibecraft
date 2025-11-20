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
    result: { item: 'plank', count: 4 }
  },
  {
    id: 'stick',
    type: 'shaped',
    maxGridSize: 2,
    pattern: ['P', 'P'],
    key: { P: 'plank' },
    result: { item: 'stick', count: 4 }
  },
  {
    id: 'crafting_table',
    type: 'shaped',
    maxGridSize: 2,
    pattern: ['PP', 'PP'],
    key: { P: 'plank' },
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
    key: { P: 'plank', S: 'stick' },
    result: { item: 'wooden_pickaxe', count: 1 }
  },
  {
    id: 'wooden_axe',
    type: 'shaped',
    maxGridSize: 3,
    pattern: ['PP', 'PS', ' S'],
    key: { P: 'plank', S: 'stick' },
    result: { item: 'wooden_axe', count: 1 }
  }
];
