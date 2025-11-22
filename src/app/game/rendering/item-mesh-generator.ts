import * as THREE from 'three';

export class ItemMeshGenerator {
  /**
   * Generates an extruded geometry from a texture.
   * Returns a BoxGeometry fallback if texture is not readable.
   */
  static generate(texture: THREE.Texture, thickness: number = 0.0625): THREE.BufferGeometry | null {
    const image = texture.image;
    
    if (!image) {
      return null;
    }

    // Handle HTMLImageElement not loaded
    if (image instanceof HTMLImageElement && !image.complete) {
       // Cannot generate yet
       return null;
    }
    
    // Create a canvas to read pixels
    const width = image.width || 16;
    const height = image.height || 16;
    
    // Limit resolution to avoid heavy processing
    if (width > 64 || height > 64) {
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw image flipped Y because UVs are usually 0..1 from bottom-left, 
    // but canvas is top-left. 
    // However, usually we want to scan from top-left naturally.
    ctx.drawImage(image, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height).data;

    const pixels: boolean[][] = [];
    for (let y = 0; y < height; y++) {
      pixels[y] = [];
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        pixels[y][x] = alpha > 10; // Threshold for solidity
      }
    }

    const geometries: THREE.BufferGeometry[] = [];
    const pixelSize = 1 / Math.max(width, height); // Normalize to roughly 1x1 unit
    
    // We center the mesh.
    const offsetX = -width * pixelSize / 2;
    const offsetY = height * pixelSize / 2; // Y goes down in loop, so start high

    // Helper to push a quad
    // We will build a single geometry manually instead of merging 1000 boxes for performance
    // Actually, creating arrays is faster than merging.
    
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = []; // New: Vertex Colors
    const indices: number[] = [];
    let vertCount = 0;

    const addFace = (
      v1: number[], v2: number[], v3: number[], v4: number[], 
      n: number[], 
      r: number, g: number, b: number, // Color
      darken: number = 1.0
    ) => {
      positions.push(...v1, ...v2, ...v3, ...v4);
      normals.push(...n, ...n, ...n, ...n);
      
      // Apply darkening
      const cr = r * darken / 255;
      const cg = g * darken / 255;
      const cb = b * darken / 255;
      
      colors.push(cr, cg, cb, cr, cg, cb, cr, cg, cb, cr, cg, cb);
      
      // 0, 1, 2,  0, 2, 3
      indices.push(vertCount, vertCount + 1, vertCount + 2);
      indices.push(vertCount, vertCount + 2, vertCount + 3);
      vertCount += 4;
    };

    // Iterate pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!pixels[y][x]) continue;

        // Get color
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Pixel coordinates in world space (Z is thickness)
        const px = offsetX + x * pixelSize;
        const py = offsetY - (y + 1) * pixelSize; 
        const pz = thickness / 2;
        
        const s = pixelSize;
        
        // Vertices for the pixel cube
        // Front (z+)
        const vFrontTL = [px,     py + s,  pz];
        const vFrontTR = [px + s, py + s,  pz];
        const vFrontBR = [px + s, py,      pz];
        const vFrontBL = [px,     py,      pz];
        
        // Back (z-)
        const vBackTL = [px,     py + s, -pz];
        const vBackTR = [px + s, py + s, -pz];
        const vBackBR = [px + s, py,     -pz];
        const vBackBL = [px,     py,     -pz];

        // Normals
        const nFront = [0, 0, 1];
        const nBack  = [0, 0, -1];
        const nTop   = [0, 1, 0];
        const nBot   = [0, -1, 0];
        const nRight = [1, 0, 0];
        const nLeft  = [-1, 0, 0];

        // Side darkening factor
        const sideDarken = 0.7;

        // Front Face
        addFace(vFrontBL, vFrontBR, vFrontTR, vFrontTL, nFront, r, g, b, 1.0);
        
        // Back Face
        addFace(vBackBR, vBackBL, vBackTL, vBackTR, nBack, r, g, b, 1.0);

        // Top Face (check if y-1 is empty)
        if (y === 0 || !pixels[y - 1][x]) {
          addFace(vFrontTL, vFrontTR, vBackTR, vBackTL, nTop, r, g, b, sideDarken);
        }

        // Bottom Face (check if y+1 is empty)
        if (y === height - 1 || !pixels[y + 1][x]) {
          addFace(vFrontBR, vFrontBL, vBackBL, vBackBR, nBot, r, g, b, sideDarken);
        }

        // Left Face (check if x-1 is empty)
        if (x === 0 || !pixels[y][x - 1]) {
          addFace(vFrontBL, vFrontTL, vBackTL, vBackBL, nLeft, r, g, b, sideDarken);
        }

        // Right Face (check if x+1 is empty)
        if (x === width - 1 || !pixels[y][x + 1]) {
          addFace(vFrontTR, vFrontBR, vBackBR, vBackTR, nRight, r, g, b, sideDarken);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    
    // Center geometry
    geometry.computeBoundingSphere();
    
    return geometry;
  }
}

