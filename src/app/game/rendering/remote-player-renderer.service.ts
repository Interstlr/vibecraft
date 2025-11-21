import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SceneManagerService } from '../core/scene-manager.service';
import { MultiplayerService, PlayerData } from '../networking/multiplayer.service';
import { MaterialService } from '../../services/material.service';

@Injectable({
  providedIn: 'root',
})
export class RemotePlayerRendererService {
  private remotePlayers = new Map<string, THREE.Group>();
  private material: THREE.MeshLambertMaterial;

  constructor(
    private sceneManager: SceneManagerService,
    private multiplayer: MultiplayerService,
    private materialService: MaterialService
  ) {
    this.material = new THREE.MeshLambertMaterial({ color: 0x00aa00 }); // Green steve? Or default color
  }

  initialize() {
    // Listen to events
    this.multiplayer.playerJoined$.subscribe(player => this.addPlayer(player));
    this.multiplayer.playerLeft$.subscribe(id => this.removePlayer(id));
    this.multiplayer.playerMoved$.subscribe(player => this.updatePlayer(player));
    
    // Add existing players if any (from init)
    // This logic might run after init depending on race conditions, 
    // usually better to call this from a higher level component or check stored state
    // For now we can just check init data from service if available
    Object.values(this.multiplayer.initialPlayers || {}).forEach(player => {
        if (player.id !== this.multiplayer.getPlayerId()) {
            this.addPlayer(player);
        }
    });
  }

  private addPlayer(data: PlayerData) {
    if (this.remotePlayers.has(data.id)) return;

    const group = new THREE.Group();

    // Simple Minecraft-like character
    // Units: 1 unit = 1 block height ~ 1 meter (actually block is 1m)
    // Player height is ~1.8m
    // Head: 0.5 size (approx 8 pixels)
    
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffccaa });
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0x0000aa });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x000055 });

    // Head
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const head = new THREE.Mesh(headGeo, skinMat);
    const eyeHeightOffset = -1.6;

    head.position.y = 1.5 + 0.25 + eyeHeightOffset; 
    
    // Eyes (White part)
    const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.BoxGeometry(0.05, 0.05, 0.06);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    // Right Eye
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.1, 0, -0.25); // Front is -Z
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.position.set(0.02, 0, 0.01); // Relative to eye
    rightEye.add(rightPupil);
    head.add(rightEye);

    // Left Eye
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1, 0, -0.25);
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(0.02, 0, 0.01);
    leftEye.add(leftPupil);
    head.add(leftEye);

    group.add(head);
    group.userData['head'] = head;

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.75, 0.25);
    const body = new THREE.Mesh(bodyGeo, shirtMat);
    body.position.y = 0.75 + 0.375 + eyeHeightOffset; 
    group.add(body);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.25, 0.75, 0.25);
    const leftArm = new THREE.Mesh(armGeo, skinMat); 
    leftArm.position.set(-0.375, 0.75 + 0.375 + eyeHeightOffset, 0);
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(0.375, 0.75 + 0.375 + eyeHeightOffset, 0);
    group.add(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.25, 0.75, 0.25);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.125, 0.375 + eyeHeightOffset, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.125, 0.375 + eyeHeightOffset, 0);
    group.add(rightLeg);
    
    // Item in hand (right arm)
    const itemGroup = new THREE.Group();
    itemGroup.position.set(0.375, 0.75 + eyeHeightOffset, 0.25); 
    
    // Pivot points for animation
    // We need to rotate around the shoulder/hip joint
    // Currently pivot is center of geometry. 
    // To fix this without complex hierarchy, we can set geometry transform or wrap in group.
    // Easier way: Translate geometry so 0,0,0 is at the top.
    armGeo.translate(0, -0.375, 0); // Center Y was 0, height 0.75. Now top is at 0.
    legGeo.translate(0, -0.375, 0);

    // Reposition meshes to account for new pivot (top of limb)
    // Shoulder height: 0.75 + 0.75 + eyeHeightOffset = 1.5 + eyeHeightOffset (~ -0.1)
    const shoulderY = 0.75 + 0.75 + eyeHeightOffset;
    const hipY = 0.75 + eyeHeightOffset;

    leftArm.position.set(-0.375, shoulderY, 0);
    rightArm.position.set(0.375, shoulderY, 0);
    
    leftLeg.position.set(-0.125, hipY, 0);
    rightLeg.position.set(0.125, hipY, 0);

    // Re-add itemGroup to rightArm so it moves with it?
    // Or just animate itemGroup separately matching right arm.
    // Attaching to rightArm is better but scaling/rotation issues might occur if not careful.
    // Let's just animate itemGroup position/rotation in sync.
    // Actually, if we parent itemGroup to rightArm, it rotates with it.
    // But rightArm is a Mesh, usually fine to add children.
    // Item position relative to arm pivot (shoulder)
    // Arm hangs down 0.75. Hand is at bottom.
    itemGroup.position.set(0, -0.75, 0.25); 
    rightArm.add(itemGroup);
    
    // Save reference to limbs
    group.userData['leftArm'] = leftArm;
    group.userData['rightArm'] = rightArm;
    group.userData['leftLeg'] = leftLeg;
    group.userData['rightLeg'] = rightLeg;
    group.userData['itemGroup'] = itemGroup;

    // Animation state
    group.userData['walkTime'] = 0;
    group.userData['lastPos'] = new THREE.Vector3(data.position.x, data.position.y, data.position.z);

    // Initial pos
    group.position.set(data.position.x, data.position.y, data.position.z);
    
    this.sceneManager.getScene().add(group);
    this.remotePlayers.set(data.id, group);
  }

  private removePlayer(id: string) {
    const group = this.remotePlayers.get(id);
    if (group) {
      this.sceneManager.getScene().remove(group);
      this.remotePlayers.delete(id);
    }
  }

  private updatePlayer(data: PlayerData) {
    const group = this.remotePlayers.get(data.id);
    if (!group) {
        // Maybe missed join event? Add it.
        this.addPlayer(data);
        return;
    }

    // Smooth interpolation could be added here, but for now direct set
    const lastPos = group.userData['lastPos'] as THREE.Vector3;
    const currentPos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
    
    const distance = lastPos.distanceTo(currentPos);
    const isMoving = distance > 0.01; // Threshold

    group.position.copy(currentPos);
    lastPos.copy(currentPos);

    // Rotation: Only Yaw (Y axis) usually matters for body
    group.rotation.y = data.rotation.y;
    
    // Head rotation (Pitch - looking up/down)
    const head = group.userData['head'] as THREE.Mesh;
    if (head) {
        head.rotation.x = data.rotation.x;
    }

    // Animation
    const leftArm = group.userData['leftArm'] as THREE.Mesh;
    const rightArm = group.userData['rightArm'] as THREE.Mesh;
    const leftLeg = group.userData['leftLeg'] as THREE.Mesh;
    const rightLeg = group.userData['rightLeg'] as THREE.Mesh;

    if (isMoving) {
        group.userData['walkTime'] += 0.4; // Speed of animation
        const walkTime = group.userData['walkTime'];
        const amplitude = 0.8; // Swing amount

        // Arms swing opposite to legs
        // Left Arm & Right Leg move together
        // Right Arm & Left Leg move together
        
        leftArm.rotation.x = Math.cos(walkTime) * amplitude;
        rightArm.rotation.x = Math.cos(walkTime + Math.PI) * amplitude;
        
        leftLeg.rotation.x = Math.cos(walkTime + Math.PI) * amplitude;
        rightLeg.rotation.x = Math.cos(walkTime) * amplitude;
    } else {
        // Reset to idle
        // Lerp back to 0 for smoothness? For now snap.
        leftArm.rotation.x = 0;
        rightArm.rotation.x = 0;
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        // Reset walk time so it starts consistent
        group.userData['walkTime'] = 0;
    }
    
    // Update item
    const itemGroup = group.userData['itemGroup'] as THREE.Group;
    if (itemGroup) {
        // Check if item changed
        const currentItem = itemGroup.userData['item'];
        if (currentItem !== data.item) {
            itemGroup.clear();
            itemGroup.userData['item'] = data.item;
            
            if (data.item) {
                 // Create simple item mesh
                 // Ideally reuse ToolRenderer logic or BlockIcon logic
                 // For now just a small block
                 const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
                 const mat = this.materialService.getMaterial(data.item);
                 // Handle array material?
                 const mesh = new THREE.Mesh(geo, mat as any); 
                 itemGroup.add(mesh);
            }
        }
    }
  }
}

