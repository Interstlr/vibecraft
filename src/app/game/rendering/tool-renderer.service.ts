import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SceneManagerService } from '../core/scene-manager.service';
import { InventoryService } from '../inventory/inventory.service';
import { MaterialService } from '../../services/material.service';

@Injectable({
  providedIn: 'root',
})
export class ToolRendererService {
  private axeGroup!: THREE.Group;
  private handGroup!: THREE.Group;
  private blockGroup!: THREE.Group; // Held block
  private isSwinging = false;

  constructor(
    private sceneManager: SceneManagerService,
    private inventoryService: InventoryService,
    private materialService: MaterialService
  ) {}

  initialize() {
    const camera = this.sceneManager.getCamera();
    this.axeGroup = this.createAxeModel();
    this.handGroup = this.createHandModel();
    this.blockGroup = this.createBlockModel();
    
    camera.add(this.axeGroup);
    camera.add(this.handGroup);
    camera.add(this.blockGroup);
  }

  setSwinging(active: boolean) {
    this.isSwinging = active;
  }

  update(time: number, delta: number) {
    if (!this.axeGroup || !this.handGroup || !this.blockGroup) {
      return;
    }

    const selected = this.inventoryService.selectedItem();
    const itemType = selected.item;
    const hasItem = !!itemType && selected.count > 0;
    const isAxe = itemType === 'axe' || itemType === 'wooden_axe' || itemType === 'wooden_pickaxe'; 
    // Note: checking specific tool names, ideally should use isTool property but good enough for now
    
    const isBlock = hasItem && !isAxe && itemType !== 'stick' && itemType !== 'coal'; // Assume everything else is block for now
    const shouldShowHand = !hasItem || (hasItem && !isAxe && !isBlock);

    // AXE / TOOL
    if (isAxe) {
      this.axeGroup.visible = true;
      this.blockGroup.visible = false;
      this.handGroup.visible = false; // Hand is part of axe model implicitly or hidden

      if (this.isSwinging) {
        const swingSpeed = 15; // Faster swing
        this.axeGroup.rotation.x = Math.sin((time / 1000) * swingSpeed) * 1.2;
        this.axeGroup.rotation.z = Math.PI / 8 + Math.sin((time / 1000) * swingSpeed) * 0.5;
        this.axeGroup.position.y = -0.5 + Math.sin((time / 1000) * swingSpeed) * 0.2;
      } else {
        this.axeGroup.rotation.x = THREE.MathUtils.lerp(this.axeGroup.rotation.x, 0, 10 * delta);
        this.axeGroup.rotation.z = Math.PI / 8;
        this.axeGroup.position.y = -0.5;
      }
    } 
    // BLOCK
    else if (isBlock) {
      this.blockGroup.visible = true;
      this.axeGroup.visible = false;
      this.handGroup.visible = true; // Show hand holding block

      // Update block material if changed
      const material = this.materialService.getMaterial(itemType!);
      const mesh = this.blockGroup.children[0] as THREE.Mesh;
      if (mesh) {
          mesh.material = material;
      }

      const swingSpeed = 10;
      const baseRotX = 0;
      const baseRotY = Math.PI / 4; 
      const basePosX = 0.5; 
      const basePosY = -0.4; 
      const basePosZ = -0.8;

      if (this.isSwinging) {
          // Block punch animation
          const swing = Math.sin((time / 1000) * swingSpeed);
          this.blockGroup.rotation.x = baseRotX + swing * 0.5;
          this.blockGroup.rotation.y = baseRotY + swing * 0.5;
          this.blockGroup.position.set(
              basePosX + swing * 0.2, 
              basePosY + swing * 0.2, 
              basePosZ + swing * 0.2
          );
      } else {
          // Idle bobbing
          const idleBob = Math.sin(time / 800) * 0.02;
          this.blockGroup.rotation.x = THREE.MathUtils.lerp(this.blockGroup.rotation.x, baseRotX, 6 * delta);
          this.blockGroup.rotation.y = THREE.MathUtils.lerp(this.blockGroup.rotation.y, baseRotY, 6 * delta);
          this.blockGroup.position.set(basePosX, basePosY + idleBob, basePosZ);
      }
      
      // Sync hand to block (simplified)
      this.handGroup.position.copy(this.blockGroup.position).add(new THREE.Vector3(0.2, -0.3, 0.2));
      this.handGroup.rotation.copy(this.blockGroup.rotation);

    } 
    // EMPTY HAND
    else if (shouldShowHand) {
      this.handGroup.visible = true;
      this.axeGroup.visible = false;
      this.blockGroup.visible = false;

      const swingSpeed = 9;
      const baseRotX = -0.4;
      const baseRotZ = Math.PI / 10;
      const basePosY = -0.65;
      
      // Reset hand transform from block mode
      this.handGroup.position.set(0.72, -0.65, -0.9);
      this.handGroup.rotation.set(-Math.PI / 5, Math.PI / 11, Math.PI / 18);

      if (this.isSwinging) {
        const swing = Math.sin((time / 1000) * swingSpeed);
        this.handGroup.rotation.x = baseRotX + swing * 0.35;
        this.handGroup.rotation.z = baseRotZ + swing * 0.18;
        this.handGroup.position.y = basePosY + swing * 0.04;
      } else {
        const idleBob = Math.sin(time / 1400) * 0.008;
        this.handGroup.rotation.x = THREE.MathUtils.lerp(this.handGroup.rotation.x, baseRotX, 6 * delta);
        this.handGroup.rotation.z = THREE.MathUtils.lerp(this.handGroup.rotation.z, baseRotZ, 6 * delta);
        this.handGroup.position.y = THREE.MathUtils.lerp(this.handGroup.position.y, basePosY + idleBob, 6 * delta);
      }
    } else {
       // Fallback hide all
       this.axeGroup.visible = false;
       this.handGroup.visible = false;
       this.blockGroup.visible = false;
    }
  }

  private createAxeModel(): THREE.Group {
    const group = new THREE.Group();
    const handleGeo = new THREE.BoxGeometry(0.06, 0.6, 0.06);
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x8d6e63 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = 0;
    group.add(handle);

    const headGeo = new THREE.BoxGeometry(0.25, 0.12, 0.08);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x757575 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0.08, 0.25, 0);
    group.add(head);

    const edgeGeo = new THREE.BoxGeometry(0.05, 0.12, 0.082);
    const edgeMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.set(0.22, 0.25, 0);
    group.add(edge);

    group.position.set(0.5, -0.5, -0.8);
    group.rotation.set(0, -Math.PI / 4, Math.PI / 8);
    group.visible = false;
    return group;
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

  private createBlockModel(): THREE.Group {
      const group = new THREE.Group();
      // Scale 0.4 seems right for hand
      const geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      // Initial material, will be replaced
      const material = new THREE.MeshBasicMaterial({ visible: false }); 
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
      
      group.position.set(0.5, -0.4, -0.8);
      group.rotation.set(0, Math.PI/4, 0);
      group.visible = false;
      return group;
  }
}
