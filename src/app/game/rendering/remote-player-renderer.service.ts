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
    // Adjust Y so feet (0,0,0) are at position Y
    // Total height ~1.8
    // Center of group is at feet position (data.position)
    // Head center Y: 1.8 - 0.25 = 1.55 (approx)
    // Adjust for eyeHeight if data.position is eye pos?
    // PlayerController sends camera position (eyes).
    // So group position = eye position.
    // We need to move model DOWN so eyes are at 0.
    // Eye height ~1.6
    
    const eyeHeightOffset = -1.6;

    head.position.y = 1.5 + 0.25 + eyeHeightOffset; 
    group.add(head);

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
    group.add(itemGroup);
    
    // Save reference to item group in userData for updates
    group.userData['itemGroup'] = itemGroup;

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
    group.position.set(data.position.x, data.position.y, data.position.z);
    
    // Rotation: Only Yaw (Y axis) usually matters for body
    group.rotation.y = data.rotation.y;
    
    // Head rotation could be separated if we sent it.
    // Simple walk animation could be added based on distance moved.
    
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

