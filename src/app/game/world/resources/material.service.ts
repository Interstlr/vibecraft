import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { BLOCKS, BlockDefinition, BlockFaceDefinition, ProceduralConfig } from '../../config/blocks.config';
import { ITEMS_CONFIG } from '../../config/items.config';

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
    // If material exists, return it
    if (this.materials[type]) {
      return this.materials[type];
    }
    
    // For items that might not be in BLOCKS, try to create material on the fly
    // This handles items like 'stick' that might be added later
    const blockDef = BLOCKS[type];
    if (blockDef) {
      // Material will be created in initMaterials, but if called before init, create it here
      return this.materials[type] || this.createFallbackMaterial(type);
    }
    
    // Fallback to grass material (will show grass texture/color if item not found)
    return this.materials['grass'] || this.createFallbackMaterial('grass');
  }

  private createFallbackMaterial(type: string): THREE.Material {
    // Create a simple fallback material
    return new THREE.MeshLambertMaterial({ color: 0x888888 });
  }

  getAllMaterials() {
    return this.materials;
  }

  private initMaterials() {
    // 1. Initialize Blocks
    Object.entries(BLOCKS).forEach(([key, def]) => {
        // Handle tools/special items
        if (def.isTool) {
            if (key === 'hover') {
                this.materials[key] = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
            } else {
                 // Check for texture first
                 if (def.texture) {
                     this.materials[key] = this.createMaterial(
                         { texture: def.texture, procedural: def.procedural, tint: def.tint },
                         def.transparent ?? true, // Default to transparent for tools
                         def.opacity
                     );
                 } else {
                     // Create material for tools (even if not flat procedural)
                     // Use procedural color if available, else fallback to a color based on name
                     const colorStr = def.procedural?.color1 || this.generateColorFromName(key);
                     const colorHex = this.parseColor(colorStr);
                     this.materials[key] = new THREE.MeshLambertMaterial({ color: colorHex });
                 }
            }
            return;
        }
        
        // Handle items with procedural config (like stick) that are not tools
        if (def.procedural && !def.texture && !def.faces) {
            const colorHex = this.parseColor(def.procedural.color1);
            this.materials[key] = new THREE.MeshLambertMaterial({ color: colorHex });
            return;
        }

        const faces = ['right', 'left', 'top', 'bottom', 'front', 'back'] as const;
        
        const getFaceConfig = (face: string): BlockFaceDefinition => {
            // 1. Check specific face override
            const faceDef = def.faces?.[face as keyof typeof def.faces];
            if (faceDef) return faceDef;
            
            // 2. Check 'side' alias for side faces
            if (['right', 'left', 'front', 'back'].includes(face)) {
                if (def.faces?.side) return def.faces.side;
            }
            
            // 3. Fallback to block default
            return { texture: def.texture, procedural: def.procedural, tint: def.tint };
        };

        // Create materials for all 6 faces
        const materials = faces.map(face => {
             const faceConfig = getFaceConfig(face);
             return this.createMaterial(faceConfig, def.transparent, def.opacity);
        });

        // If no specific faces were defined, we can treat this as a single-material block
        // This is an optimization and matches original behavior for dirt/stone/etc.
        if (!def.faces) {
             this.materials[key] = materials[0];
        } else {
             this.materials[key] = materials;
        }
    });

    // 2. Initialize Items (from ITEMS_CONFIG that are not in BLOCKS)
    Object.keys(ITEMS_CONFIG).forEach(key => {
        if (this.materials[key]) return; // Already handled via BLOCKS

        // Create a simple material for items
        const colorStr = this.generateColorFromName(key);
        const colorHex = this.parseColor(colorStr);
        this.materials[key] = new THREE.MeshLambertMaterial({ color: colorHex });
    });
  }
  
  private generateColorFromName(name: string): string {
      // Specific overrides for common items not in BLOCKS
      if (name.includes('diamond')) return '#00FFFF';
      if (name.includes('gold')) return '#FFD700';
      if (name.includes('iron')) return '#C0C0C0';
      if (name.includes('stone')) return '#7d7d7d';
      if (name.includes('wood')) return '#8B4513';
      
      // Hash fallback
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
          hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
      return '#' + "00000".substring(0, 6 - c.length) + c;
  }

  private createMaterial(config: BlockFaceDefinition, transparent: boolean = false, opacity?: number): THREE.Material {
      let texture: THREE.Texture;
      let color = 0xffffff;

      if (config.tint) {
          color = this.parseColor(config.tint);
      }

      if (config.texture) {
          texture = this.textureLoader.load(config.texture);
          texture.magFilter = THREE.NearestFilter;
          texture.minFilter = THREE.NearestMipmapNearestFilter;
          texture.colorSpace = THREE.SRGBColorSpace;
      } else if (config.procedural) {
          texture = this.createProceduralTexture(
              config.procedural.color1, 
              config.procedural.color2 || config.procedural.color1, 
              config.procedural.type
          );
      } else {
          // Fallback texture if nothing is specified
          texture = this.createProceduralTexture('#FF00FF', '#000000');
      }

      const effectiveOpacity = opacity ?? 1;
      const isCutout = transparent && effectiveOpacity >= 1;
      const isTrueTransparent = transparent && effectiveOpacity < 1;

      return new THREE.MeshLambertMaterial({ 
          map: texture, 
          color: color,
          transparent: isTrueTransparent,
          opacity: effectiveOpacity,
          alphaTest: isCutout ? 0.5 : 0,
          depthWrite: !isTrueTransparent,
          side: isTrueTransparent ? THREE.DoubleSide : THREE.FrontSide
      });
  }

  private createProceduralTexture(color1: string, color2: string, type: 'noise' | 'wood_side' | 'workbench' | 'color' | 'flat' = 'noise'): THREE.Texture {
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

  private parseColor(colorString: string): number {
    // Parse color string like '#8D6E63' to hex number
    if (colorString.startsWith('#')) {
      return parseInt(colorString.slice(1), 16);
    }
    // Fallback to gray
    return 0x888888;
  }
}
