import { Injectable, inject } from '@angular/core';
import { Vector3 } from 'three';
import { WorldGeneratorService } from '../generation/world-generator.service';
import { BlockPlacerService } from '../block-placer.service';
import { WorldBuilder } from '../generation/tree-generator.service';
import { InstancedRendererService } from '../../rendering/instanced-renderer.service';
import { WorldStorageService } from '../world-storage.service';

@Injectable({
  providedIn: 'root'
})
export class ChunkManagerService implements WorldBuilder {
  private readonly CHUNK_SIZE = 16;
  private readonly RENDER_DISTANCE = 6; 
  private readonly WORLD_SIZE_CHUNKS = 100;
  private readonly HALF_WORLD_SIZE = Math.floor(this.WORLD_SIZE_CHUNKS / 2);
  
  private loadedChunks = new Set<string>();
  private seed = 123;
  
  private batchBlocks: {x: number, y: number, z: number, type: string}[] = [];
  private isBatching = false;
  private worker: Worker | null = null;

  private lastChunkX = -999999;
  private lastChunkZ = -999999;

  private loadQueue: {key: string, dist: number}[] = [];
  
  // Initial Load Tracking
  private isInitialLoading = false;
  private initialLoadTotal = 0;
  private initialLoadCount = 0;
  private initialLoadProgressCallback?: (percent: number) => void;
  private initialLoadResolver?: () => void;

  private worldStorage = inject(WorldStorageService);

  constructor(
    private worldGenerator: WorldGeneratorService,
    private blockPlacer: BlockPlacerService,
    private instancedRenderer: InstancedRendererService
  ) {
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('../../workers/world-gen.worker', import.meta.url));
        this.worker.onmessage = ({ data }) => {
          this.handleWorkerMessage(data);
        };
      } catch (e) {
        console.warn('Failed to initialize Web Worker, falling back to main thread', e);
      }
    }
  }

  getRenderDistanceBlocks(): number {
      return this.RENDER_DISTANCE * this.CHUNK_SIZE;
  }

  getSeed(): number {
    return this.seed;
  }

  // WorldBuilder implementation (fallback only)
  addBlock(x: number, y: number, z: number, type: string): void {
    if (this.isBatching) {
      this.batchBlocks.push({x, y, z, type});
    } else {
      this.blockPlacer.addBlock(x, y, z, type, false); 
    }
  }

  async generateInitialChunks(playerPos: Vector3, onProgress: (percent: number) => void): Promise<void> {
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

    // Setup tracking
    this.isInitialLoading = true;
    this.initialLoadTotal = neededChunks.size;
    this.initialLoadCount = 0;
    this.initialLoadProgressCallback = onProgress;
    
    // If no chunks needed (unlikely), resolve immediately
    if (this.initialLoadTotal === 0) return Promise.resolve();

    const completionPromise = new Promise<void>(resolve => {
        this.initialLoadResolver = resolve;
    });

    const batchSize = 4; // Dispatch chunks in small batches
    const chunksArray = Array.from(neededChunks);
    
    // Start dispatching
    (async () => {
        for (let i = 0; i < chunksArray.length; i += batchSize) {
            const batch = chunksArray.slice(i, i + batchSize);
            
            for (const key of batch) {
                if (!this.loadedChunks.has(key)) {
                    const [cx, cz] = key.split(',').map(Number);
                    this.loadChunk(cx, cz, this.seed);
                    this.loadedChunks.add(key);
                } else {
                    // Already loaded? count it as done
                    this.markChunkLoaded();
                }
            }
            
            // Yield to main thread to allow UI to render
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    })();

    return completionPromise;
  }

  hasBlock(x: number, y: number, z: number): boolean {
    return this.blockPlacer.hasBlock(x, y, z);
  }

  setSeed(seed: number) {
    this.seed = seed;
    this.lastChunkX = -999999;
    this.loadedChunks.clear(); 
    this.loadQueue = [];
  }

  reset() {
    this.loadedChunks.clear();
    this.lastChunkX = -999999;
    this.lastChunkZ = -999999;
    this.batchBlocks = [];
    this.isBatching = false;
    this.isInitialLoading = false;
  }

  update(playerPos: Vector3, forceAll: boolean = false) {
    const chunkX = Math.floor(playerPos.x / this.CHUNK_SIZE);
    const chunkZ = Math.floor(playerPos.z / this.CHUNK_SIZE);

    if (forceAll || chunkX !== this.lastChunkX || chunkZ !== this.lastChunkZ) {
        this.lastChunkX = chunkX;
        this.lastChunkZ = chunkZ;
        this.recalculateChunks(chunkX, chunkZ);
    }

    this.processLoadQueue(forceAll);
  }

  private recalculateChunks(chunkX: number, chunkZ: number) {
    const neededChunks = new Set<string>();
    const newLoadQueue: {key: string, dist: number}[] = [];
    
    for (let x = -this.RENDER_DISTANCE; x <= this.RENDER_DISTANCE; x++) {
      for (let z = -this.RENDER_DISTANCE; z <= this.RENDER_DISTANCE; z++) {
        const distSq = x*x + z*z;
        if (distSq <= this.RENDER_DISTANCE * this.RENDER_DISTANCE) {
            const targetX = chunkX + x;
            const targetZ = chunkZ + z;
            
            if (Math.abs(targetX) <= this.HALF_WORLD_SIZE && Math.abs(targetZ) <= this.HALF_WORLD_SIZE) {
                const key = `${targetX},${targetZ}`;
                neededChunks.add(key);
                if (!this.loadedChunks.has(key)) {
                  newLoadQueue.push({key, dist: distSq});
                }
            }
        }
      }
    }

    for (const key of this.loadedChunks) {
      if (!neededChunks.has(key)) {
        const [cx, cz] = key.split(',').map(Number);
        this.unloadChunk(cx, cz);
        this.loadedChunks.delete(key);
      }
    }

    newLoadQueue.sort((a, b) => a.dist - b.dist);
    this.loadQueue = newLoadQueue;
  }

  private processLoadQueue(forceAll: boolean) {
    if (this.loadQueue.length === 0) return;

    const startTime = performance.now();
    // With worker, we can dispatch faster, but we shouldn't flood.
    // If using worker, budget is just for dispatching messages (very fast).
    // So we can increase budget or maxChunks.
    const timeBudget = forceAll ? 10000 : (this.worker ? 20 : 5); 

    let processedCount = 0;
    // Limit pending requests to avoid memory spikes
    const maxChunksPerFrame = forceAll ? 2000 : (this.worker ? 10 : 2); 

    while (this.loadQueue.length > 0) {
        const item = this.loadQueue[0];
        
        if (this.loadedChunks.has(item.key)) {
             this.loadQueue.shift();
             continue;
        }

        const [cx, cz] = item.key.split(',').map(Number);
        this.loadChunk(cx, cz, this.seed);
        this.loadedChunks.add(item.key);
        this.loadQueue.shift(); 
        
        processedCount++;
        
        if (processedCount >= maxChunksPerFrame) break;
        if (!forceAll && (performance.now() - startTime > timeBudget)) break;
    }
  }

  async loadChunk(cx: number, cz: number, seed: number) {
    // Try to load from storage first
    const savedChunk = await this.worldStorage.loadChunk(cx, cz);

    if (savedChunk) {
      // Use saved data
      if (savedChunk.blocks.length > 0) {
        this.blockPlacer.addBlocksBatched(savedChunk.blocks);
      }
      this.instancedRenderer.syncCounts();
      this.markChunkLoaded();
      return;
    }

    if (this.worker) {
        this.worker.postMessage({ chunkX: cx, chunkZ: cz, seed });
    } else {
        // Fallback
        this.isBatching = true;
        this.worldGenerator.generateChunk(cx, cz, this, seed);
        this.isBatching = false;

        if (this.batchBlocks.length > 0) {
            this.blockPlacer.addBlocksBatched(this.batchBlocks);
            this.batchBlocks = [];
        }
        this.instancedRenderer.syncCounts();
        
        // In sync mode, chunk is done immediately
        this.markChunkLoaded();
    }
  }

  private handleWorkerMessage(data: any) {
     const { chunkX, chunkZ, exposedBlocks, hiddenBlocks } = data;
     const key = `${chunkX},${chunkZ}`;
     
     // If chunk was unloaded while generating, ignore it
     if (!this.loadedChunks.has(key)) return;

     // Add hidden blocks directly to data structure (no render check needed)
     if (hiddenBlocks && hiddenBlocks.length > 0) {
        this.blockPlacer.addHiddenBlocks(hiddenBlocks);
     }

     // Add exposed blocks with standard logic (render check)
     if (exposedBlocks && exposedBlocks.length > 0) {
        this.blockPlacer.addBlocksBatched(exposedBlocks);
     }
     
     this.instancedRenderer.syncCounts();
     
     // Mark as completed for initial loading tracking
     this.markChunkLoaded();
  }

  private markChunkLoaded() {
      if (!this.isInitialLoading) return;

      this.initialLoadCount++;
      const percent = Math.min(100, Math.floor((this.initialLoadCount / this.initialLoadTotal) * 100));
      
      if (this.initialLoadProgressCallback) {
          this.initialLoadProgressCallback(percent);
      }

      if (this.initialLoadCount >= this.initialLoadTotal) {
          this.isInitialLoading = false;
          if (this.initialLoadResolver) {
              this.initialLoadResolver();
              this.initialLoadResolver = undefined;
          }
      }
  }

  unloadChunk(cx: number, cz: number) {
    this.blockPlacer.removeBlocksInChunk(cx, cz);
  }
}
