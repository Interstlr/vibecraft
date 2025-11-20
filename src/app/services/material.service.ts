
import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable({
  providedIn: 'root'
})
export class MaterialService {
  
  // Allow single material or array of materials (for different faces)
  private materials: Record<string, THREE.Material | THREE.Material[]> = {};
  private textureLoader = new THREE.TextureLoader();

  constructor() {
    this.initMaterials();
  }

  getMaterial(type: string): THREE.Material | THREE.Material[] {
    return this.materials[type] || this.materials['grass'];
  }

  getAllMaterials() {
    return this.materials;
  }

  private initMaterials() {
    // --- Textures ---
    const grassTopTex = this.createProceduralTexture('#5fa848', '#4a8538', 'noise');
    const dirtTex = this.createProceduralTexture('#795548', '#5d4037', 'noise');
    
    // Load external texture for grass side (using your file)
    const grassSideTex = this.textureLoader.load('assets/textures/grass-side.webp', 
      undefined, 
      undefined, 
      (err) => console.error('Error loading grass-side.webp:', err)
    );
    grassSideTex.magFilter = THREE.NearestFilter; // Keep pixelated look
    grassSideTex.colorSpace = THREE.SRGBColorSpace;
    
    const stoneTex = this.createProceduralTexture('#9e9e9e', '#757575');
    const woodTex = this.createProceduralTexture('#8D6E63', '#6D4C41', 'wood_side');
    const leavesTex = this.createProceduralTexture('#2E7D32', '#1B5E20');
    const workbenchTex = this.createProceduralTexture('#D2691E', '#A0522D', 'workbench');

    // --- Base Materials ---
    const matGrassTop = new THREE.MeshLambertMaterial({ map: grassTopTex });
    const matDirt = new THREE.MeshLambertMaterial({ map: dirtTex });
    const matGrassSide = new THREE.MeshLambertMaterial({ map: grassSideTex });

    this.materials = {
      // Grass Block: Right, Left, Top, Bottom, Front, Back
      // Uses array to apply different textures to faces
      grass: [
        matGrassSide, // Right
        matGrassSide, // Left
        matGrassTop,  // Top
        matDirt,      // Bottom
        matGrassSide, // Front
        matGrassSide  // Back
      ],
      
      dirt: matDirt,
      stone: new THREE.MeshLambertMaterial({ map: stoneTex }),
      wood: new THREE.MeshLambertMaterial({ map: woodTex }),
      leaves: new THREE.MeshLambertMaterial({ map: leavesTex, transparent: false }),
      workbench: new THREE.MeshLambertMaterial({ map: workbenchTex }),
      axe: new THREE.MeshLambertMaterial({ color: 0xFF0000 }),
      hover: new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
    };
  }

  private createProceduralTexture(color1: string, color2: string, type: 'noise' | 'wood_side' | 'workbench' = 'noise'): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    // Fill background with primary color
    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, 64, 64);
    
    if (type === 'noise') {
      ctx.fillStyle = color2;
      for(let i=0; i<40; i++) {
        const x = Math.floor(Math.random() * 8) * 8;
        const y = Math.floor(Math.random() * 8) * 8;
        ctx.fillRect(x, y, 8, 8);
      }
    } else if (type === 'wood_side') {
      ctx.fillStyle = color2;
      for(let i=0; i<8; i++) {
        ctx.fillRect(8 + i*4, 0, 2, 64);
      }
    } else if (type === 'workbench') {
      ctx.fillStyle = color2;
      ctx.fillRect(0,0,64,64);
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(30, 0, 4, 64);
      ctx.fillRect(0, 30, 64, 4);
    }
    
    // Border
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0,0,64,64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
