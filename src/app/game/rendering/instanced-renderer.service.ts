import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SceneManagerService } from '../core/scene-manager.service';
import { MaterialService } from '../../services/material.service';
import { WORLD_CONFIG } from '../../config/world.config';

@Injectable({
  providedIn: 'root',
})
export class InstancedRendererService {
  // Increased multiplier to accomodate deep stone layers (30+ blocks deep)
  private readonly maxInstances = Math.max(10000, WORLD_CONFIG.size * WORLD_CONFIG.size * 50);
  private instancedMeshes = new Map<string, THREE.InstancedMesh>();
  private nextInstanceIndex = new Map<string, number>();
  private freeInstanceIndices = new Map<string, number[]>();
  private geometry = new THREE.BoxGeometry(
    WORLD_CONFIG.blockSize,
    WORLD_CONFIG.blockSize,
    WORLD_CONFIG.blockSize,
  );
  private _dummy = new THREE.Object3D();

  constructor(
    private sceneManager: SceneManagerService,
    private materialService: MaterialService,
  ) {}

  initialize() {
    const scene = this.sceneManager.getScene();
    const allMaterials = this.materialService.getAllMaterials();

    for (const [name, material] of Object.entries(allMaterials)) {
      if (name === 'hover' || name === 'axe') {
        continue;
      }

      const mesh = new THREE.InstancedMesh(this.geometry, material, this.maxInstances);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.count = 0;

      scene.add(mesh);
      this.instancedMeshes.set(name, mesh);
      this.nextInstanceIndex.set(name, 0);
      this.freeInstanceIndices.set(name, []);
    }
  }

  placeInstance(type: string, x: number, y: number, z: number): number | null {
    const mesh = this.instancedMeshes.get(type);
    if (!mesh) {
      return null;
    }

    let instanceId: number;
    const freeIndices = this.freeInstanceIndices.get(type)!;
    const nextIndex = this.nextInstanceIndex.get(type)!;

    if (freeIndices.length > 0) {
      instanceId = freeIndices.pop()!;
    } else {
      instanceId = nextIndex;
      if (instanceId >= this.maxInstances) {
        return null;
      }
      this.nextInstanceIndex.set(type, instanceId + 1);
      if (mesh.count <= instanceId) {
        mesh.count = instanceId + 1;
      }
    }

    this._dummy.position.set(x, y, z);
    this._dummy.scale.set(1, 1, 1);
    this._dummy.updateMatrix();
    mesh.setMatrixAt(instanceId, this._dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
    return instanceId;
  }

  removeInstance(type: string, instanceId: number) {
    const mesh = this.instancedMeshes.get(type);
    if (!mesh) {
      return;
    }
    this._dummy.position.set(0, 0, 0);
    this._dummy.scale.set(0, 0, 0);
    this._dummy.updateMatrix();
    mesh.setMatrixAt(instanceId, this._dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
    this.freeInstanceIndices.get(type)?.push(instanceId);
  }

  syncCounts() {
    this.instancedMeshes.forEach((mesh, type) => {
      const nextIndex = this.nextInstanceIndex.get(type) || 0;
      mesh.count = nextIndex;
      mesh.instanceMatrix.needsUpdate = true;
    });
  }
}

