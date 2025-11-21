import * as THREE from 'three';

export interface MobEntity {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  
  // Physics properties
  width: number;  // Hitbox width (x/z)
  height: number; // Hitbox height (y)
  onGround: boolean;
}

