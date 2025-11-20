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
    this.scene.fog = new THREE.Fog(
      WORLD_CONFIG.backgroundColor,
      WORLD_CONFIG.fogNear,
      WORLD_CONFIG.fogFar,
    );

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

