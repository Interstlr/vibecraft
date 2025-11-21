import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SceneManagerService } from '../core/scene-manager.service';
import { MaterialService } from '../world/resources/material.service';
import { ItemDrop } from '../entities/item-drop.entity';

@Injectable({
  providedIn: 'root',
})
export class ItemDropRendererService {
  private readonly MAX_INSTANCES = 1024;
  private readonly RENDER_DISTANCE = 32;
  private instancedMeshes = new Map<string, THREE.InstancedMesh>();
  private dropInstanceMap = new Map<string, { type: string; instanceId: number }>();
  private freeInstanceIndices = new Map<string, number[]>();
  private nextInstanceIndex = new Map<string, number>();
  
  // Small cube for items
  private geometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
  private _dummy = new THREE.Object3D();

  constructor(
    private sceneManager: SceneManagerService,
    private materialService: MaterialService
  ) {}

  initialize() {
    this.instancedMeshes.clear();
    this.dropInstanceMap.clear();
    this.freeInstanceIndices.clear();
    this.nextInstanceIndex.clear();

    const scene = this.sceneManager.getScene();
    const allMaterials = this.materialService.getAllMaterials();

    for (const [name, material] of Object.entries(allMaterials)) {
      // Skip tools or special materials if necessary
      if (name === 'hover') continue;

      const mesh = new THREE.InstancedMesh(this.geometry, material, this.MAX_INSTANCES);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // We handle culling manually or let GPU handle it if we update matrices
      mesh.count = 0;

      scene.add(mesh);
      this.instancedMeshes.set(name, mesh);
      this.nextInstanceIndex.set(name, 0);
      this.freeInstanceIndices.set(name, []);
    }
  }

  addDrop(drop: ItemDrop) {
    const type = drop.type;
    const mesh = this.instancedMeshes.get(type);
    if (!mesh) return;

    let instanceId: number;
    const freeIndices = this.freeInstanceIndices.get(type)!;
    const nextIndex = this.nextInstanceIndex.get(type)!;

    if (freeIndices.length > 0) {
      instanceId = freeIndices.pop()!;
    } else {
      instanceId = nextIndex;
      if (instanceId >= this.MAX_INSTANCES) return; // Limit reached
      this.nextInstanceIndex.set(type, instanceId + 1);
    }

    if (mesh.count <= instanceId) {
      mesh.count = instanceId + 1;
    }

    this.dropInstanceMap.set(drop.id, { type, instanceId });
    this.updateDropTransform(drop, instanceId, mesh);
  }

  removeDrop(id: string) {
    const info = this.dropInstanceMap.get(id);
    if (!info) return;

    const { type, instanceId } = info;
    const mesh = this.instancedMeshes.get(type);
    if (mesh) {
      // Zero out scale to hide it
      this._dummy.scale.set(0, 0, 0);
      this._dummy.updateMatrix();
      mesh.setMatrixAt(instanceId, this._dummy.matrix);
      mesh.instanceMatrix.needsUpdate = true;
      
      this.freeInstanceIndices.get(type)?.push(instanceId);
    }

    this.dropInstanceMap.delete(id);
  }

  update(drops: ItemDrop[], playerPos: THREE.Vector3, totalTime: number) {
    const meshesToUpdate = new Set<THREE.InstancedMesh>();

    for (const drop of drops) {
      const info = this.dropInstanceMap.get(drop.id);
      // If not rendered yet (maybe initialized after spawn), add it
      if (!info) {
        this.addDrop(drop);
        continue;
      }

      // Distance culling
      if (drop.position.distanceTo(playerPos) > this.RENDER_DISTANCE) {
        // We could hide it, but for now let's just skip updating matrix (it stays where it was)
        // Or ideally we move it to 0 scale if we want to strictly cull
        continue; 
      }

      const mesh = this.instancedMeshes.get(info.type);
      if (mesh) {
        this.updateDropTransform(drop, info.instanceId, mesh, totalTime);
        meshesToUpdate.add(mesh);
      }
    }

    meshesToUpdate.forEach(mesh => {
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  private updateDropTransform(
    drop: ItemDrop, 
    instanceId: number, 
    mesh: THREE.InstancedMesh,
    time: number = 0
  ) {
    // Bobbing effect
    const bobOffset = Math.sin(time * 2.0 + drop.id.charCodeAt(0)) * 0.1;
    const yPos = drop.position.y + 0.125 + bobOffset; // +0.125 to center vertically if pivot is bottom, but geometry is centered

    this._dummy.position.set(drop.position.x, yPos, drop.position.z);
    
    // Continuous rotation + initial random rotation
    this._dummy.rotation.copy(drop.rotation);
    this._dummy.rotation.y += time * 1.0; 

    this._dummy.scale.set(1, 1, 1);
    this._dummy.updateMatrix();

    mesh.setMatrixAt(instanceId, this._dummy.matrix);
  }
}

