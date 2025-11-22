import { Injectable, inject } from '@angular/core';
import { TreeGeneratorService, WorldBuilder } from './tree-generator.service';
import { Random } from '../../../utils/random';
import { createNoise2D, NoiseFunction2D } from 'simplex-noise';

@Injectable({
  providedIn: 'root'
})
export class WorldGeneratorService {
  private readonly CHUNK_SIZE = 16;
  private noise2D: NoiseFunction2D | null = null;
  private currentSeed: number | null = null;
  
  constructor(private treeGenerator: TreeGeneratorService) {}

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
    world.addBlock(x, 0, z, 'stone'); // Actually should be bedrock if defined, but stone for now based on previous code

    // Stone layer up to just below dirt
    // Ensure we don't go below 1
    const stoneHeight = Math.max(1, height - 3);
    
    for (let y = 1; y < stoneHeight; y++) {
      // Deeper stone could be different, but keep it simple
      world.addBlock(x, y, z, 'stone');
    }

    // Dirt layer
    for (let y = stoneHeight; y < height; y++) {
      world.addBlock(x, y, z, 'dirt');
    }

    // Surface block (grass)
    world.addBlock(x, height, z, 'grass');

    // Attempt to generate trees
    this.trySpawnTree(x, height, z, world, seed);
  }

  private getHeight(x: number, z: number, seed: number): number {
    if (this.currentSeed !== seed || !this.noise2D) {
        // Initialize noise function with a string seed derived from the number
        // Simple hash to make it deterministic
        this.noise2D = createNoise2D(() => {
            const s = Math.sin(seed++) * 10000; 
            return s - Math.floor(s);
        });
        this.currentSeed = seed;
    }

    // Fractional Brownian Motion
    // First, generate a "continentalness" or "roughness" map
    // Low frequency noise to determine if we are in a flat area or mountain area
    const roughness = this.noise2D(x * 0.001, z * 0.001); // -1 to 1
    
    // Map roughness to an amplitude multiplier
    // If roughness > 0, we get mountains. If < 0, plains/hills.
    // Normalize -1..1 to 0..1
    const mountainFactor = (roughness + 1) / 2;
    
    // Non-linear curve to make mountains rarer but higher
    // x^3 curve: 0->0, 0.5->0.125, 1->1
    const heightMultiplier = Math.pow(mountainFactor, 3);
    
    // Dynamic amplitude: Plains ~12, Mountains ~80
    let amplitude = 12 + (heightMultiplier * 80);
    
    let frequency = 0.005; // Lower frequency for wider mountains
    let noiseValue = 0;
    
    // 4 Octaves
    for(let i = 0; i < 4; i++) {
        noiseValue += this.noise2D(x * frequency, z * frequency) * amplitude;
        amplitude *= 0.4; // Reduce amplitude faster for detail
        frequency *= 2.5; // Increase frequency faster for detail
    }
    
    // Base height also varies slightly with roughness to lift mountains up
    const baseHeight = 30 + (heightMultiplier * 30); 
    
    return Math.max(5, Math.floor(baseHeight + noiseValue));
  }

  private trySpawnTree(x: number, surfaceY: number, z: number, world: WorldBuilder, seed: number) {
    if (!this.noise2D) return; // Should already be initialized by getHeight

    // Use noise for tree distribution (clumping)
    // Low frequency noise for forest areas
    const forestNoise = this.noise2D(x * 0.01, z * 0.01);
    
    // Higher frequency for individual tree placement, modulated by forest noise
    // Trees only appear where forestNoise > 0 (forest areas)
    if (forestNoise > 0.2) {
        // Simple high freq noise for density
        const treeDensity = this.noise2D(x * 0.5 + 1000, z * 0.5 + 1000);
        
        // Threshold based on how deep in the "forest" we are
        const threshold = 0.6; // Only spawn if density is high enough
        
        if (treeDensity > threshold) {
             const random = new Random(seed + x * 3412 + z * 9231);
             // Add randomness to avoid perfect grid even with noise peaks
             if (random.next() > 0.3) {
                 this.treeGenerator.generate(x, surfaceY + 1, z, world, random);
             }
        }
    } else if (forestNoise > -0.1) {
         // Sparse trees outside deep forests
         const random = new Random(seed + x * 3412 + z * 9231);
         if (random.next() > 0.98) {
              this.treeGenerator.generate(x, surfaceY + 1, z, world, random);
         }
    }
  }
}
