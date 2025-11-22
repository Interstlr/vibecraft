import { Injectable } from '@angular/core';
import { InstancedRendererService } from '../rendering/instanced-renderer.service';
import { GameStateService } from '../../services/game-state.service';
import { MultiplayerService } from '../networking/multiplayer.service';
import { BLOCKS } from '../config/blocks.config';

export interface BlockInstance {
  type: string;
  instanceId: number; // -1 means hidden (culled)
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

    // OPTIMIZATION: Occlusion Culling
    // Only render if block is exposed to air or transparent block
    const visible = this.isBlockExposed(x, y, z);
    let instanceId = -1;

    if (visible) {
      const id = this.instancedRenderer.placeInstance(type, x, y, z);
      if (id !== null && id !== undefined) {
        instanceId = id;
      }
    }

    // Store block data
    this.blockData.set(key, { type, instanceId });
    
    // Index by chunk for fast removal
    const chunkKey = this.getChunkKey(x, z);
    if (!this.chunkBlocks.has(chunkKey)) {
        this.chunkBlocks.set(chunkKey, new Set());
    }
    this.chunkBlocks.get(chunkKey)!.add(key);

    // Update neighbors visibility (we might have covered them)
    this.updateNeighbors(x, y, z);

    if (!silent) {
        this.store.blockCount.set(this.blockData.size);
        this.notify(x, y, z, type, 'add');
    }
    
    if (broadcast) {
      this.multiplayer.sendBlockUpdate(x, y, z, type, 'add');
    }
    
    return true;
  }

  addBlocksBatched(blocks: {x: number, y: number, z: number, type: string}[]) {
    const addedBlocks: {x: number, y: number, z: number, type: string}[] = [];
    const batchKeys = new Set<string>();

    // 1. Logic Phase: Add to data structures
    for (const b of blocks) {
        const key = this.getKey(b.x, b.y, b.z);
        if (this.blockData.has(key)) continue;
        
        this.blockData.set(key, { type: b.type, instanceId: -1 });
        
        const chunkKey = this.getChunkKey(b.x, b.z);
        if (!this.chunkBlocks.has(chunkKey)) {
            this.chunkBlocks.set(chunkKey, new Set());
        }
        this.chunkBlocks.get(chunkKey)!.add(key);
        
        addedBlocks.push(b);
        batchKeys.add(key);
    }

    // 2. Render Phase: Calculate visibility for new blocks
    for (const b of addedBlocks) {
        // ОПТИМИЗАЦИЯ: Быстрая проверка на "внутренний" блок в рамках батча
        // Если блок окружен со всех сторон блоками из текущей генерации, он точно невидим
        // и нам не нужно дергать тяжелый isBlockExposed
        if (this.isSurroundedByBatch(b, batchKeys)) {
            continue; 
        }

        if (this.isBlockExposed(b.x, b.y, b.z)) {
             const id = this.instancedRenderer.placeInstance(b.type, b.x, b.y, b.z);
             if (id !== null && id !== undefined) {
                 const block = this.blockData.get(this.getKey(b.x, b.y, b.z));
                 if (block) block.instanceId = id;
             }
        }
    }

    // 3. Update neighbors (only those NOT in the batch)
    const dirs = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
    const checkedNeighbors = new Set<string>();

    for (const b of addedBlocks) {
        // Если блок внутри батча, его соседей снаружи обновлять вряд ли нужно так часто,
        // но для корректности оставим, однако добавим проверку batchKeys
        
        for (const [dx, dy, dz] of dirs) {
            const nx = b.x + dx;
            const ny = b.y + dy;
            const nz = b.z + dz;
            const nKey = this.getKey(nx, ny, nz);
            
            // Если сосед тоже часть этого нового чанка, не нужно обновлять его видимость сейчас,
            // мы это уже сделали в цикле выше (Render Phase)
            if (batchKeys.has(nKey)) continue;

            if (!checkedNeighbors.has(nKey)) {
                this.updateBlockVisibility(nx, ny, nz);
                checkedNeighbors.add(nKey);
            }
        }
    }

    this.store.blockCount.set(this.blockData.size);
  }

  addHiddenBlocks(blocks: {x: number, y: number, z: number, type: string}[]) {
    for (const b of blocks) {
        const key = this.getKey(b.x, b.y, b.z);
        if (this.blockData.has(key)) continue;
        
        // Add to store but with instanceId = -1 (hidden)
        this.blockData.set(key, { type: b.type, instanceId: -1 });
        
        const chunkKey = this.getChunkKey(b.x, b.z);
        if (!this.chunkBlocks.has(chunkKey)) {
            this.chunkBlocks.set(chunkKey, new Set());
        }
        this.chunkBlocks.get(chunkKey)!.add(key);
    }
    this.store.blockCount.set(this.blockData.size);
  }

  // Добавьте этот helper-метод в класс
  private isSurroundedByBatch(b: {x: number, y: number, z: number}, batchKeys: Set<string>): boolean {
      // Проверяем 6 соседей. Если ВСЕ они есть в batchKeys, значит блок внутри массива
      // и проверять его через Raycast/GlobalMap не нужно.
      return batchKeys.has(this.getKey(b.x + 1, b.y, b.z)) &&
             batchKeys.has(this.getKey(b.x - 1, b.y, b.z)) &&
             batchKeys.has(this.getKey(b.x, b.y + 1, b.z)) &&
             batchKeys.has(this.getKey(b.x, b.y - 1, b.z)) &&
             batchKeys.has(this.getKey(b.x, b.y, b.z + 1)) &&
             batchKeys.has(this.getKey(b.x, b.y, b.z - 1));
  }

  removeBlock(x: number, y: number, z: number, broadcast: boolean = true): BlockInstance | null {
    const key = this.getKey(x, y, z);
    const block = this.blockData.get(key);
    if (!block) {
      return null;
    }

    // Remove from renderer ONLY if it was visible
    if (block.instanceId !== -1) {
      this.instancedRenderer.removeInstance(block.type, block.instanceId);
    }
    
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

    // Update neighbors visibility (we might have exposed them)
    this.updateNeighbors(x, y, z);

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
             // Only remove from renderer if visible
             if (block.instanceId !== -1) {
                this.instancedRenderer.removeInstance(block.type, block.instanceId);
             }
             this.blockData.delete(key);
             removedCount++;
        }
    }

    // Clear the set and map entry
    this.chunkBlocks.delete(chunkKey);

    if (removedCount > 0) {
        this.store.blockCount.set(this.blockData.size);
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

  // --- Visibility Logic ---

  private isTransparent(type: string): boolean {
    return BLOCKS[type]?.transparent || false;
  }

  private isBlockExposed(x: number, y: number, z: number): boolean {
    const dirs = [
      [1,0,0], [-1,0,0],
      [0,1,0], [0,-1,0],
      [0,0,1], [0,0,-1]
    ];

    for (const [dx, dy, dz] of dirs) {
      const neighbor = this.getBlock(x + dx, y + dy, z + dz);
      // Exposed if neighbor is missing OR transparent (like glass/leaves)
      if (!neighbor || this.isTransparent(neighbor.type)) {
        return true;
      }
    }
    return false;
  }

  private updateNeighbors(x: number, y: number, z: number) {
    const dirs = [
      [1,0,0], [-1,0,0],
      [0,1,0], [0,-1,0],
      [0,0,1], [0,0,-1]
    ];

    for (const [dx, dy, dz] of dirs) {
      this.updateBlockVisibility(x + dx, y + dy, z + dz);
    }
  }

  private updateBlockVisibility(x: number, y: number, z: number) {
    const block = this.getBlock(x, y, z);
    if (!block) return;

    const shouldBeVisible = this.isBlockExposed(x, y, z);
    const isVisible = block.instanceId !== -1;

    if (shouldBeVisible && !isVisible) {
      // Hidden -> Visible
      const id = this.instancedRenderer.placeInstance(block.type, x, y, z);
      if (id !== null && id !== undefined) {
        block.instanceId = id;
      }
    } else if (!shouldBeVisible && isVisible) {
      // Visible -> Hidden
      this.instancedRenderer.removeInstance(block.type, block.instanceId);
      block.instanceId = -1;
    }
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
