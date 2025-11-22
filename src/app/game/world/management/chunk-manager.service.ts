import { Injectable } from '@angular/core';
import { Vector3 } from 'three';
import { WorldGeneratorService } from '../generation/world-generator.service';
import { BlockPlacerService } from '../block-placer.service';
import { WorldBuilder } from '../generation/tree-generator.service';
import { InstancedRendererService } from '../../rendering/instanced-renderer.service';

@Injectable({
  providedIn: 'root'
})
export class ChunkManagerService implements WorldBuilder {
  private readonly CHUNK_SIZE = 16;
  private readonly RENDER_DISTANCE = 8; // Radius in chunks (8 * 16 = 128 blocks)
  private readonly WORLD_SIZE_CHUNKS = 100; // Total width/depth in chunks
  private readonly HALF_WORLD_SIZE = Math.floor(this.WORLD_SIZE_CHUNKS / 2);
  
  private loadedChunks = new Set<string>(); // 'x,z'
  private seed = 123; // Default seed
  
  private batchBlocks: {x: number, y: number, z: number, type: string}[] = [];
  private isBatching = false;

  // Optimization state
  private lastChunkX = -999999;
  private lastChunkZ = -999999;

  constructor(
    private worldGenerator: WorldGeneratorService,
    private blockPlacer: BlockPlacerService,
    private instancedRenderer: InstancedRendererService
  ) {}

  // WorldBuilder implementation
  addBlock(x: number, y: number, z: number, type: string): void {
    if (this.isBatching) {
      this.batchBlocks.push({x, y, z, type});
    } else {
      // Don't broadcast generation events to avoid network spam
      this.blockPlacer.addBlock(x, y, z, type, false); 
    }
  }

  async generateInitialChunks(playerPos: Vector3, onProgress: (percent: number) => void) {
    const chunkX = Math.floor(playerPos.x / this.CHUNK_SIZE);
    const chunkZ = Math.floor(playerPos.z / this.CHUNK_SIZE);
    this.lastChunkX = chunkX;
    this.lastChunkZ = chunkZ;

    const neededChunks = new Set<string>();
    // Calculate needed chunks within render distance
    for (let x = -this.RENDER_DISTANCE; x <= this.RENDER_DISTANCE; x++) {
      for (let z = -this.RENDER_DISTANCE; z <= this.RENDER_DISTANCE; z++) {
        // Simple circular distance check
        if (x*x + z*z <= this.RENDER_DISTANCE * this.RENDER_DISTANCE) {
            const targetX = chunkX + x;
            const targetZ = chunkZ + z;
            
            // Check world bounds
            if (Math.abs(targetX) <= this.HALF_WORLD_SIZE && Math.abs(targetZ) <= this.HALF_WORLD_SIZE) {
                neededChunks.add(`${targetX},${targetZ}`);
            }
        }
      }
    }

    const totalChunks = neededChunks.size;
    let processed = 0;
    const batchSize = 4; // Process chunks in small batches to keep UI responsive

    const chunksArray = Array.from(neededChunks);
    
    for (let i = 0; i < chunksArray.length; i += batchSize) {
        const batch = chunksArray.slice(i, i + batchSize);
        
        for (const key of batch) {
             if (!this.loadedChunks.has(key)) {
                const [cx, cz] = key.split(',').map(Number);
                this.loadChunk(cx, cz, this.seed);
                this.loadedChunks.add(key);
             }
             processed++;
        }

        onProgress(Math.min(100, (processed / totalChunks) * 100));
        
        // Yield to main thread to allow UI to render
        await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  hasBlock(x: number, y: number, z: number): boolean {
    return this.blockPlacer.hasBlock(x, y, z);
  }

  setSeed(seed: number) {
    this.seed = seed;
    this.lastChunkX = -999999;
  }

  reset() {
    this.loadedChunks.clear();
    this.lastChunkX = -999999;
    this.lastChunkZ = -999999;
    this.batchBlocks = [];
    this.isBatching = false;
  }

  update(playerPos: Vector3, forceAll: boolean = false) {
    const chunkX = Math.floor(playerPos.x / this.CHUNK_SIZE);
    const chunkZ = Math.floor(playerPos.z / this.CHUNK_SIZE);

    // OPTIMIZATION: Don't recalculate chunks if player hasn't moved to a new chunk
    // (Unless it's a forced full update)
    if (!forceAll && chunkX === this.lastChunkX && chunkZ === this.lastChunkZ) {
        return;
    }
    this.lastChunkX = chunkX;
    this.lastChunkZ = chunkZ;

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
    let loadedCount = 0;
    const maxLoads = forceAll ? 1000 : 2; // Load max 2 chunks per update if walking

    for (const key of neededChunks) {
      if (!this.loadedChunks.has(key)) {
        const [cx, cz] = key.split(',').map(Number);
        this.loadChunk(cx, cz, this.seed);
        this.loadedChunks.add(key);
        
        loadedCount++;
        if (loadedCount >= maxLoads) break; 
      }
    }
  }

  loadChunk(cx: number, cz: number, seed: number) {
    this.isBatching = true;
    this.worldGenerator.generateChunk(cx, cz, this, seed);
    this.isBatching = false;

    if (this.batchBlocks.length > 0) {
      this.blockPlacer.addBlocksBatched(this.batchBlocks);
      this.batchBlocks = [];
    }
    this.instancedRenderer.syncCounts();
  }

  unloadChunk(cx: number, cz: number) {
    this.blockPlacer.removeBlocksInChunk(cx, cz);
  }
}
