import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SceneManagerService } from '../core/scene-manager.service';
import { InputManagerService } from '../core/input-manager.service';
import { BlockPlacerService } from '../world/block-placer.service';
import { PLAYER_CONFIG } from '../../config/player.config';
import { MultiplayerService } from '../networking/multiplayer.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable({
  providedIn: 'root',
})
export class PlayerControllerService {
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private spawnPosition = new THREE.Vector3(0, 10, 0); // Default spawn
  private canJump = false;
  private readonly MIN_WORLD_Y = -20;
  private lastSentTime = 0;

  constructor(
    private sceneManager: SceneManagerService,
    private input: InputManagerService,
    private blockPlacer: BlockPlacerService,
    private multiplayer: MultiplayerService,
    private inventory: InventoryService
  ) {}

  get position(): THREE.Vector3 {
    return this.sceneManager.getCamera().position;
  }

  setSpawn(position: THREE.Vector3) {
    this.spawnPosition.copy(position);
  }

  update(delta: number) {
    const camera = this.sceneManager.getCamera();
    const movement = this.input.getMovementState();

    this.velocity.x -= this.velocity.x * PLAYER_CONFIG.drag * delta;
    this.velocity.z -= this.velocity.z * PLAYER_CONFIG.drag * delta;
    this.velocity.y -= PLAYER_CONFIG.gravity * delta;

    this.direction.z = Number(movement.forward) - Number(movement.backward);
    this.direction.x = Number(movement.right) - Number(movement.left);
    this.direction.normalize();

    if (movement.forward || movement.backward) {
      this.velocity.z -= this.direction.z * PLAYER_CONFIG.moveSpeed * delta;
    }
    if (movement.left || movement.right) {
      this.velocity.x -= this.direction.x * PLAYER_CONFIG.moveSpeed * delta;
    }

    if (this.canJump && this.input.isJumpHeld()) {
      this.velocity.y += PLAYER_CONFIG.jumpForce;
      this.canJump = false;
    }

    const right = new THREE.Vector3();
    const forward = new THREE.Vector3();
    right.setFromMatrixColumn(camera.matrix, 0);
    forward.setFromMatrixColumn(camera.matrix, 0);
    forward.crossVectors(camera.up, forward).normalize();

    const dx = (-this.velocity.x * delta) * right.x + (-this.velocity.z * delta) * forward.x;
    const dz = (-this.velocity.x * delta) * right.z + (-this.velocity.z * delta) * forward.z;

    camera.position.x += dx;
    if (this.hasCollision(camera.position)) {
      camera.position.x -= dx;
      this.velocity.x = 0;
    }

    camera.position.z += dz;
    if (this.hasCollision(camera.position)) {
      camera.position.z -= dz;
      this.velocity.z = 0;
    }

    camera.position.y += this.velocity.y * delta;
    const verticalHit = this.getVerticalCollision(camera.position);
    if (verticalHit !== null) {
      if (this.velocity.y < 0) {
        this.velocity.y = 0;
        this.canJump = true;
        camera.position.y = verticalHit + 0.5 + PLAYER_CONFIG.eyeHeight;
      } else {
        this.velocity.y = 0;
        camera.position.y -= this.velocity.y * delta;
      }
    }

    if (camera.position.y < this.MIN_WORLD_Y) {
      this.resetPosition();
    }

    // Network sync
    const now = performance.now();
    if (now - this.lastSentTime > 50) { // 20 times per second
      this.multiplayer.sendMove(
        camera.position,
        camera.rotation,
        this.inventory.selectedItem().item
      );
      this.lastSentTime = now;
    }
  }
  
  // Force send update immediately (e.g. on spawn or teleport)
  forceSendUpdate() {
    const camera = this.sceneManager.getCamera();
    this.multiplayer.sendMove(
      camera.position,
      camera.rotation,
      this.inventory.selectedItem().item
    );
  }

  private hasCollision(position: THREE.Vector3): boolean {
    const r = PLAYER_CONFIG.collisionRadius;
    const minX = Math.floor(position.x - r - 0.5);
    const maxX = Math.ceil(position.x + r + 0.5);
    const minZ = Math.floor(position.z - r - 0.5);
    const maxZ = Math.ceil(position.z + r + 0.5);
    const minY = Math.floor(position.y - PLAYER_CONFIG.eyeHeight);
    const maxY = Math.floor(position.y + 0.2);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let y = minY; y <= maxY; y++) {
          if (this.blockPlacer.hasBlock(x, y, z)) {
            if (
              Math.abs(position.x - x) < 0.5 + r &&
              Math.abs(position.z - z) < 0.5 + r &&
              position.y - PLAYER_CONFIG.eyeHeight < y + 0.5 &&
              position.y + 0.2 > y - 0.5
            ) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  private getVerticalCollision(position: THREE.Vector3): number | null {
    const r = PLAYER_CONFIG.collisionRadius;
    const minX = Math.floor(position.x - r - 0.5);
    const maxX = Math.ceil(position.x + r + 0.5);
    const minZ = Math.floor(position.z - r - 0.5);
    const maxZ = Math.ceil(position.z + r + 0.5);
    const minY = Math.floor(position.y - PLAYER_CONFIG.eyeHeight);
    const maxY = Math.floor(position.y + 0.2);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let y = minY; y <= maxY; y++) {
          if (this.blockPlacer.hasBlock(x, y, z)) {
            if (
              Math.abs(position.x - x) < 0.5 + r &&
              Math.abs(position.z - z) < 0.5 + r &&
              position.y - PLAYER_CONFIG.eyeHeight < y + 0.5 &&
              position.y + 0.2 > y - 0.5
            ) {
              return y;
            }
          }
        }
      }
    }
    return null;
  }

  private resetPosition() {
    const camera = this.sceneManager.getCamera();
    camera.position.copy(this.spawnPosition);
    this.velocity.set(0, 0, 0);
    this.canJump = true;
  }
}
