import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { ChickenEntity, ChickenState } from '../mobs/entities/chicken.entity';
import { BlockPlacerService } from '../world/block-placer.service';
import { PlayerControllerService } from '../player/player-controller.service';

@Injectable({
  providedIn: 'root',
})
export class ChickenSystemService {
  private chickens: ChickenEntity[] = [];
  
  // Physics constants
  private readonly GRAVITY = -18.0; // Reduced gravity for chicken flutter effect
  private readonly TERMINAL_VELOCITY = -5.0; // Slow falling
  private readonly MOVE_SPEED = 2.5;
  private readonly PANIC_SPEED = 5.0;
  private readonly JUMP_FORCE = 8.0;
  
  // AI Constants
  private readonly WANDER_CHANCE = 0.02; // Per frame (at 60fps ~1.2 times/sec checks)
  private readonly IDLE_TIME_MIN = 2.0;
  private readonly IDLE_TIME_MAX = 5.0;
  private readonly WANDER_DIST = 5;

  constructor(
    private blockPlacer: BlockPlacerService,
    private playerController: PlayerControllerService
  ) {}

  spawnChicken(position: THREE.Vector3) {
    const id = Math.random().toString(36).substr(2, 9);
    const chicken = new ChickenEntity(id, position.clone());
    this.chickens.push(chicken);
  }

  getChickens(): ChickenEntity[] {
    return this.chickens;
  }

  update(delta: number) {
    for (const chicken of this.chickens) {
      this.updateAI(chicken, delta);
      this.updatePhysics(chicken, delta);
      this.updateAnimation(chicken, delta);
    }
  }

  // Triggered when player hits the chicken
  damageChicken(id: string) {
    const chicken = this.chickens.find(c => c.id === id);
    if (chicken) {
        chicken.health -= 1;
        if (chicken.health > 0) {
            // Panic!
            chicken.state = ChickenState.PANIC;
            chicken.stateTimer = 5.0; // Run for 5 seconds
            this.pickPanicTarget(chicken);
        } else {
            // Die (simple remove for now)
            this.removeChicken(id);
        }
    }
  }

  removeChicken(id: string) {
    const index = this.chickens.findIndex(c => c.id === id);
    if (index !== -1) {
        this.chickens.splice(index, 1);
    }
  }

  private updateAI(chicken: ChickenEntity, delta: number) {
    chicken.stateTimer -= delta;

    switch (chicken.state) {
        case ChickenState.IDLE:
            if (chicken.stateTimer <= 0) {
                // Pick new state
                if (Math.random() < 0.5) {
                    // Wander
                    chicken.state = ChickenState.WANDER;
                    chicken.stateTimer = 1.0 + Math.random() * 2.0;
                    this.pickWanderTarget(chicken);
                } else {
                    // Stay idle
                    chicken.stateTimer = this.IDLE_TIME_MIN + Math.random() * (this.IDLE_TIME_MAX - this.IDLE_TIME_MIN);
                    chicken.velocity.x = 0;
                    chicken.velocity.z = 0;
                }
            } else {
                // Occasionally look at player if close
                const dist = chicken.position.distanceTo(this.playerController.position);
                if (dist < 6 && Math.random() < 0.05) {
                    this.lookAt(chicken, this.playerController.position);
                }
                chicken.velocity.x = 0;
                chicken.velocity.z = 0;
            }
            break;

        case ChickenState.WANDER:
            if (chicken.stateTimer <= 0 || !chicken.targetPosition) {
                chicken.state = ChickenState.IDLE;
                chicken.stateTimer = this.IDLE_TIME_MIN + Math.random();
                chicken.velocity.x = 0;
                chicken.velocity.z = 0;
            } else {
                this.moveToTarget(chicken, this.MOVE_SPEED);
                // If reached target (approx)
                if (this.hasReachedTarget(chicken)) {
                    chicken.state = ChickenState.IDLE;
                }
            }
            break;

        case ChickenState.PANIC:
            if (chicken.stateTimer <= 0) {
                chicken.state = ChickenState.IDLE;
            } else {
                // Keep running away from player
                if (!chicken.targetPosition || this.hasReachedTarget(chicken)) {
                    this.pickPanicTarget(chicken);
                }
                this.moveToTarget(chicken, this.PANIC_SPEED);
            }
            break;
    }
  }

  private pickWanderTarget(chicken: ChickenEntity) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 2 + Math.random() * 3;
      chicken.targetPosition = new THREE.Vector3(
          chicken.position.x + Math.cos(angle) * dist,
          chicken.position.y,
          chicken.position.z + Math.sin(angle) * dist
      );
  }

  private pickPanicTarget(chicken: ChickenEntity) {
      // Vector away from player
      const awayDir = chicken.position.clone().sub(this.playerController.position).normalize();
      awayDir.y = 0; // Keep on ground plane
      
      // Target is 10 blocks away
      chicken.targetPosition = chicken.position.clone().add(awayDir.multiplyScalar(8));
  }

  private moveToTarget(chicken: ChickenEntity, speed: number) {
      if (!chicken.targetPosition) return;

      const dx = chicken.targetPosition.x - chicken.position.x;
      const dz = chicken.targetPosition.z - chicken.position.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      
      if (dist > 0.1) {
          chicken.velocity.x = (dx / dist) * speed;
          chicken.velocity.z = (dz / dist) * speed;
          
          // Rotate to face direction
          const targetRotation = Math.atan2(dx, dz); // In Three.js, atan2(x, z) usually works for Y rotation if 0 is +Z?
          // Actually standard is atan2(x, z).
          // Let's smooth rotation
          let rotDiff = targetRotation - chicken.rotation.y;
          while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
          while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
          
          chicken.rotation.y += rotDiff * 0.1; // Smooth turn
      }
  }

  private lookAt(chicken: ChickenEntity, target: THREE.Vector3) {
      const dx = target.x - chicken.position.x;
      const dz = target.z - chicken.position.z;
      chicken.rotation.y = Math.atan2(dx, dz);
  }

  private hasReachedTarget(chicken: ChickenEntity): boolean {
      if (!chicken.targetPosition) return true;
      const dx = chicken.position.x - chicken.targetPosition.x;
      const dz = chicken.position.z - chicken.targetPosition.z;
      return (dx*dx + dz*dz) < 0.5;
  }

  private updatePhysics(chicken: ChickenEntity, delta: number) {
    // Apply gravity
    chicken.velocity.y += this.GRAVITY * delta;
    // Cap terminal velocity (chickens float down slowly)
    if (chicken.velocity.y < this.TERMINAL_VELOCITY) {
      chicken.velocity.y = this.TERMINAL_VELOCITY;
    }

    const move = chicken.velocity.clone().multiplyScalar(delta);
    
    // 1. Try X movement
    let nextPos = chicken.position.clone();
    nextPos.x += move.x;
    if (this.checkCollision(nextPos)) {
        // Auto-jump check
        if (chicken.onGround && !this.checkCollision(nextPos.clone().add(new THREE.Vector3(0, 1.1, 0)))) {
             chicken.velocity.y = this.JUMP_FORCE;
             chicken.onGround = false;
        }
        // Always stop horizontal movement on collision
        nextPos.x = chicken.position.x;
    }

    // 2. Try Z movement
    nextPos.z += move.z;
    if (this.checkCollision(nextPos)) {
         if (chicken.onGround && !this.checkCollision(nextPos.clone().add(new THREE.Vector3(0, 1.1, 0)))) {
             chicken.velocity.y = this.JUMP_FORCE;
             chicken.onGround = false;
        }
        // Always stop horizontal movement on collision
        nextPos.z = chicken.position.z;
    }

    // 3. Try Y movement (Vertical)
    nextPos.y += move.y;
    
    // Floor/Ceiling Collision
    if (move.y < 0) { // Falling
        // Check feet collision
        if (this.checkCollision(nextPos)) {
             // Snap to top of block
             nextPos.y = Math.floor(nextPos.y) + 1;
             chicken.velocity.y = 0;
             chicken.onGround = true;
        } else {
             // Check if we are just above a block
             const blockBelowY = Math.floor(nextPos.y);
             if (this.blockPlacer.hasBlock(Math.floor(nextPos.x), blockBelowY - 1, Math.floor(nextPos.z))) {
                 if (nextPos.y < blockBelowY + 0.05) {
                     nextPos.y = blockBelowY;
                     chicken.velocity.y = 0;
                     chicken.onGround = true;
                 } else {
                     chicken.onGround = false;
                 }
             } else {
                 chicken.onGround = false;
             }
        }
    } else if (move.y > 0) { // Jumping
        const headPos = nextPos.clone();
        headPos.y += 0.7;
        if (this.checkCollision(headPos)) {
            // Hit head
            nextPos.y = Math.floor(headPos.y) - 0.71;
            chicken.velocity.y = 0;
        }
        chicken.onGround = false;
    }

    chicken.position.copy(nextPos);
  }

  private checkCollision(pos: THREE.Vector3): boolean {
      // Check collision with a small radius (0.2) to prevent clipping
      const r = 0.2;
      const minX = Math.floor(pos.x - r);
      const maxX = Math.floor(pos.x + r);
      const minZ = Math.floor(pos.z - r);
      const maxZ = Math.floor(pos.z + r);
      const y = Math.floor(pos.y); // Feet level

      for (let x = minX; x <= maxX; x++) {
          for (let z = minZ; z <= maxZ; z++) {
              if (this.blockPlacer.hasBlock(x, y, z)) {
                  return true;
              }
          }
      }
      return false;
  }

  private updateAnimation(chicken: ChickenEntity, delta: number) {
      // Walk cycle
      const speed = Math.sqrt(chicken.velocity.x*chicken.velocity.x + chicken.velocity.z*chicken.velocity.z);
      if (speed > 0.1) {
        chicken.walkTime += delta * speed * 3.0;
      } else {
        // Decay walk time to 0 or nearest cycle
        chicken.walkTime = 0; 
      }
      
      // Wing flap (always flap a bit, flap fast if falling)
      if (!chicken.onGround || chicken.velocity.y < -2) {
        chicken.wingFlap += delta * 20; // Fast flap when falling
      } else {
        chicken.wingFlap = 0; 
      }
  }
}
