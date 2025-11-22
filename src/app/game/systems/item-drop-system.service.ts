import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { ItemDrop } from '../entities/item-drop.entity';
import { BlockPlacerService } from '../world/block-placer.service';

@Injectable({
  providedIn: 'root',
})
export class ItemDropSystemService {
  private drops: ItemDrop[] = [];
  private readonly GRAVITY = -28.0;
  private readonly TERMINAL_VELOCITY = -40.0;
  private readonly BOUNCE_FACTOR = -0.55;
  private readonly PICKUP_RANGE = 1.8;
  private readonly DROP_LIFETIME = 300; // 5 minutes

  constructor(private blockPlacer: BlockPlacerService) {}

  spawnDrop(type: string, position: THREE.Vector3, count: number = 1, velocity?: THREE.Vector3) {
    const id = Math.random().toString(36).substr(2, 9);
    const drop = new ItemDrop(id, type, count, position, velocity);
    this.drops.push(drop);
  }

  getDrops(): ItemDrop[] {
    return this.drops;
  }

  getDropById(id: string): ItemDrop | undefined {
    return this.drops.find((d) => d.id === id);
  }

  removeDrop(id: string) {
    const index = this.drops.findIndex((d) => d.id === id);
    if (index !== -1) {
      this.drops.splice(index, 1);
    }
  }

  update(delta: number, playerPosition: THREE.Vector3): string[] {
    const pickedUpIds: string[] = [];

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.age += delta;

      // if (drop.age > this.DROP_LIFETIME) {
      //   this.drops.splice(i, 1);
      //   continue;
      // }

      this.updatePhysics(drop, delta);

      // Pickup logic
      if (drop.pickupDelay > 0) {
        drop.pickupDelay -= delta;
      } else {
        const dist = drop.position.distanceTo(playerPosition);
        if (dist < this.PICKUP_RANGE) {
          pickedUpIds.push(drop.id);
        }
      }
    }

    return pickedUpIds;
  }

  private updatePhysics(drop: ItemDrop, delta: number) {
    // Apply gravity
    drop.velocity.y += this.GRAVITY * delta;
    if (drop.velocity.y < this.TERMINAL_VELOCITY) {
      drop.velocity.y = this.TERMINAL_VELOCITY;
    }

    // Apply velocity
    const move = drop.velocity.clone().multiplyScalar(delta);
    
    // Collision detection (Simple, only vertical for now + basic ground check)
    // A more robust system would check X/Z collisions too, but for drops,
    // just stopping on ground is often enough.
    // Let's try to do basic axis-aligned collision.

    const nextPos = drop.position.clone().add(move);
    
    // Check floor
    // Drop is 0.25x0.25x0.25 (physically). Center is position. Bottom is y - radius.
    const radius = 0.125;
    
    // Check block at feet
    const blockX = Math.floor(nextPos.x);
    const blockY = Math.floor(nextPos.y - radius);
    const blockZ = Math.floor(nextPos.z);

    if (this.blockPlacer.hasBlock(blockX, blockY, blockZ)) {
        // Hit ground
        if (drop.velocity.y < 0) {
            // Snap to top of block
            nextPos.y = blockY + 1 + radius;
            drop.velocity.y *= this.BOUNCE_FACTOR;
            drop.velocity.x *= 0.8; // Friction
            drop.velocity.z *= 0.8;

            // Stop bouncing if slow
            if (Math.abs(drop.velocity.y) < 1.0) {
                drop.velocity.y = 0;
                drop.onGround = true;
            }
        }
    } else {
        drop.onGround = false;
    }

    // Apply X/Z friction if on ground
    if (drop.onGround) {
        drop.velocity.x *= 0.9;
        drop.velocity.z *= 0.9;
    } else {
        drop.velocity.x *= 0.98; // Air resistance
        drop.velocity.z *= 0.98;
    }

    // Wall collisions (simple check)
    // X axis
    const wallX = Math.floor(nextPos.x + (drop.velocity.x > 0 ? radius : -radius));
    const currBlockY = Math.floor(drop.position.y);
    if (this.blockPlacer.hasBlock(wallX, currBlockY, Math.floor(drop.position.z))) {
        drop.velocity.x *= -0.5;
        nextPos.x = drop.position.x; // Cancel move
    }
    
    // Z axis
    const wallZ = Math.floor(nextPos.z + (drop.velocity.z > 0 ? radius : -radius));
    if (this.blockPlacer.hasBlock(Math.floor(drop.position.x), currBlockY, wallZ)) {
        drop.velocity.z *= -0.5;
        nextPos.z = drop.position.z; // Cancel move
    }

    drop.position.copy(nextPos);
  }
}
