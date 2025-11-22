import { Injectable, inject } from '@angular/core';
import { BlockPlacerService } from '../world/block-placer.service';
import { InventoryService } from '../inventory/inventory.service';
import { GameStateService } from '../../services/game-state.service';
import { SceneManagerService } from '../core/scene-manager.service';
import * as THREE from 'three';

export interface WorldSaveData {
  version: number;
  timestamp: number;
  seed: number;
  player: {
    position: { x: number, y: number, z: number };
    rotation: { yaw: number, pitch: number };
  };
  inventory: any[];
  blocks: { x: number, y: number, z: number, type: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class SaveManagerService {
  private readonly SAVE_KEY = 'vibecraft_save_v1';
  
  private blockPlacer = inject(BlockPlacerService);
  private inventoryService = inject(InventoryService);
  private gameState = inject(GameStateService);
  private sceneManager = inject(SceneManagerService);

  hasSave(): boolean {
    return !!localStorage.getItem(this.SAVE_KEY);
  }

  saveWorld(seed: number) {
    const camera = this.sceneManager.getCamera();
    const position = camera.position;
    // Get rotation (yaw/pitch) from camera or controls? 
    // Usually camera quaternion is enough, but let's save simple yaw/pitch if needed or just lookAt vector.
    // For simplicity, we'll just save position for now and let rotation reset or try to capture it.
    // PointerLockControls usually manages this. We can get it from camera rotation order YXZ.
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');

    // Serialize blocks
    // WARNING: This might be large.
    const blocks: { x: number, y: number, z: number, type: string }[] = [];
    for (const [key, block] of this.blockPlacer.getEntries()) {
        const [x, y, z] = key.split(',').map(Number);
        blocks.push({ x, y, z, type: block.type });
    }

    const data: WorldSaveData = {
      version: 1,
      timestamp: Date.now(),
      seed: seed,
      player: {
        position: { x: position.x, y: position.y, z: position.z },
        rotation: { yaw: euler.y, pitch: euler.x }
      },
      inventory: this.inventoryService.getSlots(),
      blocks: blocks
    };

    try {
      const json = JSON.stringify(data);
      localStorage.setItem(this.SAVE_KEY, json);
      console.log(`Game saved! ${blocks.length} blocks.`);
    } catch (e) {
      console.error('Failed to save game (probably quota exceeded):', e);
      alert('Failed to save game! Storage full?');
    }
  }

  loadWorld(): WorldSaveData | null {
    const json = localStorage.getItem(this.SAVE_KEY);
    if (!json) return null;
    
    try {
      return JSON.parse(json) as WorldSaveData;
    } catch (e) {
      console.error('Failed to load save:', e);
      return null;
    }
  }

  clearSave() {
    localStorage.removeItem(this.SAVE_KEY);
  }
}

