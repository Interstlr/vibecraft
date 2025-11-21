import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { BlockPlacerService } from '../../world/block-placer.service';
import { MobEntity } from '../entities/mob.entity';

@Injectable({
  providedIn: 'root',
})
export class MobPhysicsService {
  private readonly GRAVITY = -24.0; 
  private readonly TERMINAL_VELOCITY = -30.0;
  private readonly DRAG_XZ = 5.0; // Air/Ground friction simulation

  constructor(private blockPlacer: BlockPlacerService) {}

  update(mob: MobEntity, delta: number) {
    // Apply Gravity
    mob.velocity.y += this.GRAVITY * delta;
    if (mob.velocity.y < this.TERMINAL_VELOCITY) {
      mob.velocity.y = this.TERMINAL_VELOCITY;
    }

    // Apply Drag (XZ)
    const dragFactor = Math.max(0, 1 - this.DRAG_XZ * delta);
    mob.velocity.x *= dragFactor;
    mob.velocity.z *= dragFactor;

    // Calculate intended movement
    const moveX = mob.velocity.x * delta;
    const moveY = mob.velocity.y * delta;
    const moveZ = mob.velocity.z * delta;

    // 1. Move X
    if (moveX !== 0) {
      mob.position.x += moveX;
      if (this.checkCollision(mob)) {
        // Revert and stop
        mob.position.x -= moveX;
        mob.velocity.x = 0;
      }
    }

    // 2. Move Z
    if (moveZ !== 0) {
      mob.position.z += moveZ;
      if (this.checkCollision(mob)) {
        // Revert and stop
        mob.position.z -= moveZ;
        mob.velocity.z = 0;
      }
    }

    // 3. Move Y (Vertical)
    mob.onGround = false;
    if (moveY !== 0) {
      mob.position.y += moveY;
      
      if (this.checkCollision(mob)) {
        // Collision detected
        if (moveY < 0) {
          // Landed on ground
          // Snap to the nearest block top
          // We know we collided, so we are intersecting a block.
          // The block we hit is likely at Math.floor(mob.position.y) or slightly below.
          
          // Revert to pre-collision state roughly
          mob.position.y -= moveY;
          
          // Find the exact ground level
          const groundY = this.findGroundY(mob);
          if (groundY !== null) {
             mob.position.y = groundY;
             mob.onGround = true;
             mob.velocity.y = 0;
          } else {
             // Should not happen if checkCollision was true, but fallback
             mob.velocity.y = 0;
          }
        } else {
          // Hit ceiling
          mob.position.y -= moveY;
          mob.velocity.y = 0;
        }
      } else {
        // No collision, but check if we are JUST ABOVE ground to stick (anti-jitter)
        // Only if falling or moving slowly down
        if (moveY < 0 && moveY > -0.5) {
             const groundY = this.findGroundY(mob, 0.1); // Check slightly below
             if (groundY !== null && mob.position.y <= groundY + 0.1) {
                 mob.position.y = groundY;
                 mob.onGround = true;
                 mob.velocity.y = 0;
             }
        }
      }
    }
  }

  /**
   * Returns true if the mob's hitbox intersects with any solid block.
   */
  private checkCollision(mob: MobEntity): boolean {
    const r = mob.width / 2;
    const minX = Math.floor(mob.position.x - r);
    const maxX = Math.floor(mob.position.x + r);
    const minZ = Math.floor(mob.position.z - r);
    const maxZ = Math.floor(mob.position.z + r);
    const minY = Math.floor(mob.position.y);
    const maxY = Math.floor(mob.position.y + mob.height - 0.01); // -0.01 to avoid head hitting block above when exactly at integer height

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let y = minY; y <= maxY; y++) {
          if (this.blockPlacer.hasBlock(x, y, z)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Finds the Y coordinate of the solid block top immediately below the mob.
   * Returns null if no block is found within search distance.
   */
  private findGroundY(mob: MobEntity, extraCheckDist = 0): number | null {
    const r = mob.width / 2;
    const minX = Math.floor(mob.position.x - r);
    const maxX = Math.floor(mob.position.x + r);
    const minZ = Math.floor(mob.position.z - r);
    const maxZ = Math.floor(mob.position.z + r);
    
    const feetY = mob.position.y;
    // Check blocks intersecting the feet or just below
    const checkY = Math.floor(feetY - extraCheckDist);

    // We are looking for a block at checkY (or slightly below) that we can stand on.
    // Since we want to find the top of the block, we check if a block exists at `y`.
    // If it does, the ground Y is `y + 1`.
    
    // Check layer at Math.floor(feetY) and Math.floor(feetY) - 1
    // Prioritize higher blocks
    
    // Case 1: We are inside a block (feet buried). Snap up.
    let y = Math.floor(feetY);
    if (this.checkLayer(minX, maxX, minZ, maxZ, y)) {
        return y + 1;
    }
    
    // Case 2: Block immediately below
    y = Math.floor(feetY - extraCheckDist - 0.01); 
    // If feetY is 10.0, floor(9.99) = 9. Block at 9. Top is 10.
    if (this.checkLayer(minX, maxX, minZ, maxZ, y)) {
        return y + 1;
    }

    return null;
  }

  private checkLayer(minX: number, maxX: number, minZ: number, maxZ: number, y: number): boolean {
      for (let x = minX; x <= maxX; x++) {
          for (let z = minZ; z <= maxZ; z++) {
              if (this.blockPlacer.hasBlock(x, y, z)) {
                  return true;
              }
          }
      }
      return false;
  }
  
  jump(mob: MobEntity, force: number = 8.0) {
      if (mob.onGround) {
          mob.velocity.y = force;
          mob.onGround = false;
      }
  }
}

