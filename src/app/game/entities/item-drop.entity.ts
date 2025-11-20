import * as THREE from 'three';

export class ItemDrop {
  id: string;
  type: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  age: number;
  onGround: boolean;
  pickupDelay: number;

  constructor(id: string, type: string, position: THREE.Vector3) {
    this.id = id;
    this.type = type;
    this.position = position;
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2.0,
      2.0 + Math.random() * 2.0,
      (Math.random() - 0.5) * 2.0
    );
    this.rotation = new THREE.Euler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );
    this.age = 0;
    this.onGround = false;
    this.pickupDelay = 0.5; // seconds before it can be picked up
  }
}

