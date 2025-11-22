/// <reference lib="webworker" />

import { WorldGeneratorService } from '../world/generation/world-generator.service';
import { TreeGeneratorService } from '../world/generation/tree-generator.service';
import { BLOCKS } from '../config/blocks.config';

const treeGenerator = new TreeGeneratorService();
const worldGenerator = new WorldGeneratorService(treeGenerator);

// Helper to check transparency without importing full config if simpler
const isTransparent = (type: string) => {
  return (BLOCKS as any)[type]?.transparent || false;
};

const getCullSame = (type: string) => {
  return (BLOCKS as any)[type]?.cullSame || false;
};

addEventListener('message', ({ data }) => {
  const { chunkX, chunkZ, seed } = data;
  
  // Use a Map for sparse storage during generation, or a 3D array if dense?
  // Since we generate full columns, a 3D array is memory heavy (16x256x16 = 65k entries).
  // But efficient for lookups. 
  // Let's use a flat array with coordinate packing for local checks.
  // Index = x + z*16 + y*256
  // We only track blocks within the chunk height limit (e.g. 0 to 128 or 256)
  
  // Temporary storage for the chunk generation
  // We'll use a map for flexibility since height is variable
  const localBlockMap = new Map<string, string>();
  const minMaxY = { min: 256, max: 0 };

  const worldBuilder = {
    addBlock: (x: number, y: number, z: number, type: string) => {
        // x, z are world coords. Convert to chunk local for optimization checks
        const lx = ((x % 16) + 16) % 16;
        const lz = ((z % 16) + 16) % 16;
        const key = `${lx},${y},${lz}`;
        
        localBlockMap.set(key, type);
        
        if (y < minMaxY.min) minMaxY.min = y;
        if (y > minMaxY.max) minMaxY.max = y;
    },
    hasBlock: (x: number, y: number, z: number) => {
        const lx = ((x % 16) + 16) % 16;
        const lz = ((z % 16) + 16) % 16;
        const key = `${lx},${y},${lz}`;
        return localBlockMap.has(key);
    }
  };

  worldGenerator.generateChunk(chunkX, chunkZ, worldBuilder, seed);

  // Post-processing: Culling
  // Separate blocks into 'exposed' (need visibility check/render) and 'hidden' (just data)
  
  const exposedBlocks: {x: number, y: number, z: number, type: string}[] = [];
  const hiddenBlocks: {x: number, y: number, z: number, type: string}[] = [];
  
  // Directions for neighbor check
  const dirs = [
    [1,0,0], [-1,0,0],
    [0,1,0], [0,-1,0],
    [0,0,1], [0,0,-1]
  ];

  const chunkOffsetX = chunkX * 16;
  const chunkOffsetZ = chunkZ * 16;

  for (const [key, type] of localBlockMap.entries()) {
      const [lx, y, lz] = key.split(',').map(Number);
      const x = lx + chunkOffsetX;
      const z = lz + chunkOffsetZ;

      let isExposed = false;

      // 1. Check Chunk Borders
      // If block is on the edge of the chunk, it MIGHT be exposed to the next chunk.
      // We can't know for sure without querying global state (which we don't have).
      // So we must treat it as "potentially exposed".
      if (lx === 0 || lx === 15 || lz === 0 || lz === 15) {
          isExposed = true;
      } else {
          // 2. Check Internal Neighbors
          // If any neighbor is missing (Air) or Transparent, this block is exposed.
          for (const [dx, dy, dz] of dirs) {
              const nKey = `${lx + dx},${y + dy},${lz + dz}`;
              const neighborType = localBlockMap.get(nKey);
              
              if (!neighborType) {
                  // Neighbor is air (locally)
                  isExposed = true;
                  break;
              } else if (isTransparent(neighborType)) {
                  // Neighbor is transparent (water, glass, leaves)
                  
                  // Optimization: If neighbor is same type and cullSame is true, 
                  // then we are NOT exposed on this side (merged volume)
                  if (neighborType === type && getCullSame(type)) {
                      continue;
                  }

                  isExposed = true;
                  break;
              }
          }
      }

      if (isExposed) {
          exposedBlocks.push({x, y, z, type});
      } else {
          hiddenBlocks.push({x, y, z, type});
      }
  }

  postMessage({ chunkX, chunkZ, exposedBlocks, hiddenBlocks });
});
