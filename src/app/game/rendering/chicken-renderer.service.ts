import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SceneManagerService } from '../core/scene-manager.service';
import { ChickenEntity } from '../mobs/entities/chicken.entity';

@Injectable({
  providedIn: 'root',
})
export class ChickenRendererService {
  private chickens = new Map<string, THREE.Group>();
  
  // Materials
  private whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  private yellowMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
  private redMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  private legMat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
  private eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });

  // Geometry Constants (1 unit = 1 block = 16 pixels)
  private readonly PIXEL = 1 / 16;
  
  // Reusable Geometries
  private bodyGeo = new THREE.BoxGeometry(6 * this.PIXEL, 6 * this.PIXEL, 8 * this.PIXEL);
  private headGeo = new THREE.BoxGeometry(4 * this.PIXEL, 6 * this.PIXEL, 3 * this.PIXEL);
  private beakGeo = new THREE.BoxGeometry(2 * this.PIXEL, 2 * this.PIXEL, 2 * this.PIXEL);
  private wattleGeo = new THREE.BoxGeometry(1 * this.PIXEL, 2 * this.PIXEL, 1 * this.PIXEL);
  private legGeo = new THREE.BoxGeometry(2 * this.PIXEL, 5 * this.PIXEL, 2 * this.PIXEL);
  private wingGeo = new THREE.BoxGeometry(1 * this.PIXEL, 4 * this.PIXEL, 6 * this.PIXEL);
  private eyeGeo = new THREE.BoxGeometry(1 * this.PIXEL, 1 * this.PIXEL, 1 * this.PIXEL);

  constructor(private sceneManager: SceneManagerService) {}

  initialize() {
    this.chickens.forEach(mesh => {
      this.sceneManager.getScene().remove(mesh);
    });
    this.chickens.clear();
  }

  addChicken(chicken: ChickenEntity) {
    if (this.chickens.has(chicken.id)) return;

    const group = this.createChickenModel();
    group.position.copy(chicken.position);
    group.rotation.copy(chicken.rotation);
    
    this.sceneManager.getScene().add(group);
    this.chickens.set(chicken.id, group);
  }

  removeChicken(id: string) {
    const mesh = this.chickens.get(id);
    if (mesh) {
      this.sceneManager.getScene().remove(mesh);
      this.chickens.delete(id);
    }
  }

  update(chickens: ChickenEntity[], delta: number) {
    // Sync positions and run simple animations
    for (const chicken of chickens) {
      let group = this.chickens.get(chicken.id);
      if (!group) {
        this.addChicken(chicken);
        group = this.chickens.get(chicken.id)!;
      }

      // Interpolate position for smoothness if needed, but for now direct copy
      group.position.copy(chicken.position);
      group.rotation.copy(chicken.rotation);

      // Simple animation based on walkTime
      this.animateChicken(group, chicken);
    }
  }

  private createChickenModel(): THREE.Group {
    const group = new THREE.Group();
    const model = new THREE.Group();
    // Sink model slightly (2 pixels) to prevent "floating" visual due to shadow bias/exact geometry
    model.position.y = -2 * this.PIXEL;
    group.add(model);

    const p = this.PIXEL;

    // Body Group
    const bodyGroup = new THREE.Group();
    bodyGroup.name = 'body';
    bodyGroup.position.y = 8 * p;
    
    const bodyMesh = new THREE.Mesh(this.bodyGeo, this.whiteMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    bodyGroup.add(bodyMesh);
    model.add(bodyGroup);

    // Head Group
    const headGroup = new THREE.Group();
    headGroup.name = 'head';
    headGroup.position.set(0, 13 * p, 2 * p);

    const headMesh = new THREE.Mesh(this.headGeo, this.whiteMat);
    headMesh.position.y = 2 * p;
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // Beak
    const beakMesh = new THREE.Mesh(this.beakGeo, this.yellowMat);
    beakMesh.position.set(0, 2 * p, 2.5 * p);
    headGroup.add(beakMesh);

    // Wattle
    const wattleMesh = new THREE.Mesh(this.wattleGeo, this.redMat);
    wattleMesh.position.set(0, 0.5 * p, 1.5 * p);
    headGroup.add(wattleMesh);

    // Eyes
    const leftEye = new THREE.Mesh(this.eyeGeo, this.eyeMat);
    leftEye.position.set(2 * p, 4 * p, 0.5 * p); // Side of head, up a bit, slightly forward
    headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(this.eyeGeo, this.eyeMat);
    rightEye.position.set(-2 * p, 4 * p, 0.5 * p);
    headGroup.add(rightEye);

    model.add(headGroup);

    // Right Leg
    const rightLeg = new THREE.Group();
    rightLeg.name = 'rightLeg';
    rightLeg.position.set(-2 * p, 5 * p, 1 * p);
    const rightLegMesh = new THREE.Mesh(this.legGeo, this.legMat);
    rightLegMesh.position.y = -2.5 * p;
    rightLegMesh.castShadow = true;
    rightLeg.add(rightLegMesh);
    model.add(rightLeg);

    // Left Leg
    const leftLeg = new THREE.Group();
    leftLeg.name = 'leftLeg';
    leftLeg.position.set(2 * p, 5 * p, 1 * p);
    const leftLegMesh = new THREE.Mesh(this.legGeo, this.legMat);
    leftLegMesh.position.y = -2.5 * p;
    leftLegMesh.castShadow = true;
    leftLeg.add(leftLegMesh);
    model.add(leftLeg);

    // Right Wing
    const rightWing = new THREE.Group();
    rightWing.name = 'rightWing';
    rightWing.position.set(-3.5 * p, 11 * p, 0);
    const rightWingMesh = new THREE.Mesh(this.wingGeo, this.whiteMat);
    rightWingMesh.position.y = -2 * p;
    rightWingMesh.castShadow = true;
    rightWing.add(rightWingMesh);
    model.add(rightWing);

    // Left Wing
    const leftWing = new THREE.Group();
    leftWing.name = 'leftWing';
    leftWing.position.set(3.5 * p, 11 * p, 0);
    const leftWingMesh = new THREE.Mesh(this.wingGeo, this.whiteMat);
    leftWingMesh.position.y = -2 * p;
    leftWingMesh.castShadow = true;
    leftWing.add(leftWingMesh);
    model.add(leftWing);

    return group;
  }

  private animateChicken(group: THREE.Group, chicken: ChickenEntity) {
    // Basic walking animation
    const speed = 10; // Walk speed multiplier for animation
    const limbSwing = Math.sin(chicken.walkTime * speed) * 0.5;
    const limbSwing2 = Math.cos(chicken.walkTime * speed) * 0.5;

    // Legs
    const rightLeg = group.getObjectByName('rightLeg');
    const leftLeg = group.getObjectByName('leftLeg');
    
    if (rightLeg && leftLeg) {
      rightLeg.rotation.x = limbSwing;
      leftLeg.rotation.x = -limbSwing;
    }

    // Wings (flap occasionally)
    const rightWing = group.getObjectByName('rightWing');
    const leftWing = group.getObjectByName('leftWing');

    const flap = Math.abs(Math.sin(chicken.wingFlap));
    if (rightWing && leftWing) {
      rightWing.rotation.z = flap * 0.5;
      leftWing.rotation.z = -flap * 0.5;
    }

    // Head bob
    const head = group.getObjectByName('head');
    if (head) {
      head.rotation.x = Math.sin(chicken.walkTime * speed * 2) * 0.1;
      head.rotation.y = chicken.headYaw;
    }
  }
}

