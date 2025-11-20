import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SceneManagerService } from '../core/scene-manager.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable({
  providedIn: 'root',
})
export class ToolRendererService {
  private axeGroup!: THREE.Group;
  private handGroup!: THREE.Group;
  private isSwinging = false;

  constructor(
    private sceneManager: SceneManagerService,
    private inventoryService: InventoryService,
  ) {}

  initialize() {
    const camera = this.sceneManager.getCamera();
    this.axeGroup = this.createAxeModel();
    this.handGroup = this.createHandModel();
    camera.add(this.axeGroup);
    camera.add(this.handGroup);
  }

  setSwinging(active: boolean) {
    this.isSwinging = active;
  }

  update(time: number, delta: number) {
    if (!this.axeGroup || !this.handGroup) {
      return;
    }

    const selected = this.inventoryService.selectedItem();
    const hasItem = !!selected.item && selected.count > 0;
    const isAxe = selected.item === 'axe';
    const shouldShowHand = !isAxe && !hasItem;

    if (isAxe) {
      this.axeGroup.visible = true;
      if (this.isSwinging) {
        const swingSpeed = 8;
        this.axeGroup.rotation.x = Math.sin((time / 1000) * swingSpeed) * 0.8;
        this.axeGroup.rotation.z = Math.PI / 8 + Math.sin((time / 1000) * swingSpeed) * 0.2;
        this.axeGroup.position.y = -0.5 + Math.sin((time / 1000) * swingSpeed) * 0.1;
      } else {
        this.axeGroup.rotation.x = THREE.MathUtils.lerp(this.axeGroup.rotation.x, 0, 10 * delta);
        this.axeGroup.rotation.z = Math.PI / 8;
        this.axeGroup.position.y = -0.5;
      }
    } else {
      this.axeGroup.visible = false;
    }

    if (shouldShowHand) {
      this.handGroup.visible = true;
      const swingSpeed = 9;
      const baseRotX = -0.4;
      const baseRotZ = Math.PI / 10;
      const basePosY = -0.65;
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
      this.handGroup.visible = false;
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
}

