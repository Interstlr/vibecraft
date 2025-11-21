import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { MaterialService } from '../world/resources/material.service';
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
    const blockDef = BLOCKS[type];
    
    // Special handling for tools - render 2D procedural icons
    if (blockDef?.isTool) {
      return this.generateToolIcon(type, blockDef);
    }
    
    // Special handling for stick - render as thin stick shape
    if (type === 'stick') {
      return this.generateStickIcon(blockDef);
    }
    
    // For blocks, use 3D rendering
    const material = this.materialService.getMaterial(type);
    
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
    
    // 6. Cache
    this.iconCache.set(type, dataUrl);
    
    return dataUrl;
  }

  private generateStickIcon(blockDef?: any): string {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    // Clear
    ctx.clearRect(0, 0, 64, 64);
    
    // Draw stick (thin brown rectangle at angle)
    ctx.save();
    ctx.translate(32, 32);
    ctx.rotate(Math.PI / 6); // 30 degrees
    
    const stickColor = blockDef?.procedural?.color1 || '#8D6E63';
    ctx.fillStyle = stickColor;
    ctx.fillRect(-24, -2, 48, 4);
    
    // Add shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(-24, 1, 48, 2);
    
    ctx.restore();
    
    const dataUrl = canvas.toDataURL();
    this.iconCache.set('stick', dataUrl);
    return dataUrl;
  }

  private generateToolIcon(type: string, blockDef: any): string {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    // Clear
    ctx.clearRect(0, 0, 64, 64);
    
    const toolColor = blockDef.procedural?.color1 || '#8D6E63';
    const isWooden = type.includes('wooden');
    const handleColor = '#8D6E63'; // Wood handle
    
    // Draw tool based on type
    if (type.includes('axe')) {
      this.drawAxeIcon(ctx, handleColor, toolColor, isWooden);
    } else if (type.includes('pickaxe')) {
      this.drawPickaxeIcon(ctx, handleColor, toolColor, isWooden);
    } else if (type.includes('shovel')) {
      this.drawShovelIcon(ctx, handleColor, toolColor, isWooden);
    } else if (type.includes('sword')) {
      this.drawSwordIcon(ctx, handleColor, toolColor, isWooden);
    } else {
      // Generic tool icon (colored rectangle)
      ctx.fillStyle = toolColor;
      ctx.fillRect(16, 16, 32, 32);
    }
    
    const dataUrl = canvas.toDataURL();
    this.iconCache.set(type, dataUrl);
    return dataUrl;
  }

  private drawAxeIcon(ctx: CanvasRenderingContext2D, handleColor: string, headColor: string, isWooden: boolean) {
    ctx.save();
    ctx.translate(32, 32);
    ctx.rotate(-Math.PI / 4);
    
    // Handle
    ctx.fillStyle = handleColor;
    ctx.fillRect(-2, -20, 4, 40);
    
    // Axe head
    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.moveTo(2, -15);
    ctx.lineTo(15, -8);
    ctx.lineTo(15, 8);
    ctx.lineTo(2, 15);
    ctx.closePath();
    ctx.fill();
    
    // Edge highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();
  }

  private drawPickaxeIcon(ctx: CanvasRenderingContext2D, handleColor: string, headColor: string, isWooden: boolean) {
    ctx.save();
    ctx.translate(32, 32);
    ctx.rotate(-Math.PI / 4);
    
    // Handle
    ctx.fillStyle = handleColor;
    ctx.fillRect(-2, -20, 4, 40);
    
    // Pickaxe head (crossed picks)
    ctx.fillStyle = headColor;
    
    // First pick
    ctx.save();
    ctx.translate(5, -12);
    ctx.rotate(Math.PI / 6);
    ctx.fillRect(-2, -8, 4, 16);
    ctx.restore();
    
    // Second pick
    ctx.save();
    ctx.translate(5, -12);
    ctx.rotate(-Math.PI / 6);
    ctx.fillRect(-2, -8, 4, 16);
    ctx.restore();
    
    ctx.restore();
  }

  private drawShovelIcon(ctx: CanvasRenderingContext2D, handleColor: string, headColor: string, isWooden: boolean) {
    ctx.save();
    ctx.translate(32, 32);
    ctx.rotate(-Math.PI / 4);
    
    // Handle
    ctx.fillStyle = handleColor;
    ctx.fillRect(-2, -20, 4, 40);
    
    // Shovel blade
    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.moveTo(2, -10);
    ctx.lineTo(12, -2);
    ctx.lineTo(8, 8);
    ctx.lineTo(2, 8);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }

  private drawSwordIcon(ctx: CanvasRenderingContext2D, handleColor: string, bladeColor: string, isWooden: boolean) {
    ctx.save();
    ctx.translate(32, 32);
    ctx.rotate(-Math.PI / 4);
    
    // Handle
    ctx.fillStyle = handleColor;
    ctx.fillRect(-3, 15, 6, 12);
    
    // Guard
    ctx.fillStyle = bladeColor;
    ctx.fillRect(-8, 10, 16, 4);
    
    // Blade
    ctx.fillStyle = '#EEEEEE';
    ctx.fillRect(-1.5, -20, 3, 28);
    
    // Blade tip
    ctx.fillStyle = '#EEEEEE';
    ctx.beginPath();
    ctx.moveTo(-1.5, -20);
    ctx.lineTo(0, -26);
    ctx.lineTo(1.5, -20);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }
}

