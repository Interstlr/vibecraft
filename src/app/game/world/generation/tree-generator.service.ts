import { Injectable } from '@angular/core';
import { Random } from '../../../utils/random';

export interface WorldBuilder {
  addBlock(x: number, y: number, z: number, type: string): void;
  hasBlock(x: number, y: number, z: number): boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TreeGeneratorService {
  
  generate(x: number, y: number, z: number, world: WorldBuilder, random: Random) {
    // Random height between 5 and 7
    const height = 5 + random.range(0, 3);

    // Trunk
    for (let i = 0; i < height; i++) {
      world.addBlock(x, y + i, z, 'wood');
    }

    // Leaves generation
    // We generate leaves starting 3 blocks from the top of the trunk
    const leavesStart = y + height - 3;
    const leavesEnd = y + height;

    for (let ly = leavesStart; ly <= leavesEnd; ly++) {
      // Determine radius based on height relative to top
      // Top 2 layers (0 and -1 offset) have radius 1
      // Bottom 2 layers (-2 and -3 offset) have radius 2
      const offset = ly - (y + height); // 0, -1, -2, -3
      let radius = 2;
      
      if (offset >= -1) {
        radius = 1;
      }

      this.generateLeafLayer(x, ly, z, radius, world, random);
    }
  }

  private generateLeafLayer(cx: number, cy: number, cz: number, radius: number, world: WorldBuilder, random: Random) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      for (let z = cz - radius; z <= cz + radius; z++) {
        // Calculate distance from center
        const dx = Math.abs(x - cx);
        const dz = Math.abs(z - cz);
        
        // Don't replace the trunk
        // Note: The trunk goes up to y + height - 1. The top leaf layer is at y + height.
        // So we check if there is a block at current pos before placing.
        // WorldBuilder.hasBlock usually returns true for trunk.
        if (world.hasBlock(x, cy, z)) continue;

        // Corner cutting logic for rounder trees
        // If we are at the extreme corner of the square
        if (dx === radius && dz === radius) {
          // 40% chance to skip corner for radius 2 (rounder)
          // 20% chance to skip corner for radius 1
          const skipChance = radius === 2 ? 0.4 : 0.2;
          if (random.next() < skipChance) continue;
        }

        world.addBlock(x, cy, z, 'leaves');
      }
    }
  }
}
