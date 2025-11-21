import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SceneManagerService } from '../core/scene-manager.service';

@Injectable({
  providedIn: 'root',
})
export class CrackOverlayService {
  private crackMaterials: THREE.MeshBasicMaterial[] = [];
  private crackOverlayMesh: THREE.Mesh | null = null;
  private currentCrackStage = -1;
  private crackBlockKey: string | null = null;
  private textureLoader = new THREE.TextureLoader();

  constructor(private sceneManager: SceneManagerService) {}

  initialize() {
    const texturePaths = [
      'assets/textures/destroy_stage_0.png',
      'assets/textures/destroy_stage_1.png',
      'assets/textures/destroy_stage_2.png',
      'assets/textures/destroy_stage_3.png',
      'assets/textures/destroy_stage_4.png',
      'assets/textures/destroy_stage_5.png',
      'assets/textures/destroy_stage_6.png',
      'assets/textures/destroy_stage_7.png',
      'assets/textures/destroy_stage_8.png',
      'assets/textures/destroy_stage_9.png',
    ];

    this.crackMaterials = texturePaths.map((path) => {
      const texture = this.textureLoader.load(path);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;

      return new THREE.MeshBasicMaterial({
        map: texture,
        color: 0x404040,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
      });
    });

    const overlayGeometry = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    this.crackOverlayMesh = new THREE.Mesh(overlayGeometry, this.crackMaterials[0]);
    this.crackOverlayMesh.visible = false;
    this.crackOverlayMesh.renderOrder = 5;
    this.sceneManager.getScene().add(this.crackOverlayMesh);
  }

  show(key: string, position: THREE.Vector3, progressRatio: number) {
    if (!this.crackOverlayMesh || this.crackMaterials.length === 0) {
      return;
    }

    this.crackBlockKey = key;
    
    // Map 0..1 to 0..9 (10 stages)
    const totalStages = this.crackMaterials.length;
    let stageIndex = Math.floor(progressRatio * totalStages);
    
    // Clamp to valid range [0, totalStages - 1]
    if (stageIndex < 0) stageIndex = 0;
    if (stageIndex >= totalStages) stageIndex = totalStages - 1;

    if (stageIndex !== this.currentCrackStage) {
      this.crackOverlayMesh.material = this.crackMaterials[stageIndex];
      this.currentCrackStage = stageIndex;
    }

    this.crackOverlayMesh.visible = true;
    this.crackOverlayMesh.position.copy(position);
  }

  hide() {
    this.currentCrackStage = -1;
    this.crackBlockKey = null;
    if (this.crackOverlayMesh) {
      this.crackOverlayMesh.visible = false;
    }
  }

  getActiveBlockKey(): string | null {
    return this.crackBlockKey;
  }
}
