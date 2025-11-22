import * as THREE from 'three';

export class ItemDrop {
  id: string;
  type: string;
  count: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  age: number;
  onGround: boolean;
  pickupDelay: number;

  constructor(id: string, type: string, count: number, position: THREE.Vector3, velocity?: THREE.Vector3) {
    this.id = id;
    this.type = type;
    this.count = count;
    this.position = position;
    
    if (velocity) {
      this.velocity = velocity;
    } else {
      this.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        1.5 + Math.random() * 1.5, // Reduced upward pop (was 2.0 + 2.0)
        (Math.random() - 0.5) * 1.5
      );
    }
    
    this.rotation = new THREE.Euler(
      0,
      Math.random() * Math.PI * 2,
      0
    );
    this.age = 0;
    this.onGround = false;
    this.pickupDelay = 1.0; // 1 second delay so you don't instantly pick up what you threw
  }
}
