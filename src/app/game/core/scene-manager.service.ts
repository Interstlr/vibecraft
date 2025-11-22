import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { WORLD_CONFIG } from '../../config/world.config';

@Injectable({
  providedIn: 'root',
})
export class SceneManagerService {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private resizeHandler = () => this.handleResize();

  initialize(container: HTMLElement) {
    this.dispose();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(WORLD_CONFIG.backgroundColor);

    // Use FogExp2 for more natural, distance-based fog that doesn't rotate with camera
    // Density approx calculation: 1 / distance
    // For render distance 100, we want fog to be thick at 100.
    // 0.015 density means ~95% fog at 100-150 blocks
    this.scene.fog = new THREE.FogExp2(WORLD_CONFIG.backgroundColor, 0.012);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 10, 0);
    this.scene.add(this.camera);

    this.addLights();

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', this.resizeHandler);
  }

  updateFog(renderDistanceBlocks: number) {
    if (this.scene) {
        // Calculate density based on render distance
        // Formula: density = 3.0 / renderDistance (approx) makes it thick at the edge
        // Reduced factor to 1.5 to push fog further away
        const density = 1.5 / renderDistanceBlocks; 
        this.scene.fog = new THREE.FogExp2(
            WORLD_CONFIG.backgroundColor,
            density
        );
    }
  }


  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    window.removeEventListener('resize', this.resizeHandler);
    if (this.renderer) {
      const canvas = this.renderer.domElement;
      if (canvas?.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }
      this.renderer.dispose();
    }
  }

  private addLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(50, 100, 50);
    this.scene.add(dirLight);
  }

  private handleResize() {
    if (!this.camera || !this.renderer) {
      return;
    }
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
