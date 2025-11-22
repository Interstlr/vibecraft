import { Injectable, inject } from '@angular/core';
import { Vector3 } from 'three';
import { GameStateService } from '../../services/game-state.service';
import { BlockPlacerService } from './block-placer.service';
import { PlayerControllerService } from '../player/player-controller.service';
import { ItemDropSystemService } from '../systems/item-drop-system.service';
import { InventoryService } from '../inventory/inventory.service';

interface SavedChunk {
  x: number;
  z: number;
  blocks: { x: number, y: number, z: number, type: string }[];
}

interface SavedInventorySlot {
  item: string | null;
  count: number;
}

interface WorldMetadata {
  seed: number;
  playerPos: { x: number, y: number, z: number };
  inventory: {
    slots: SavedInventorySlot[];
    grass: number;
    dirt: number;
    stone: number;
    wood: number;
    leaves: number;
    workbench: number;
    axe: number;
  };
  droppedItems: {
    id: string;
    type: string;
    count: number;
    position: { x: number, y: number, z: number };
    velocity: { x: number, y: number, z: number };
  }[];
  stats: {
    blockCount: number;
  };
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class WorldStorageService {
  private readonly DB_NAME = 'VibeCraftDB';
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;
  
  private gameState = inject(GameStateService);
  private blockPlacer = inject(BlockPlacerService);
  private playerController = inject(PlayerControllerService);
  private itemDropSystem = inject(ItemDropSystemService);
  private inventoryService = inject(InventoryService);

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<void> {
    if (this.db) return Promise.resolve(); // Return if already initialized
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = (e) => {
        console.error('Failed to open database', e);
        reject(e);
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        console.log('DB Initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('chunks')) {
          db.createObjectStore('chunks', { keyPath: 'key' });
        }
      };
    });
  }

  async saveWorld(seed: number): Promise<void> {
    if (!this.db) await this.initDB();

    // 1. Save Metadata
    const metadata: WorldMetadata = {
      seed,
      playerPos: this.gameState.playerPosition(),
      inventory: {
        slots: this.inventoryService.getAllSlots(),
        grass: this.gameState.grassCount(),
        dirt: this.gameState.dirtCount(),
        stone: this.gameState.stoneCount(),
        wood: this.gameState.woodCount(),
        leaves: this.gameState.leavesCount(),
        workbench: this.gameState.hasWorkbench(),
        axe: this.gameState.hasAxe()
      },
      droppedItems: this.itemDropSystem.getDrops().map(drop => ({
        id: drop.id,
        type: drop.type,
        count: drop.count,
        position: { x: drop.position.x, y: drop.position.y, z: drop.position.z },
        velocity: { x: drop.velocity.x, y: drop.velocity.y, z: drop.velocity.z }
      })),
      stats: {
        blockCount: this.gameState.blockCount()
      },
      timestamp: Date.now()
    };

    await this.put('metadata', { id: 'current', data: metadata });

    // 2. Save Chunks
    // We need to iterate over blockPlacer chunks
    // BlockPlacerService doesn't expose chunkBlocks directly, so we need to access it or iterate all blocks
    // Ideally BlockPlacerService should have a method to get blocks by chunk
    // For now, we'll rely on a new method we'll add to BlockPlacerService or get all entries
    
    // Let's assume we added getChunksData() to BlockPlacerService
    // But since we can't easily edit it without re-reading, let's do a quick hack:
    // We will read all blocks and group them ourselves if needed, OR (better) add the method to BlockPlacer
    
    // Since I'm editing BlockPlacerService anyway to add the method, let's assume it exists.
    // Actually, I'll implement `getChunksToSave` in BlockPlacerService.
    
    const chunks = this.blockPlacer.getChunksToSave();
    
    const tx = this.db!.transaction(['chunks'], 'readwrite');
    const store = tx.objectStore('chunks');
    
    // Clear old chunks first? Or just overwrite? Overwrite is safer/faster.
    // But if we removed a chunk, it stays in DB?
    // Ideally we clear the store first.
    await new Promise<void>((resolve, reject) => {
       const clearReq = store.clear();
       clearReq.onsuccess = () => resolve();
       clearReq.onerror = () => reject(clearReq.error);
    });

    // Re-open transaction as clear might end it? No, it shouldn't.
    // Actually, let's do it in one transaction if possible, or new one.
    // Safer to use new transaction after await.
    
    const writeTx = this.db!.transaction(['chunks'], 'readwrite');
    const writeStore = writeTx.objectStore('chunks');

    console.log(`Saving ${chunks.length} chunks...`);

    for (const chunk of chunks) {
      writeStore.put(chunk);
    }

    // Wait for transaction to complete
    await new Promise<void>((resolve, reject) => {
      writeTx.oncomplete = () => {
        console.log('Chunks saved successfully');
        resolve();
      };
      writeTx.onerror = () => {
        console.error('Error saving chunks', writeTx.error);
        reject(writeTx.error);
      };
      writeTx.onabort = () => {
         console.error('Save transaction aborted', writeTx.error);
         reject(writeTx.error);
      }
    });
  }

  async hasSavedWorld(): Promise<boolean> {
    if (!this.db) await this.initDB();
    const meta = await this.get('metadata', 'current');
    return !!meta;
  }

  async loadMetadata(): Promise<WorldMetadata | null> {
    if (!this.db) await this.initDB();
    const result = await this.get('metadata', 'current');
    return result ? result.data : null;
  }

  async loadChunk(chunkX: number, chunkZ: number): Promise<SavedChunk | null> {
    if (!this.db) await this.initDB();
    const key = `${chunkX},${chunkZ}`;
    return await this.get('chunks', key);
  }

  async clearSave(): Promise<void> {
     if (!this.db) await this.initDB();
     const tx = this.db!.transaction(['metadata', 'chunks'], 'readwrite');
     tx.objectStore('metadata').clear();
     tx.objectStore('chunks').clear();
  }

  private get(storeName: string, key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private put(storeName: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

