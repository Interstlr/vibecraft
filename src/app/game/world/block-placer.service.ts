import { Injectable } from '@angular/core';
import { InstancedRendererService } from '../rendering/instanced-renderer.service';
import { GameStateService } from '../../services/game-state.service';
import { MultiplayerService } from '../networking/multiplayer.service';

export interface BlockInstance {
  type: string;
  instanceId: number;
}

export type BlockUpdateCallback = (x: number, y: number, z: number, type: string, action: 'add' | 'remove') => void;

@Injectable({
  providedIn: 'root',
})
export class BlockPlacerService {
  private blockData = new Map<string, BlockInstance>();
  private chunkBlocks = new Map<string, Set<string>>(); // chunkKey -> Set<blockKey>
  private listeners: BlockUpdateCallback[] = [];
  private readonly CHUNK_SIZE = 16;

  constructor(
    private instancedRenderer: InstancedRendererService,
    private store: GameStateService,
    private multiplayer: MultiplayerService
  ) {}

  onBlockUpdate(callback: BlockUpdateCallback) {
    this.listeners.push(callback);
  }

  private notify(x: number, y: number, z: number, type: string, action: 'add' | 'remove') {
    this.listeners.forEach(l => l(x, y, z, type, action));
  }

  initialize() {
    this.blockData.clear();
    this.chunkBlocks.clear();
    this.store.blockCount.set(0);

    // Listen to remote updates
    this.multiplayer.blockUpdated$.subscribe(data => {
      if (data.action === 'add' && data.type) {
        this.addBlock(data.x, data.y, data.z, data.type, false);
      } else if (data.action === 'remove') {
        this.removeBlock(data.x, data.y, data.z, false);
      }
    });

    // Apply initial world changes via ReplaySubject
    this.multiplayer.worldInitialized$.subscribe(changes => {
      Object.values(changes || {}).forEach(data => {
        if (!data) return;
        if (data.action === 'add' && data.type) {
          this.addBlock(data.x, data.y, data.z, data.type, false);
        } else if (data.action === 'remove') {
          this.removeBlock(data.x, data.y, data.z, false);
        }
      });
    });
  }

  addBlock(x: number, y: number, z: number, type: string, broadcast: boolean = true, silent: boolean = false): boolean {
    const key = this.getKey(x, y, z);
    if (this.blockData.has(key)) {
      return false;
    }
    
    // Try to place instance
    const instanceId = this.instancedRenderer.placeInstance(type, x, y, z);
    if (instanceId === null || instanceId === undefined) {
      return false;
    }

    // Store block data
    this.blockData.set(key, { type, instanceId });
    
    // Index by chunk for fast removal
    const chunkKey = this.getChunkKey(x, z);
    if (!this.chunkBlocks.has(chunkKey)) {
        this.chunkBlocks.set(chunkKey, new Set());
    }
    this.chunkBlocks.get(chunkKey)!.add(key);

    if (!silent) {
        this.store.blockCount.set(this.blockData.size);
        this.notify(x, y, z, type, 'add');
    }
    
    if (broadcast) {
      this.multiplayer.sendBlockUpdate(x, y, z, type, 'add');
    }
    
    return true;
  }

  removeBlock(x: number, y: number, z: number, broadcast: boolean = true): BlockInstance | null {
    const key = this.getKey(x, y, z);
    const block = this.blockData.get(key);
    if (!block) {
      return null;
    }

    // Remove from renderer
    this.instancedRenderer.removeInstance(block.type, block.instanceId);
    
    // Remove from indices
    this.blockData.delete(key);
    const chunkKey = this.getChunkKey(x, z);
    const chunkSet = this.chunkBlocks.get(chunkKey);
    if (chunkSet) {
        chunkSet.delete(key);
        if (chunkSet.size === 0) {
            this.chunkBlocks.delete(chunkKey);
        }
    }

    this.store.blockCount.set(this.blockData.size);
    this.notify(x, y, z, block.type, 'remove');
    
    if (broadcast) {
      this.multiplayer.sendBlockUpdate(x, y, z, null, 'remove');
    }
    
    return block;
  }

  removeBlocksInChunk(chunkX: number, chunkZ: number) {
    const chunkKey = `${chunkX},${chunkZ}`;
    const blockKeys = this.chunkBlocks.get(chunkKey);
    
    if (!blockKeys || blockKeys.size === 0) return;

    let removedCount = 0;
    
    // O(M) removal where M is blocks in chunk
    for (const key of blockKeys) {
        const block = this.blockData.get(key);
        if (block) {
             this.instancedRenderer.removeInstance(block.type, block.instanceId);
             this.blockData.delete(key);
             removedCount++;
        }
    }

    // Clear the set and map entry
    this.chunkBlocks.delete(chunkKey);

    if (removedCount > 0) {
        this.store.blockCount.set(this.blockData.size);
        // console.log(`Fast removed ${removedCount} blocks from chunk ${chunkX},${chunkZ}`);
    }
  }

  replaceBlock(x: number, y: number, z: number, newType: string, broadcast: boolean = true) {
    const existing = this.blockData.get(this.getKey(x, y, z));
    if (!existing || existing.type === newType) {
      return;
    }
    this.removeBlock(x, y, z, broadcast);
    this.addBlock(x, y, z, newType, broadcast);
  }

  hasBlock(x: number, y: number, z: number): boolean {
    return this.blockData.has(this.getKey(x, y, z));
  }

  getBlock(x: number, y: number, z: number): BlockInstance | undefined {
    return this.blockData.get(this.getKey(x, y, z));
  }

  getBlockType(x: number, y: number, z: number): string | null {
    const block = this.getBlock(x, y, z);
    return block?.type ?? null;
  }

  getEntries(): [string, BlockInstance][] {
    return Array.from(this.blockData.entries());
  }

  size(): number {
    return this.blockData.size;
  }

  private getKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  private getChunkKey(x: number, z: number): string {
      const cx = Math.floor(x / this.CHUNK_SIZE);
      const cz = Math.floor(z / this.CHUNK_SIZE);
      return `${cx},${cz}`;
  }
}
