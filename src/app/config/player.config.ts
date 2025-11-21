
export const PLAYER_CONFIG = {
  // Movement Physics
  moveSpeed: 55.0,      // Acceleration force
  sprintSpeedMultiplier: 1.7, // Speed multiplier when sprinting
  jumpForce: 14.0,       // Initial upward velocity (increased to match gravity)
  gravity: 65.0,         // Downward acceleration (Doubled to remove moon-gravity feel)
  drag: 10.0,            // Air/Ground resistance (deceleration)
  
  // Interaction
  reachDistance: 5.0,    // Max distance to mine/place blocks
  eyeHeight: 1.5,        // Camera height from feet
  collisionRadius: 0.3,  // Player bounding box radius
};
