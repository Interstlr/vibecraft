import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { MaterialService } from '../../services/material.service';
import { BLOCKS } from '../../config/blocks.config';

@Injectable({
  providedIn: 'root'
})
export class BlockIconService {
  private iconCache = new Map<string, string>();
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private geometry: THREE.BoxGeometry;

  constructor(private materialService: MaterialService) {
    this.scene = new THREE.Scene();
    
    // Isometric setup:
    // Rotate X by ~30 deg (35.264) and Y by 45 deg
    const aspect = 1;
    const frustumSize = 2;
    this.camera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2, 
      frustumSize * aspect / 2, 
      frustumSize / 2, 
      frustumSize / -2, 
      0.1, 
      100
    );
    
    // Standard Minecraft item position
    // Look from corner
    this.camera.position.set(1, 1, 1); 
    this.camera.lookAt(0, 0, 0);
    
    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({ 
        alpha: true, 
        antialias: true,
        preserveDrawingBuffer: true 
    });
    this.renderer.setSize(64, 64);
    this.renderer.setClearColor(0x000000, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 7);
    this.scene.add(dirLight);
    
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
  }

  getIcon(type: string): string {
    if (!type) return '';
    if (this.iconCache.has(type)) {
      return this.iconCache.get(type)!;
    }

    // Generate icon
    return this.generateIcon(type);
  }

  private generateIcon(type: string): string {
    // Get material
    const material = this.materialService.getMaterial(type);
    
    // Special case for tools/flat items if we want different geometry
    // But currently tools are just blocks or we don't have mesh for them in this service
    // Just render box for everything for now, unless it is transparent/sprite
    
    // 1. Create mesh
    const mesh = new THREE.Mesh(this.geometry, material);
    
    // 2. Add to scene
    this.scene.add(mesh);
    
    // 3. Render
    this.renderer.render(this.scene, this.camera);
    
    // 4. Get data URL
    const dataUrl = this.renderer.domElement.toDataURL();
    
    // 5. Cleanup
    this.scene.remove(mesh);
    // We don't dispose geometry/material as they are shared
    
    // 6. Cache
    this.iconCache.set(type, dataUrl);
    
    return dataUrl;
  }
}

