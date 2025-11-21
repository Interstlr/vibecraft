export interface ItemConfig {
  maxStack: number;
}

export const ITEMS_CONFIG: Record<string, ItemConfig> = {
  wood:     { maxStack: 64 },
  plank:    { maxStack: 64 },
  stick:    { maxStack: 64 },
  dirt:     { maxStack: 64 },
  grass:    { maxStack: 64 },
  stone:    { maxStack: 64 },
  cobble:   { maxStack: 64 },
  sand:     { maxStack: 64 },
  leaves:   { maxStack: 64 },
  workbench:{ maxStack: 64 },
  
  diamond:  { maxStack: 64 },
  coal:     { maxStack: 64 },
  iron:     { maxStack: 64 },
  gold:     { maxStack: 64 },
  
  sword:    { maxStack: 1 },
  pickaxe:  { maxStack: 1 },
  axe:      { maxStack: 1 },
  shovel:   { maxStack: 1 },
  
  // Wooden tools
  wooden_axe:      { maxStack: 1 },
  wooden_pickaxe:  { maxStack: 1 },
  wooden_shovel:   { maxStack: 1 },
  wooden_sword:    { maxStack: 1 },
  
  // Stone tools
  stone_pickaxe:  { maxStack: 1 },
  stone_axe:      { maxStack: 1 },
  stone_shovel:   { maxStack: 1 },
  stone_sword:    { maxStack: 1 },
  
  oak_planks: { maxStack: 64 },
} as const;

