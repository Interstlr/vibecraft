import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { ChickenEntity, ChickenState } from '../mobs/entities/chicken.entity';
import { PlayerControllerService } from '../player/player-controller.service';
import { MobPhysicsService } from '../mobs/physics/mob-physics.service';

@Injectable({
  providedIn: 'root',
})
export class ChickenSystemService {
  private chickens: ChickenEntity[] = [];
  
  // Constants
  private readonly MOVE_SPEED = 2.5;
  private readonly PANIC_SPEED = 5.0;
  private readonly IDLE_TIME_MIN = 2.0;
  private readonly IDLE_TIME_MAX = 5.0;

  constructor(
    private playerController: PlayerControllerService,
    private mobPhysics: MobPhysicsService
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
      // Store previous velocity to detect collision stops
      const preUpdateVel = chicken.velocity.clone();
      
      this.updateAI(chicken, delta);
      this.mobPhysics.update(chicken, delta);
      
      // Simple auto-jump logic: if we wanted to move but stopped, and are on ground, jump!
      if (chicken.onGround) {
          const wantedToMove = Math.abs(preUpdateVel.x) > 0.1 || Math.abs(preUpdateVel.z) > 0.1;
          const stopped = Math.abs(chicken.velocity.x) < 0.01 && Math.abs(chicken.velocity.z) < 0.01;
          
          if (wantedToMove && stopped) {
              this.mobPhysics.jump(chicken);
          }
      }
      
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
                // Friction handles stopping, but we can force it for idle
                // Actually let physics drag handle it naturally? No, we want precise control.
                // But we shouldn't zero velocity if falling/jumping.
                if (chicken.onGround) {
                    chicken.velocity.x = 0;
                    chicken.velocity.z = 0;
                }
            }
            break;

        case ChickenState.WANDER:
            if (chicken.stateTimer <= 0 || !chicken.targetPosition) {
                chicken.state = ChickenState.IDLE;
                chicken.stateTimer = this.IDLE_TIME_MIN + Math.random();
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
          // Accelerate towards target
          // Instead of setting velocity directly, we might want to influence it.
          // But direct setting is simpler for AI control, physics will limit it with collision.
          
          chicken.velocity.x = (dx / dist) * speed;
          chicken.velocity.z = (dz / dist) * speed;
          
          // Rotate to face direction
          const targetRotation = Math.atan2(dx, dz);
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

  private updateAnimation(chicken: ChickenEntity, delta: number) {
      // Walk cycle
      const speed = Math.sqrt(chicken.velocity.x*chicken.velocity.x + chicken.velocity.z*chicken.velocity.z);
      if (speed > 0.1 && chicken.onGround) {
        chicken.walkTime += delta * speed * 3.0;
      } else {
        // Decay walk time to 0 or nearest cycle
        // Simplify: just set to 0 if stopped
        if (speed < 0.1) chicken.walkTime = 0;
      }
      
      // Wing flap (always flap a bit, flap fast if falling)
      if (!chicken.onGround || chicken.velocity.y < -2) {
        chicken.wingFlap += delta * 20; // Fast flap when falling
      } else {
        chicken.wingFlap = 0; 
      }
  }
}
