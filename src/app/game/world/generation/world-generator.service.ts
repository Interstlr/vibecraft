import { Injectable, inject } from '@angular/core';
import { TreeGeneratorService, WorldBuilder } from './tree-generator.service';
import { Random } from '../../../utils/random';

@Injectable({
  providedIn: 'root'
})
export class WorldGeneratorService {
  private treeGenerator = inject(TreeGeneratorService);
  private readonly CHUNK_SIZE = 16;
  
  // Generate a 16x16 chunk at the specified chunk coordinates
  generateChunk(chunkX: number, chunkZ: number, world: WorldBuilder, seed: number) {
    const startX = chunkX * this.CHUNK_SIZE;
    const startZ = chunkZ * this.CHUNK_SIZE;
    const endX = startX + this.CHUNK_SIZE;
    const endZ = startZ + this.CHUNK_SIZE;

    // Generate base terrain for each column in the chunk
    for (let x = startX; x < endX; x++) {
      for (let z = startZ; z < endZ; z++) {
        this.generateColumn(x, z, world, seed);
      }
    }
  }

  // Get the surface height at world coordinates (for player spawning, etc.)
  getSurfaceHeight(x: number, z: number, seed: number): number {
    return this.getHeight(x, z, seed);
  }

  private generateColumn(x: number, z: number, world: WorldBuilder, seed: number) {
    const height = this.getHeight(x, z, seed);
    
    // Bedrock layer
    world.addBlock(x, 0, z, 'stone'); 

    // Stone layer up to just below dirt
    const stoneHeight = height - 3;
    for (let y = 1; y < stoneHeight; y++) {
      world.addBlock(x, y, z, 'stone');
    }

    // Dirt layer
    for (let y = Math.max(1, stoneHeight); y < height; y++) {
      world.addBlock(x, y, z, 'dirt');
    }

    // Surface block (grass)
    world.addBlock(x, height, z, 'grass');

    // Attempt to generate trees
    this.trySpawnTree(x, height, z, world, seed);
  }

  private getHeight(x: number, z: number, seed: number): number {
    const nx = (x + seed) * 0.05;
    const nz = (z + seed) * 0.05;
    
    // Combine sine waves for some terrain variation
    const heightNoise = Math.sin(nx) * Math.cos(nz) +
                        Math.sin(nx * 0.5) * Math.cos(nz * 0.5) * 2;
    
    // Base height of 10 plus variations
    // Ensure height is at least 1
    return Math.max(1, Math.floor(10 + heightNoise * 4));
  }

  private trySpawnTree(x: number, surfaceY: number, z: number, world: WorldBuilder, seed: number) {
    // Simple pseudo-random check for tree placement based on position
    // Use a different frequency/offset than terrain to avoid grid artifacts
    const treeNoise = Math.sin((x + seed) * 0.23) * Math.cos((z + seed) * 0.17);
    
    // Threshold determines tree density
    if (treeNoise > 0.95) {
      // Create a deterministic random instance for this tree
      const random = new Random(seed + x * 1000 + z);
      this.treeGenerator.generate(x, surfaceY + 1, z, world, random);
    }
  }
}
