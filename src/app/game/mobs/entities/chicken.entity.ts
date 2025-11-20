import * as THREE from 'three';

export enum ChickenState {
  IDLE,
  WANDER,
  PANIC
}

export class ChickenEntity {
  id: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  velocity: THREE.Vector3;
  
  // AI State
  state: ChickenState;
  stateTimer: number;
  targetPosition: THREE.Vector3 | null;
  health: number;
  
  // Animation state
  walkTime: number;
  headYaw: number;
  headPitch: number;
  wingFlap: number;
  onGround: boolean;

  constructor(id: string, position: THREE.Vector3) {
    this.id = id;
    this.position = position;
    this.rotation = new THREE.Euler(0, Math.random() * Math.PI * 2, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    
    // AI Defaults
    this.state = ChickenState.IDLE;
    this.stateTimer = 0;
    this.targetPosition = null;
    this.health = 4; // 2 hearts
    
    this.walkTime = 0;
    this.headYaw = 0;
    this.headPitch = 0;
    this.wingFlap = 0;
    this.onGround = false;
  }
}
