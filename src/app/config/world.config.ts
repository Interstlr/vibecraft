
export const WORLD_CONFIG = {
  // Generation
  size: 120,             // World width/depth (blocks)
  blockSize: 1,          // Size of a voxel
  treeDensity: 0.03,     // Probability of a tree per chunk (0.0 - 1.0) - Baseline, modified by biomes
  hillFrequency: 0.1,    // Probability of a block being raised (0.0 - 1.0) - Legacy, used for noise scaling
  spawnSafeRadius: 12,
  rivers: {
    count: 2,
    width: 2
  },
  
  // Visuals
  fogNear: 20,
  fogFar: 100,
  backgroundColor: 0x87CEEB
};
