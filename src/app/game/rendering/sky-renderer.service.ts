import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SceneManagerService } from '../core/scene-manager.service';

@Injectable({
  providedIn: 'root',
})
export class SkyRendererService {
  private sunMesh!: THREE.Mesh;

  constructor(private sceneManager: SceneManagerService) {}

  initialize(direction = new THREE.Vector3(0.5, 1, 0.5)) {
    const normalizedDirection = direction.lengthSq() > 0 ? direction.normalize() : new THREE.Vector3(0, 1, 0);
    const sunDistance = 120;
    const sunGeometry = new THREE.PlaneGeometry(32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff4c1,
      transparent: true,
      opacity: 0.98,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      fog: false,
    });

    this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sunMesh.position.copy(normalizedDirection.multiplyScalar(sunDistance));
    this.sceneManager.getScene().add(this.sunMesh);
  }

  update() {
    if (this.sunMesh) {
      this.sunMesh.lookAt(this.sceneManager.getCamera().position);
    }
  }
}

