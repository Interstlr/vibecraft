import { Injectable, inject } from '@angular/core';
import { WORLD_CONFIG } from '../config/world.config';
import { TreeGeneratorService, WorldBuilder } from './tree-generator.service';

@Injectable({
  providedIn: 'root'
})
export class WorldGeneratorService {
  private treeGenerator = inject(TreeGeneratorService);

  generate(world: WorldBuilder) {
    const size = WORLD_CONFIG.size;
    const halfSize = size / 2;
    
    // Seed for randomness
    const seed = Math.random() * 10000;

    for (let x = -halfSize; x < halfSize; x++) {
      for (let z = -halfSize; z < halfSize; z++) {
        
        // 1. Calculate Height (Hills)
        // Use combination of sine waves for terrain
        const nx = (x + seed) * 0.05;
        const nz = (z + seed) * 0.05;
        
        // Base terrain noise
        let heightNoise = Math.sin(nx) * Math.cos(nz) + 
                          Math.sin(nx * 0.5) * Math.cos(nz * 0.5) * 2;
        
        // Normalize somewhat and scale
        let y = Math.floor(Math.max(0, heightNoise * 2 + 1));
        
        // Flatten spawn area (radius 10)
        const distToCenter = Math.sqrt(x*x + z*z);
        if (distToCenter < 10) {
            y = 0;
        }

        // 2. Calculate Biome (Forest vs Plains)
        // Different frequency for biomes
        const bx = (x + seed) * 0.02;
        const bz = (z + seed) * 0.02;
        const biomeNoise = Math.sin(bx) * Math.cos(bz); // -1 to 1
        
        const isForest = biomeNoise > 0; // Positive noise = Forest, Negative = Plains
        
        // 3. Fill column
        // Top block is grass, below is dirt
        world.addBlock(x, y, z, 'grass');
        
        // Fill dirt/stone below
        for (let d = y - 1; d >= -2; d--) {
            world.addBlock(x, d, z, 'dirt');
        }

        // 4. Vegetation (Trees)
        // Only place trees on grass
        if (distToCenter > 10) { // Don't spawn trees in immediate spawn
            if (isForest) {
                // Higher density in forest
                if (Math.random() < 0.08) { // 8% chance in forest
                    this.treeGenerator.generate(x, y + 1, z, world);
                }
            } else {
                // Very low density in plains (rare isolated trees)
                if (Math.random() < 0.005) { // 0.5% chance in plains
                    this.treeGenerator.generate(x, y + 1, z, world);
                }
            }
        }
      }
    }

    // Place house near spawn but on surface
    // We know spawn (0,0) is at y=0 because we flattened it.
    this.createHouse(8, 1, 8, world);
  }

  private createHouse(startX: number, startY: number, startZ: number, world: WorldBuilder) {
    const width = 6, depth = 6, height = 4;
    for(let x = 0; x < width; x++) {
      for(let z = 0; z < depth; z++) {
        for(let y = 0; y < height; y++) {
          if(x === 0 || x === width - 1 || z === 0 || z === depth - 1) {
            if(x === Math.floor(width/2) && z === 0 && y < 2) continue; 
            if(x === 0 && z === Math.floor(depth/2) && y === 1) continue; 
            if(x === width - 1 && z === Math.floor(depth/2) && y === 1) continue;
            world.addBlock(startX + x, startY + y, startZ + z, 'wood');
          }
        }
      }
    }
    for(let x = 0; x < width; x++) {
      for(let z = 0; z < depth; z++) {
        world.addBlock(startX + x, startY + height, startZ + z, 'wood');
      }
    }
  }
}
