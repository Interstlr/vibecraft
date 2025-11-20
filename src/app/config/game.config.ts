
export const GAME_CONFIG = {
  player: {
    // Movement Physics
    moveSpeed: 65.0,      // Acceleration force
    jumpForce: 12.0,       // Initial upward velocity
    gravity: 30.0,         // Downward acceleration
    drag: 10.0,           // Air/Ground resistance (deceleration)
    
    // Interaction
    reachDistance: 5.0,    // Max distance to mine/place blocks
    eyeHeight: 1.5,        // Camera height from feet
    collisionRadius: 0.3,  // Player bounding box radius
  },
  world: {
    // Generation
    size: 60,              // World width/depth (blocks)
    blockSize: 1,          // Size of a voxel
    treeDensity: 0.03,     // Probability of a tree per chunk (0.0 - 1.0)
    hillFrequency: 0.1,    // Probability of a block being raised (0.0 - 1.0)
    
    // Visuals
    fogNear: 10,
    fogFar: 60,
    backgroundColor: 0x87CEEB
  }
};
