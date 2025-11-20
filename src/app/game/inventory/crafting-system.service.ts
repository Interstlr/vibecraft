import { Injectable } from '@angular/core';
import { InventorySlot } from './inventory-slot';
import { CRAFTING_RECIPES, CraftingRecipe } from '../config/crafting-recipes.config';

@Injectable({
  providedIn: 'root'
})
export class CraftingSystemService {

  /**
   * Tries to find a matching recipe for the given input slots.
   * @param slots Flat array of slots representing the grid (e.g., 4 slots for 2x2).
   * @param gridWidth Width of the grid (e.g., 2 for 2x2).
   */
  findRecipe(slots: InventorySlot[], gridWidth: number): InventorySlot | null {
    // 1. Filter valid recipes based on grid size availability
    // If we are in a 2x2 grid, we can't craft 3x3 recipes.
    // We assume gridHeight == gridWidth for now (square grids).
    const potentialRecipes = CRAFTING_RECIPES.filter(r => r.maxGridSize <= gridWidth);

    // 2. Parse input grid into a cleaner 2D structure
    const inputItems: (string | null)[][] = [];
    let hasItems = false;
    const inputList: string[] = []; // For shapeless check

    for (let y = 0; y < gridWidth; y++) {
      const row: (string | null)[] = [];
      for (let x = 0; x < gridWidth; x++) {
        const index = y * gridWidth + x;
        const item = slots[index]?.item || null;
        row.push(item);
        if (item) {
          hasItems = true;
          inputList.push(item);
        }
      }
      inputItems.push(row);
    }

    if (!hasItems) return null;

    // 3. Check recipes
    for (const recipe of potentialRecipes) {
      if (recipe.type === 'shapeless') {
        if (this.matchShapeless(recipe, inputList)) {
          return { item: recipe.result.item, count: recipe.result.count };
        }
      } else if (recipe.type === 'shaped') {
        if (this.matchShaped(recipe, inputItems)) {
           return { item: recipe.result.item, count: recipe.result.count };
        }
      }
    }

    return null;
  }

  private matchShapeless(recipe: CraftingRecipe, inputList: string[]): boolean {
    if (!recipe.ingredients) return false;
    
    // Count must match exactly (no extra items allowed in grid for shapeless usually? 
    // Minecraft shapeless: must contain ingredients, no extra items.
    if (inputList.length !== recipe.ingredients.length) return false;

    const inputCounts = this.countItems(inputList);
    const recipeCounts = this.countItems(recipe.ingredients);

    for (const [item, count] of Object.entries(recipeCounts)) {
      if ((inputCounts[item] || 0) !== count) return false;
    }

    return true;
  }

  private countItems(list: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of list) {
      counts[item] = (counts[item] || 0) + 1;
    }
    return counts;
  }

  private matchShaped(recipe: CraftingRecipe, fullGrid: (string | null)[][]): boolean {
    if (!recipe.pattern || !recipe.key) return false;

    // 1. Trim input grid to bounding box
    const inputBounds = this.getBounds(fullGrid);
    if (!inputBounds) return false; // Should be handled by hasItems check but safe to keep
    const { minX, minY, width: inputW, height: inputH } = inputBounds;

    // 2. Trim recipe pattern?
    // Config pattern is usually trimmed (e.g. ['AA', 'AA']).
    // But sometimes it might have spaces? [' A ', ' A '].
    // We should probably normalize the recipe pattern too, or assume it's minimal.
    // User example: ['PPP', ' S ', ' S ']. This has spaces.
    // So we must parse the pattern into a grid and trim it too.
    
    const recipeGrid = this.parsePatternToGrid(recipe.pattern, recipe.key);
    const recipeBounds = this.getBounds(recipeGrid);
    if (!recipeBounds) return false; // Empty pattern?
    const { minX: rMinX, minY: rMinY, width: recipeW, height: recipeH } = recipeBounds;

    // 3. Compare dimensions
    if (inputW !== recipeW || inputH !== recipeH) return false;

    // 4. Compare items
    for (let y = 0; y < recipeH; y++) {
      for (let x = 0; x < recipeW; x++) {
        const recipeItem = recipeGrid[rMinY + y][rMinX + x];
        const inputItem = fullGrid[minY + y][minX + x];

        if (recipeItem !== inputItem) return false;
      }
    }

    return true;
  }

  private getBounds(grid: (string | null)[][]) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let empty = true;

    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x] !== null) {
          empty = false;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (empty) return null;
    return { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  private parsePatternToGrid(pattern: string[], key: Record<string, string>): (string | null)[][] {
    return pattern.map(rowStr => {
      return rowStr.split('').map(char => {
        if (char === ' ') return null;
        return key[char] || null; // If char not in key, assume null/air? Or error? Assume null/air.
      });
    });
  }
}
