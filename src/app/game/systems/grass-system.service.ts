import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { BlockPlacerService } from '../world/block-placer.service';

@Injectable({
  providedIn: 'root',
})
export class GrassSystemService {
  private grassTickTimer = 0;
  private readonly GRASS_TICK_INTERVAL = 0.75;
  private readonly GRASS_TICK_ATTEMPTS = 40;
  private readonly GRASS_LIGHT_SCAN_HEIGHT = 6;

  constructor(private blockPlacer: BlockPlacerService) {}

  update(delta: number) {
    this.grassTickTimer += delta;
    if (this.grassTickTimer < this.GRASS_TICK_INTERVAL) {
      return;
    }
    this.grassTickTimer = 0;
    this.performGrassTicks();
  }

  private performGrassTicks() {
    if (this.blockPlacer.size() === 0) {
      return;
    }
    const entries = this.blockPlacer.getEntries();
    const attempts = Math.min(this.GRASS_TICK_ATTEMPTS, entries.length);

    for (let i = 0; i < attempts; i++) {
      const [key, block] = entries[Math.floor(Math.random() * entries.length)];
      const [x, y, z] = key.split(',').map(Number);

      if (block.type === 'grass') {
        this.updateGrassBlock(x, y, z);
        this.trySpreadGrass(x, y, z);
      } else if (block.type === 'dirt') {
        this.tryReviveDirt(x, y, z);
      }
    }
  }

  private updateGrassBlock(x: number, y: number, z: number) {
    if (!this.isAir(x, y + 1, z)) {
      this.blockPlacer.replaceBlock(x, y, z, 'dirt');
    }
  }

  private trySpreadGrass(x: number, y: number, z: number) {
    if (!this.isAir(x, y + 1, z)) {
      return;
    }
    if (Math.random() > 0.5) {
      return;
    }

    const targetX = x + THREE.MathUtils.randInt(-1, 1);
    const targetY = y + THREE.MathUtils.randInt(-1, 1);
    const targetZ = z + THREE.MathUtils.randInt(-1, 1);

    if (targetX === x && targetY === y && targetZ === z) {
      return;
    }

    const candidate = this.blockPlacer.getBlockType(targetX, targetY, targetZ);
    if (candidate !== 'dirt') {
      return;
    }
    if (!this.isAir(targetX, targetY + 1, targetZ)) {
      return;
    }
    if (!this.hasSkyAccess(targetX, targetY, targetZ)) {
      return;
    }

    this.blockPlacer.replaceBlock(targetX, targetY, targetZ, 'grass');
  }

  private tryReviveDirt(x: number, y: number, z: number) {
    if (!this.isAir(x, y + 1, z)) {
      return;
    }
    if (!this.hasSkyAccess(x, y, z)) {
      return;
    }
    if (!this.hasAdjacentGrass(x, y, z)) {
      return;
    }
    if (Math.random() > 0.25) {
      return;
    }

    this.blockPlacer.replaceBlock(x, y, z, 'grass');
  }

  private hasAdjacentGrass(x: number, y: number, z: number): boolean {
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let oz = -1; oz <= 1; oz++) {
          if (ox === 0 && oy === 0 && oz === 0) {
            continue;
          }
          const neighbor = this.blockPlacer.getBlockType(x + ox, y + oy, z + oz);
          if (neighbor === 'grass') {
            return true;
          }
        }
      }
    }
    return false;
  }

  private hasSkyAccess(x: number, y: number, z: number): boolean {
    for (let dy = 1; dy <= this.GRASS_LIGHT_SCAN_HEIGHT; dy++) {
      if (this.blockPlacer.hasBlock(x, y + dy, z)) {
        return false;
      }
    }
    return true;
  }

  private isAir(x: number, y: number, z: number): boolean {
    return !this.blockPlacer.hasBlock(x, y, z);
  }
}

