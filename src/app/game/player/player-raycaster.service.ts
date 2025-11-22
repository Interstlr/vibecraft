import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SceneManagerService } from '../core/scene-manager.service';
import { BlockPlacerService } from '../world/block-placer.service';
import { HighlightRendererService } from '../rendering/highlight-renderer.service';
import { PLAYER_CONFIG } from '../../config/player.config';

@Injectable({
  providedIn: 'root',
})
export class PlayerRaycasterService {
  private hitBlockPosition: THREE.Vector3 | null = null;
  private hitBlockNormal: THREE.Vector3 | null = null;

  // Reusable objects to reduce GC
  private _start = new THREE.Vector3();
  private _direction = new THREE.Vector3();
  private _hitNormal = new THREE.Vector3();
  private _tempPos = new THREE.Vector3();

  constructor(
    private sceneManager: SceneManagerService,
    private blockPlacer: BlockPlacerService,
    private highlight: HighlightRendererService,
  ) {}

  update() {
    this.hitBlockPosition = null;
    this.hitBlockNormal = null;
    this.highlight.hide();

    const camera = this.sceneManager.getCamera();
    this._start.copy(camera.position);
    this._start.x += 0.5;
    this._start.y += 0.5;
    this._start.z += 0.5;

    camera.getWorldDirection(this._direction);

    let x = Math.floor(this._start.x);
    let y = Math.floor(this._start.y);
    let z = Math.floor(this._start.z);

    const stepX = Math.sign(this._direction.x);
    const stepY = Math.sign(this._direction.y);
    const stepZ = Math.sign(this._direction.z);

    const tDeltaX = stepX !== 0 ? Math.abs(1 / this._direction.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / this._direction.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / this._direction.z) : Infinity;

    let tMaxX =
      stepX > 0 ? (Math.floor(this._start.x) + 1 - this._start.x) * tDeltaX : (this._start.x - Math.floor(this._start.x)) * tDeltaX;
    let tMaxY =
      stepY > 0 ? (Math.floor(this._start.y) + 1 - this._start.y) * tDeltaY : (this._start.y - Math.floor(this._start.y)) * tDeltaY;
    let tMaxZ =
      stepZ > 0 ? (Math.floor(this._start.z) + 1 - this._start.z) * tDeltaZ : (this._start.z - Math.floor(this._start.z)) * tDeltaZ;

    const maxSteps = PLAYER_CONFIG.reachDistance * 3;

    for (let i = 0; i < maxSteps; i++) {
      if (this.blockPlacer.hasBlock(x, y, z)) {
        // Found block
        if (!this.hitBlockPosition) this.hitBlockPosition = new THREE.Vector3();
        this.hitBlockPosition.set(x, y, z);
        
        if (!this.hitBlockNormal) this.hitBlockNormal = new THREE.Vector3();
        this.hitBlockNormal.copy(this._hitNormal);
        
        this.highlight.show(x, y, z);
        return;
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          tMaxX += tDeltaX;
          this._hitNormal.set(-stepX, 0, 0);
        } else {
          z += stepZ;
          tMaxZ += tDeltaZ;
          this._hitNormal.set(0, 0, -stepZ);
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          tMaxY += tDeltaY;
          this._hitNormal.set(0, -stepY, 0);
        } else {
          z += stepZ;
          tMaxZ += tDeltaZ;
          this._hitNormal.set(0, 0, -stepZ);
        }
      }

      const distSq =
        (x + 0.5 - this._start.x) ** 2 + (y + 0.5 - this._start.y) ** 2 + (z + 0.5 - this._start.z) ** 2;
      if (distSq > PLAYER_CONFIG.reachDistance ** 2) {
        break;
      }
    }
  }

  getHitBlockPosition(): THREE.Vector3 | null {
    return this.hitBlockPosition;
  }

  getHitBlockNormal(): THREE.Vector3 | null {
    return this.hitBlockNormal;
  }

  reset() {
    this.hitBlockPosition = null;
    this.hitBlockNormal = null;
    this.highlight.hide();
  }
}

