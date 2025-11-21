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
  private listeners: BlockUpdateCallback[] = [];

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
    this.store.blockCount.set(0);

    // Listen to remote updates
    this.multiplayer.blockUpdated$.subscribe(data => {
      if (data.action === 'add' && data.type) {
        this.addBlock(data.x, data.y, data.z, data.type, false);
      } else if (data.action === 'remove') {
        this.removeBlock(data.x, data.y, data.z, false);
      }
    });

    // Apply initial world changes via ReplaySubject (handles race conditions)
    this.multiplayer.worldInitialized$.subscribe(changes => {
      console.log('Received initial world changes:', Object.keys(changes).length);
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

  addBlock(x: number, y: number, z: number, type: string, broadcast: boolean = true): boolean {
    const key = this.getKey(x, y, z);
    if (this.blockData.has(key)) {
      // If force replace or check mismatch? For now just return false
      return false;
    }
    const instanceId = this.instancedRenderer.placeInstance(type, x, y, z);
    if (instanceId === null || instanceId === undefined) {
      return false;
    }
    this.blockData.set(key, { type, instanceId });
    this.store.blockCount.set(this.blockData.size);
    this.notify(x, y, z, type, 'add');
    
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
    this.instancedRenderer.removeInstance(block.type, block.instanceId);
    this.blockData.delete(key);
    this.store.blockCount.set(this.blockData.size);
    this.notify(x, y, z, block.type, 'remove');
    
    if (broadcast) {
      this.multiplayer.sendBlockUpdate(x, y, z, null, 'remove');
    }
    
    return block;
  }

  removeBlocksInChunk(chunkX: number, chunkZ: number) {
    const toRemove: string[] = [];
    const CHUNK_SIZE = 16;

    // Iterate all blocks to find ones in this chunk
    // Note: Optimization would be to store blocks by chunk key
    for (const key of this.blockData.keys()) {
        const [xStr, , zStr] = key.split(',');
        const x = parseInt(xStr);
        const z = parseInt(zStr);
        
        // Check if block belongs to chunk
        if (Math.floor(x / CHUNK_SIZE) === chunkX && Math.floor(z / CHUNK_SIZE) === chunkZ) {
            toRemove.push(key);
        }
    }

    // Batch remove
    let removedCount = 0;
    for (const key of toRemove) {
        const block = this.blockData.get(key);
        if (block) {
             this.instancedRenderer.removeInstance(block.type, block.instanceId);
             this.blockData.delete(key);
             removedCount++;
        }
    }

    if (removedCount > 0) {
        this.store.blockCount.set(this.blockData.size);
        console.log(`Removed ${removedCount} blocks from chunk ${chunkX},${chunkZ}`);
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
}
