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
    const start = camera.position.clone();
    start.x += 0.5;
    start.y += 0.5;
    start.z += 0.5;

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    let x = Math.floor(start.x);
    let y = Math.floor(start.y);
    let z = Math.floor(start.z);

    const stepX = Math.sign(direction.x);
    const stepY = Math.sign(direction.y);
    const stepZ = Math.sign(direction.z);

    const tDeltaX = stepX !== 0 ? Math.abs(1 / direction.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / direction.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction.z) : Infinity;

    let tMaxX =
      stepX > 0 ? (Math.floor(start.x) + 1 - start.x) * tDeltaX : (start.x - Math.floor(start.x)) * tDeltaX;
    let tMaxY =
      stepY > 0 ? (Math.floor(start.y) + 1 - start.y) * tDeltaY : (start.y - Math.floor(start.y)) * tDeltaY;
    let tMaxZ =
      stepZ > 0 ? (Math.floor(start.z) + 1 - start.z) * tDeltaZ : (start.z - Math.floor(start.z)) * tDeltaZ;

    const hitNormal = new THREE.Vector3();
    const maxSteps = PLAYER_CONFIG.reachDistance * 3;

    for (let i = 0; i < maxSteps; i++) {
      if (this.blockPlacer.hasBlock(x, y, z)) {
        this.hitBlockPosition = new THREE.Vector3(x, y, z);
        this.hitBlockNormal = hitNormal.clone();
        this.highlight.show(x, y, z);
        return;
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          tMaxX += tDeltaX;
          hitNormal.set(-stepX, 0, 0);
        } else {
          z += stepZ;
          tMaxZ += tDeltaZ;
          hitNormal.set(0, 0, -stepZ);
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          tMaxY += tDeltaY;
          hitNormal.set(0, -stepY, 0);
        } else {
          z += stepZ;
          tMaxZ += tDeltaZ;
          hitNormal.set(0, 0, -stepZ);
        }
      }

      const distSq =
        (x + 0.5 - start.x) ** 2 + (y + 0.5 - start.y) ** 2 + (z + 0.5 - start.z) ** 2;
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

