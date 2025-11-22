import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SceneManagerService } from '../core/scene-manager.service';
import { MaterialService } from '../world/resources/material.service';
import { ItemDrop } from '../entities/item-drop.entity';
import { BLOCKS } from '../config/blocks.config';
import { ItemMeshGenerator } from './item-mesh-generator';

@Injectable({
  providedIn: 'root',
})
export class ItemDropRendererService {
  private readonly MAX_INSTANCES = 1024;
  private readonly RENDER_DISTANCE = 128;
  private instancedMeshes = new Map<string, THREE.InstancedMesh>();
  private dropInstanceMap = new Map<string, { type: string; instanceId: number }>();
  private freeInstanceIndices = new Map<string, number[]>();
  private nextInstanceIndex = new Map<string, number>();
  private pendingUpgrade = new Set<string>();
  
  // Geometries
  // Normalized to ~1.0 size to match ItemMeshGenerator output.
  // Blocks are slightly smaller (0.8) to look balanced next to tools.
  private boxGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8); 
  private itemGeometry = new THREE.BoxGeometry(1, 1, 0.1);
  
  private _dummy = new THREE.Object3D();

  constructor(
    private sceneManager: SceneManagerService,
    private materialService: MaterialService
  ) {}

  initialize() {
    // Clean up existing
    this.instancedMeshes.forEach(mesh => {
      this.sceneManager.getScene().remove(mesh);
      // Dispose geometry if it's custom generated (not the shared ones)
      if (mesh.geometry !== this.boxGeometry && mesh.geometry !== this.itemGeometry) {
        mesh.geometry.dispose();
      }
    });
    this.instancedMeshes.clear();
    this.dropInstanceMap.clear();
    this.freeInstanceIndices.clear();
    this.nextInstanceIndex.clear();
    this.pendingUpgrade.clear();

    const scene = this.sceneManager.getScene();
    const allMaterials = this.materialService.getAllMaterials();

    for (const [name, material] of Object.entries(allMaterials)) {
      if (name === 'hover') continue;

      const blockDef = BLOCKS[name];
      // Heuristic: Blocks have ID < 100. Items/Tools have ID >= 100 or isTool flag.
      const isBlock = blockDef && blockDef.id < 100 && !blockDef.isTool;
      
      let geometry: THREE.BufferGeometry;
      
      if (isBlock) {
        geometry = this.boxGeometry;
      } else {
        // Try to generate 3D extruded mesh
        let generated: THREE.BufferGeometry | null = null;
        
        // Only attempt generation for single materials with a texture map
        if (!Array.isArray(material) && material.map) {
          generated = ItemMeshGenerator.generate(material.map);
        }
        
        if (generated) {
          geometry = generated;
        } else {
          geometry = this.itemGeometry;
          // If it's an item/tool and has a map (maybe loading), mark for upgrade check
          if (!Array.isArray(material) && material.map) {
            this.pendingUpgrade.add(name);
          }
        }
      }

      // If we generated geometry with vertex colors, use a vertex-color capable material
      let finalMaterial: THREE.Material | THREE.Material[] = material;
      if (geometry !== this.boxGeometry && geometry !== this.itemGeometry && geometry.getAttribute('color')) {
         finalMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
      }

      const mesh = new THREE.InstancedMesh(geometry, finalMaterial, this.MAX_INSTANCES);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;

      scene.add(mesh);
      this.instancedMeshes.set(name, mesh);
      this.nextInstanceIndex.set(name, 0);
      this.freeInstanceIndices.set(name, []);
    }
  }

  addDrop(drop: ItemDrop) {
    const type = drop.type;
    
    // Check if we can upgrade the geometry for this type
    if (this.pendingUpgrade.has(type)) {
      this.tryUpgradeGeometry(type);
    }

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

  private tryUpgradeGeometry(type: string) {
    const mesh = this.instancedMeshes.get(type);
    if (!mesh) return;

    const material = mesh.material;
    if (Array.isArray(material) || !material.map) {
      this.pendingUpgrade.delete(type);
      return;
    }

    const generated = ItemMeshGenerator.generate(material.map);
    if (generated) {
      // Upgrade successful!
      // Create new mesh with new geometry and vertex-color material
      const newMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
      const newMesh = new THREE.InstancedMesh(generated, newMaterial, this.MAX_INSTANCES);
      newMesh.castShadow = true;
      newMesh.receiveShadow = true;
      newMesh.frustumCulled = false;
      newMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      // Copy state
      newMesh.count = mesh.count;
      newMesh.instanceMatrix.array.set(mesh.instanceMatrix.array);
      newMesh.instanceMatrix.needsUpdate = true;

      // Replace in scene
      const scene = this.sceneManager.getScene();
      scene.remove(mesh);
      scene.add(newMesh);
      
      // Update map
      this.instancedMeshes.set(type, newMesh);
      
      // Done
      this.pendingUpgrade.delete(type);
      
      // Dispose old geometry? NO, it's likely this.itemGeometry (shared).
      // Just dispose the mesh object (handled by GC mostly, but good to remove from parent)
    }
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
    // Reduced amplitude to avoid clipping when close to ground
    const bobOffset = Math.sin(time * 2.0 + drop.id.charCodeAt(0)) * 0.02;
    
    // Determine base height based on mesh type
    // Blocks are 0.8 size * 0.33 scale = ~0.26 unit size. Center is ~0.13. 
    // Physics radius is 0.125 -> rests at floor + 0.125.
    // User requested items to be lower, closer to the block surface.
    const isBlock = mesh.geometry === this.boxGeometry;
    // Blocks: -0.08 lowers them to clip slightly/sit heavy.
    // Items: -0.15 lowers them significantly so they don't "float in the middle".
    const baseHeight = isBlock ? -0.08 : -0.15; 
    
    const yPos = drop.position.y + baseHeight + bobOffset; 

    this._dummy.position.set(drop.position.x, yPos, drop.position.z);
    
    // Continuous rotation + initial random rotation (Force upright orientation)
    this._dummy.rotation.set(0, drop.rotation.y + time * 1.0, 0); 

    // Scale down dropped items (3x smaller as requested)
    this._dummy.scale.set(0.33, 0.33, 0.33);
    this._dummy.updateMatrix();

    mesh.setMatrixAt(instanceId, this._dummy.matrix);
  }
}
