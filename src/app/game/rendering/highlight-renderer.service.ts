import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SceneManagerService } from '../core/scene-manager.service';
import { MaterialService } from '../world/resources/material.service';

@Injectable({
  providedIn: 'root',
})
export class HighlightRendererService {
  private outlineMesh!: THREE.LineSegments;

  constructor(
    private sceneManager: SceneManagerService,
    private materialService: MaterialService,
  ) {}

  initialize() {
    const outlineGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const outlineEdges = new THREE.EdgesGeometry(outlineGeo);
    const outlineMaterial = this.materialService.getMaterial('hover') as THREE.LineBasicMaterial;

    this.outlineMesh = new THREE.LineSegments(outlineEdges, outlineMaterial);
    this.outlineMesh.visible = false;
    this.sceneManager.getScene().add(this.outlineMesh);
  }

  show(x: number, y: number, z: number) {
    if (!this.outlineMesh) {
      return;
    }
    this.outlineMesh.visible = true;
    this.outlineMesh.position.set(x, y, z);
  }

  hide() {
    if (this.outlineMesh) {
      this.outlineMesh.visible = false;
    }
  }
}

