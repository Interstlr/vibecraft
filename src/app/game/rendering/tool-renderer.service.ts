import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SceneManagerService } from '../core/scene-manager.service';
import { InventoryService } from '../inventory/inventory.service';
import { MaterialService } from '../world/resources/material.service';
import { BLOCKS } from '../config/blocks.config';

@Injectable({
  providedIn: 'root',
})
export class ToolRendererService {
  private handGroup!: THREE.Group;
  private itemGroup!: THREE.Group; // Holds both tools and blocks
  private isSwinging = false;
  private currentItemType: string | null = null;
  
  private toolMeshCache = new Map<string, THREE.Mesh>();
  private processingTexture = new Set<string>();

  constructor(
    private sceneManager: SceneManagerService,
    private inventoryService: InventoryService,
    private materialService: MaterialService
  ) {}

  initialize() {
    const camera = this.sceneManager.getCamera();
    
    this.handGroup = this.createHandModel();
    this.itemGroup = new THREE.Group();
    
    // Placeholder mesh (invisible)
    const placeholder = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.1), new THREE.MeshBasicMaterial({visible:false}));
    this.itemGroup.add(placeholder);

    // Block mesh (for blocks) - REUSED
    const blockGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5); // Slightly larger blocks in hand
    const blockMat = new THREE.MeshBasicMaterial({ visible: false }); 
    const blockMesh = new THREE.Mesh(blockGeo, blockMat);
    blockMesh.name = 'block_item';
    blockMesh.visible = false;
    this.itemGroup.add(blockMesh);

    camera.add(this.handGroup);
    camera.add(this.itemGroup);
  }

  setSwinging(active: boolean) {
    this.isSwinging = active;
  }

  update(time: number, delta: number) {
    if (!this.handGroup || !this.itemGroup) return;

    const selected = this.inventoryService.selectedItem();
    const itemType = selected.item;
    const hasItem = !!itemType && selected.count > 0;

    if (itemType !== this.currentItemType) {
        this.updateItemModel(itemType);
        this.currentItemType = itemType;
    }

    const isTool = this.isToolOrItem(itemType);
    const isBlock = hasItem && !isTool; 
    const showHand = !hasItem || (hasItem && !isTool && !isBlock);

    // Visibility management
    const blockMesh = this.itemGroup.getObjectByName('block_item') as THREE.Mesh;
    
    // Hide all cached tool meshes first
    this.itemGroup.children.forEach(child => {
        if (child.name.startsWith('tool_')) child.visible = false;
    });

    if (isTool && itemType) {
        const toolMesh = this.toolMeshCache.get(itemType);
        if (toolMesh) {
            toolMesh.visible = true;
        }
        blockMesh.visible = false;
        this.handGroup.visible = false; 
    } else if (isBlock) {
        blockMesh.visible = true;
        this.handGroup.visible = true;
    } else {
        blockMesh.visible = false;
        this.handGroup.visible = true;
    }

    this.animateItem(time, delta, isTool, isBlock);
  }

  private isToolOrItem(type: string | null): boolean {
      if (!type) return false;
      const def = BLOCKS[type];
      return !!def?.isTool || type === 'stick' || type === 'coal' || !!def?.texture?.includes('/item/');
  }

  private updateItemModel(type: string | null) {
      if (!type) return;

      const isTool = this.isToolOrItem(type);

      if (isTool) {
          if (this.toolMeshCache.has(type) || this.processingTexture.has(type)) return;
          
          const def = BLOCKS[type];
          let textureUrl = def?.texture;
          
          if (!textureUrl) {
             if (type.includes('axe') || type.includes('pickaxe') || type.includes('shovel') || type.includes('sword')) {
                 textureUrl = `assets/minecraft/textures/item/${type}.png`;
             }
          }

          if (textureUrl) {
              this.processingTexture.add(type);
              this.generateExtrudedMesh(type, textureUrl).then(mesh => {
                  if (mesh) {
                      mesh.name = `tool_${type}`;
                      // Scale tool
                      mesh.geometry.translate(0.5, 0.5, 0);
                      mesh.scale.set(0.65, 0.65, 0.65); 
                      this.itemGroup.add(mesh);
                      this.toolMeshCache.set(type, mesh);
                  }
                  this.processingTexture.delete(type);
              });
          }
      } else {
          // Block
          const blockMesh = this.itemGroup.getObjectByName('block_item') as THREE.Mesh;
          const material = this.materialService.getMaterial(type);
          if (material && blockMesh) {
              blockMesh.material = material;
          }
      }
  }

  private async generateExtrudedMesh(type: string, url: string): Promise<THREE.Mesh | null> {
      return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) { resolve(null); return; }
              
              ctx.drawImage(img, 0, 0);
              const data = ctx.getImageData(0, 0, img.width, img.height).data;
              
              const geometries: THREE.BoxGeometry[] = [];
              const material = new THREE.MeshLambertMaterial({ vertexColors: true });
              
              const w = img.width;
              const h = img.height;
              const pixelSize = 1 / 16; // Assuming 16x16 standard size normalized to 1 unit
              
              // Create merged geometry
              // For better performance we construct a single BufferGeometry manually
              const positions: number[] = [];
              const colors: number[] = [];
              const normals: number[] = [];
              const indices: number[] = [];
              let vIndex = 0;

              const addBox = (x: number, y: number, r: number, g: number, b: number) => {
                  // Center of box
                  const cx = (x - w/2) * pixelSize;
                  const cy = -(y - h/2) * pixelSize; // Flip Y
                  const cz = 0;
                  const hs = pixelSize / 2; // Half size
                  const thickness = pixelSize / 2; // Extrusion depth

                  // 6 faces, 4 verts each
                  // Front (z+)
                  positions.push(cx-hs, cy-hs, thickness, cx+hs, cy-hs, thickness, cx+hs, cy+hs, thickness, cx-hs, cy+hs, thickness);
                  normals.push(0,0,1, 0,0,1, 0,0,1, 0,0,1);
                  // Back (z-)
                  positions.push(cx+hs, cy-hs, -thickness, cx-hs, cy-hs, -thickness, cx-hs, cy+hs, -thickness, cx+hs, cy+hs, -thickness);
                  normals.push(0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1);
                  // Top (y+)
                  positions.push(cx-hs, cy+hs, thickness, cx+hs, cy+hs, thickness, cx+hs, cy+hs, -thickness, cx-hs, cy+hs, -thickness);
                  normals.push(0,1,0, 0,1,0, 0,1,0, 0,1,0);
                  // Bottom (y-)
                  positions.push(cx-hs, cy-hs, -thickness, cx+hs, cy-hs, -thickness, cx+hs, cy-hs, thickness, cx-hs, cy-hs, thickness);
                  normals.push(0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0);
                  // Right (x+)
                  positions.push(cx+hs, cy-hs, thickness, cx+hs, cy-hs, -thickness, cx+hs, cy+hs, -thickness, cx+hs, cy+hs, thickness);
                  normals.push(1,0,0, 1,0,0, 1,0,0, 1,0,0);
                  // Left (x-)
                  positions.push(cx-hs, cy-hs, -thickness, cx-hs, cy-hs, thickness, cx-hs, cy+hs, thickness, cx-hs, cy+hs, -thickness);
                  normals.push(-1,0,0, -1,0,0, -1,0,0, -1,0,0);

                  for(let i=0; i<24; i++) {
                      colors.push(r/255, g/255, b/255);
                  }

                  // Indices
                  for(let i=0; i<6; i++) {
                      const base = vIndex + i*4;
                      indices.push(base, base+1, base+2, base, base+2, base+3);
                  }
                  vIndex += 24;
              };

              for (let y = 0; y < h; y++) {
                  for (let x = 0; x < w; x++) {
                      const i = (y * w + x) * 4;
                      const alpha = data[i + 3];
                      if (alpha > 10) { // Threshold
                          addBox(x, y, data[i], data[i+1], data[i+2]);
                      }
                  }
              }

              const geometry = new THREE.BufferGeometry();
              geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
              geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
              geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
              geometry.setIndex(indices);
              
              resolve(new THREE.Mesh(geometry, material));
          };
          img.src = url;
      });
  }

  private animateItem(time: number, delta: number, isTool: boolean, isBlock: boolean) {
    // Base positions
    const handBasePos = new THREE.Vector3(0.72, -0.65, -0.9);
    const handBaseRot = new THREE.Euler(-Math.PI / 5, Math.PI / 11, Math.PI / 18);

    // Animate Hand
    if (this.handGroup.visible) {
        if (isBlock) {
             this.handGroup.position.copy(this.itemGroup.position).add(new THREE.Vector3(0.2, -0.3, 0.2));
             this.handGroup.rotation.copy(this.itemGroup.rotation);
        } else {
            if (this.isSwinging) {
                const swingSpeed = 9;
                const swing = Math.sin((time / 1000) * swingSpeed);
                this.handGroup.rotation.x = handBaseRot.x + swing * 0.35;
                this.handGroup.rotation.z = handBaseRot.z + swing * 0.18;
                this.handGroup.position.y = handBasePos.y + swing * 0.04;
            } else {
                const idleBob = Math.sin(time / 1400) * 0.008;
                this.handGroup.position.set(handBasePos.x, handBasePos.y + idleBob, handBasePos.z);
                this.handGroup.rotation.copy(handBaseRot);
            }
        }
    }

    // Animate Item Group
    if (isTool) {
        // Pivot is now at the handle (bottom-left of tool).
        // We position the handle in the hand (bottom-right of screen).
        const basePos = new THREE.Vector3(0.5, -0.75, -0.7);
        // Initial rotation to point the tool forward/up/left
        const baseRot = new THREE.Euler(0, -Math.PI / 2 + 0.3, Math.PI / 10); 

        if (this.isSwinging) {
             const swingSpeed = 12;
             // Use absolute sine for a unidirectional motion (0 -> 1 -> 0)
             const swingProgress = Math.abs(Math.sin((time / 1000) * swingSpeed));
             
             // Pure rotational swing around the handle pivot
             this.itemGroup.position.copy(basePos);

             // Swing towards center (Yaw +) and Down (Pitch +)
             // Fixed: Use Z-axis rotation (Roll) for the main "screen-space" swing
             // to avoid the "falling backward" 3D effect of X-axis rotation.
             this.itemGroup.rotation.set(
                 baseRot.x,                        // Keep X stable (no back/forward tilt)
                 baseRot.y + swingProgress * 0.15, // Slight Yaw inward
                 baseRot.z + swingProgress * 0.75  // Main Arc: Tip moves Left and Down
             );
        } else {
             this.itemGroup.position.copy(basePos);
             // Idle breathing
             this.itemGroup.position.y += Math.sin(time / 800) * 0.005;
             this.itemGroup.rotation.set(
                THREE.MathUtils.lerp(this.itemGroup.rotation.x, baseRot.x, 10 * delta),
                baseRot.y,
                baseRot.z
             );
        }
    } else if (isBlock) {
        const basePos = new THREE.Vector3(0.5, -0.4, -0.8);
        const baseRot = new THREE.Euler(0, Math.PI/4, 0);

        if (this.isSwinging) {
            const swingSpeed = 10;
            const swing = Math.sin((time / 1000) * swingSpeed);
            this.itemGroup.rotation.set(
                baseRot.x + swing * 0.5,
                baseRot.y + swing * 0.5,
                baseRot.z
            );
             this.itemGroup.position.set(
                basePos.x + swing * 0.2,
                basePos.y + swing * 0.2,
                basePos.z + swing * 0.2
             );
        } else {
            this.itemGroup.position.set(
                basePos.x, 
                basePos.y + Math.sin(time / 800) * 0.02, 
                basePos.z
            );
            this.itemGroup.rotation.set(
                THREE.MathUtils.lerp(this.itemGroup.rotation.x, baseRot.x, 6 * delta),
                THREE.MathUtils.lerp(this.itemGroup.rotation.y, baseRot.y, 6 * delta),
                baseRot.z
            );
        }
    }
  }

  private createHandModel(): THREE.Group {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xe0b187 });

    const armGeo = new THREE.BoxGeometry(0.18, 0.55, 0.18);
    const arm = new THREE.Mesh(armGeo, skinMat);
    arm.position.set(0, -0.05, 0.01);
    group.add(arm);

    const palmGeo = new THREE.BoxGeometry(0.22, 0.18, 0.2);
    const palm = new THREE.Mesh(palmGeo, skinMat);
    palm.position.set(0.01, -0.37, 0.08);
    group.add(palm);

    const thumbGeo = new THREE.BoxGeometry(0.06, 0.16, 0.08);
    const thumb = new THREE.Mesh(thumbGeo, skinMat);
    thumb.position.set(0.12, -0.33, 0.02);
    thumb.rotation.z = -Math.PI / 10;
    group.add(thumb);

    group.position.set(0.72, -0.65, -0.9);
    group.rotation.set(-Math.PI / 5, Math.PI / 11, Math.PI / 18);
    group.visible = false;
    return group;
  }
}
