import { Injectable } from '@angular/core';
import { Vector3 } from 'three';
import { WorldGeneratorService } from '../generation/world-generator.service';
import { BlockPlacerService } from '../block-placer.service';
import { WorldBuilder } from '../generation/tree-generator.service';

@Injectable({
  providedIn: 'root'
})
export class ChunkManagerService implements WorldBuilder {
  private readonly CHUNK_SIZE = 16;
  private readonly RENDER_DISTANCE = 3; // Radius in chunks
  private readonly WORLD_SIZE_CHUNKS = 100; // Total width/depth in chunks
  private readonly HALF_WORLD_SIZE = Math.floor(this.WORLD_SIZE_CHUNKS / 2);
  
  private loadedChunks = new Set<string>(); // 'x,z'
  private seed = 123; // Default seed

  constructor(
    private worldGenerator: WorldGeneratorService,
    private blockPlacer: BlockPlacerService
  ) {}

  // WorldBuilder implementation
  addBlock(x: number, y: number, z: number, type: string): void {
    // Don't broadcast generation events to avoid network spam
    this.blockPlacer.addBlock(x, y, z, type, false); 
  }

  hasBlock(x: number, y: number, z: number): boolean {
    return this.blockPlacer.hasBlock(x, y, z);
  }

  setSeed(seed: number) {
    this.seed = seed;
  }

  update(playerPos: Vector3, forceAll: boolean = false) {
    const chunkX = Math.floor(playerPos.x / this.CHUNK_SIZE);
    const chunkZ = Math.floor(playerPos.z / this.CHUNK_SIZE);

    const neededChunks = new Set<string>();
    
    // Calculate needed chunks within render distance
    for (let x = -this.RENDER_DISTANCE; x <= this.RENDER_DISTANCE; x++) {
      for (let z = -this.RENDER_DISTANCE; z <= this.RENDER_DISTANCE; z++) {
        // Simple circular distance check
        if (x*x + z*z <= this.RENDER_DISTANCE * this.RENDER_DISTANCE) {
            const targetX = chunkX + x;
            const targetZ = chunkZ + z;
            
            // Check world bounds (-50 to +50 roughly)
            if (Math.abs(targetX) <= this.HALF_WORLD_SIZE && Math.abs(targetZ) <= this.HALF_WORLD_SIZE) {
                neededChunks.add(`${targetX},${targetZ}`);
            }
        }
      }
    }

    // 1. Unload old chunks FIRST to free up resources
    for (const key of this.loadedChunks) {
      if (!neededChunks.has(key)) {
        const [cx, cz] = key.split(',').map(Number);
        this.unloadChunk(cx, cz);
        this.loadedChunks.delete(key);
      }
    }

    // 2. Load new chunks
    // If forceAll is true, we load ALL needed chunks at once (e.g. initial spawn)
    // Otherwise, we load only ONE per frame to smooth out performance
    for (const key of neededChunks) {
      if (!this.loadedChunks.has(key)) {
        const [cx, cz] = key.split(',').map(Number);
        this.loadChunk(cx, cz, this.seed);
        this.loadedChunks.add(key);
        if (!forceAll) break; // Stop after loading 1 chunk if not forced
      }
    }
  }

  loadChunk(cx: number, cz: number, seed: number) {
    this.worldGenerator.generateChunk(cx, cz, this, seed);
  }

  unloadChunk(cx: number, cz: number) {
    this.blockPlacer.removeBlocksInChunk(cx, cz);
  }
}
