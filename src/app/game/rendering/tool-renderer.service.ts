import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SceneManagerService } from '../core/scene-manager.service';
import { InventoryService } from '../inventory/inventory.service';
import { MaterialService } from '../world/resources/material.service';

@Injectable({
  providedIn: 'root',
})
export class ToolRendererService {
  private axeGroup!: THREE.Group;
  private pickaxeGroup!: THREE.Group;
  private shovelGroup!: THREE.Group;
  private swordGroup!: THREE.Group;
  private handGroup!: THREE.Group;
  private blockGroup!: THREE.Group; // Held block
  private isSwinging = false;
  private currentToolGroup: THREE.Group | null = null;

  constructor(
    private sceneManager: SceneManagerService,
    private inventoryService: InventoryService,
    private materialService: MaterialService
  ) {}

  initialize() {
    const camera = this.sceneManager.getCamera();
    this.axeGroup = this.createAxeModel();
    this.pickaxeGroup = this.createPickaxeModel();
    this.shovelGroup = this.createShovelModel();
    this.swordGroup = this.createSwordModel();
    this.handGroup = this.createHandModel();
    this.blockGroup = this.createBlockModel();
    
    camera.add(this.axeGroup);
    camera.add(this.pickaxeGroup);
    camera.add(this.shovelGroup);
    camera.add(this.swordGroup);
    camera.add(this.handGroup);
    camera.add(this.blockGroup);
  }

  setSwinging(active: boolean) {
    this.isSwinging = active;
  }

  update(time: number, delta: number) {
    if (!this.axeGroup || !this.pickaxeGroup || !this.shovelGroup || !this.swordGroup || !this.handGroup || !this.blockGroup) {
      return;
    }

    const selected = this.inventoryService.selectedItem();
    const itemType = selected.item;
    const hasItem = !!itemType && selected.count > 0;
    
    // Check if item is a tool
    const toolType = this.getToolType(itemType);
    const isBlock = hasItem && !toolType && itemType !== 'stick' && itemType !== 'coal'; // Assume everything else is block for now
    const shouldShowHand = !hasItem || (hasItem && !toolType && !isBlock);

    // TOOL (axe, pickaxe, shovel, sword)
    if (toolType) {
      // Hide all tool groups first
      this.axeGroup.visible = false;
      this.pickaxeGroup.visible = false;
      this.shovelGroup.visible = false;
      this.swordGroup.visible = false;
      this.blockGroup.visible = false;
      this.handGroup.visible = false; // Hand is part of tool model implicitly or hidden

      // Show appropriate tool group
      const toolGroup = this.getToolGroup(toolType);
      if (toolGroup) {
        toolGroup.visible = true;
        this.currentToolGroup = toolGroup;

        // Update tool materials based on item type
        this.updateToolMaterials(toolGroup, itemType!);

        // Animate tool swing
        if (this.isSwinging) {
          const swingSpeed = toolType === 'sword' ? 18 : 15; // Sword swings faster
          const swingAmount = toolType === 'sword' ? 1.5 : 1.2;
          toolGroup.rotation.x = Math.sin((time / 1000) * swingSpeed) * swingAmount;
          toolGroup.rotation.z = Math.PI / 8 + Math.sin((time / 1000) * swingSpeed) * 0.5;
          toolGroup.position.y = -0.5 + Math.sin((time / 1000) * swingSpeed) * 0.2;
        } else {
          toolGroup.rotation.x = THREE.MathUtils.lerp(toolGroup.rotation.x, 0, 10 * delta);
          toolGroup.rotation.z = Math.PI / 8;
          toolGroup.position.y = -0.5;
        }
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
       this.pickaxeGroup.visible = false;
       this.shovelGroup.visible = false;
       this.swordGroup.visible = false;
       this.handGroup.visible = false;
       this.blockGroup.visible = false;
       this.currentToolGroup = null;
    }
  }

  private getToolType(itemType: string | null): 'axe' | 'pickaxe' | 'shovel' | 'sword' | null {
    if (!itemType) return null;
    
    if (itemType === 'axe' || itemType === 'wooden_axe' || itemType === 'stone_axe') {
      return 'axe';
    }
    if (itemType === 'wooden_pickaxe' || itemType === 'stone_pickaxe') {
      return 'pickaxe';
    }
    if (itemType === 'wooden_shovel' || itemType === 'stone_shovel') {
      return 'shovel';
    }
    if (itemType === 'wooden_sword' || itemType === 'stone_sword') {
      return 'sword';
    }
    return null;
  }

  private getToolGroup(toolType: 'axe' | 'pickaxe' | 'shovel' | 'sword'): THREE.Group | null {
    switch (toolType) {
      case 'axe': return this.axeGroup;
      case 'pickaxe': return this.pickaxeGroup;
      case 'shovel': return this.shovelGroup;
      case 'sword': return this.swordGroup;
      default: return null;
    }
  }

  private updateToolMaterials(toolGroup: THREE.Group, itemType: string) {
    // Determine material colors based on tool tier
    const isWooden = itemType.includes('wooden');
    const handleColor = 0x8d6e63; // Always wood handle (brown)
    const headColor = isWooden ? 0x8d6e63 : 0x757575; // Wood (brown) or stone (gray) head
    
    // Special colors for sword blade edge
    const bladeEdgeColor = 0xeeeeee; // Light gray for sharp edges
    
    toolGroup.children.forEach((child, index) => {
      if (child instanceof THREE.Mesh) {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshLambertMaterial;
        
        // First child is usually handle
        if (index === 0) {
          material.color.setHex(handleColor);
        } 
        // Last child is often blade edge (for sword) or tool edge
        else if (itemType.includes('sword') && index === toolGroup.children.length - 1) {
          material.color.setHex(bladeEdgeColor);
        }
        // Other parts are head/blade
        else {
          material.color.setHex(headColor);
        }
      }
    });
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

  private createPickaxeModel(): THREE.Group {
    const group = new THREE.Group();
    const handleGeo = new THREE.BoxGeometry(0.06, 0.6, 0.06);
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x8d6e63 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = 0;
    group.add(handle);

    // Pickaxe head (two crossed picks)
    const pick1Geo = new THREE.BoxGeometry(0.15, 0.08, 0.08);
    const pick1Mat = new THREE.MeshLambertMaterial({ color: 0x757575 });
    const pick1 = new THREE.Mesh(pick1Geo, pick1Mat);
    pick1.position.set(0.06, 0.25, 0);
    pick1.rotation.z = Math.PI / 6;
    group.add(pick1);

    const pick2Geo = new THREE.BoxGeometry(0.15, 0.08, 0.08);
    const pick2Mat = new THREE.MeshLambertMaterial({ color: 0x757575 });
    const pick2 = new THREE.Mesh(pick2Geo, pick2Mat);
    pick2.position.set(0.06, 0.25, 0);
    pick2.rotation.z = -Math.PI / 6;
    group.add(pick2);

    group.position.set(0.5, -0.5, -0.8);
    group.rotation.set(0, -Math.PI / 4, Math.PI / 8);
    group.visible = false;
    return group;
  }

  private createShovelModel(): THREE.Group {
    const group = new THREE.Group();
    const handleGeo = new THREE.BoxGeometry(0.06, 0.6, 0.06);
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x8d6e63 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = 0;
    group.add(handle);

    // Shovel blade
    const bladeGeo = new THREE.BoxGeometry(0.12, 0.18, 0.06);
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0x757575 });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0.04, 0.28, 0);
    blade.rotation.x = -Math.PI / 12;
    group.add(blade);

    group.position.set(0.5, -0.5, -0.8);
    group.rotation.set(0, -Math.PI / 4, Math.PI / 8);
    group.visible = false;
    return group;
  }

  private createSwordModel(): THREE.Group {
    const group = new THREE.Group();
    const handleGeo = new THREE.BoxGeometry(0.06, 0.4, 0.06);
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x8d6e63 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = -0.1;
    group.add(handle);

    // Sword guard
    const guardGeo = new THREE.BoxGeometry(0.15, 0.05, 0.05);
    const guardMat = new THREE.MeshLambertMaterial({ color: 0x757575 });
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.set(0, 0.1, 0);
    group.add(guard);

    // Sword blade
    const bladeGeo = new THREE.BoxGeometry(0.04, 0.35, 0.04);
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0, 0.35, 0);
    group.add(blade);

    // Blade tip
    const tipGeo = new THREE.BoxGeometry(0.02, 0.08, 0.02);
    const tipMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(0, 0.57, 0);
    group.add(tip);

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
