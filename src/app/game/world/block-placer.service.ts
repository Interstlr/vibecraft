import { Injectable } from '@angular/core';
import { InstancedRendererService } from '../rendering/instanced-renderer.service';
import { GameStateService } from '../../services/game-state.service';

export interface BlockInstance {
  type: string;
  instanceId: number;
}

@Injectable({
  providedIn: 'root',
})
export class BlockPlacerService {
  private blockData = new Map<string, BlockInstance>();

  constructor(
    private instancedRenderer: InstancedRendererService,
    private store: GameStateService,
  ) {}

  initialize() {
    this.blockData.clear();
    this.store.blockCount.set(0);
  }

  addBlock(x: number, y: number, z: number, type: string): boolean {
    const key = this.getKey(x, y, z);
    if (this.blockData.has(key)) {
      return false;
    }
    const instanceId = this.instancedRenderer.placeInstance(type, x, y, z);
    if (instanceId === null || instanceId === undefined) {
      return false;
    }
    this.blockData.set(key, { type, instanceId });
    this.store.blockCount.set(this.blockData.size);
    return true;
  }

  removeBlock(x: number, y: number, z: number): BlockInstance | null {
    const key = this.getKey(x, y, z);
    const block = this.blockData.get(key);
    if (!block) {
      return null;
    }
    this.instancedRenderer.removeInstance(block.type, block.instanceId);
    this.blockData.delete(key);
    this.store.blockCount.set(this.blockData.size);
    return block;
  }

  replaceBlock(x: number, y: number, z: number, newType: string) {
    const existing = this.blockData.get(this.getKey(x, y, z));
    if (!existing || existing.type === newType) {
      return;
    }
    this.removeBlock(x, y, z);
    this.addBlock(x, y, z, newType);
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

