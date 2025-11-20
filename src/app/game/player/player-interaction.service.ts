import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { BlockPlacerService } from '../world/block-placer.service';
import { GameStateService } from '../../services/game-state.service';
import { InventoryService } from '../inventory/inventory.service';
import { PlayerRaycasterService } from './player-raycaster.service';
import { CrackOverlayService } from '../rendering/crack-overlay.service';
import { ToolRendererService } from '../rendering/tool-renderer.service';
import { SceneManagerService } from '../core/scene-manager.service';
import { InputManagerService } from '../core/input-manager.service';
import { ItemDropSystemService } from '../systems/item-drop-system.service';
import { ChickenSystemService } from '../systems/chicken-system.service';
import { BLOCKS } from '../../config/blocks.config';
import { PLAYER_CONFIG } from '../../config/player.config';

@Injectable({
  providedIn: 'root',
})
export class PlayerInteractionService {
  private readonly MINING_SPEEDS: Record<string, number> = {
    wood: 2.0,
    leaves: 0.2,
    stone: 3.0,
    dirt: 0.5,
    grass: 0.5,
    workbench: 2.0,
  };

  private isMining = false;
  private miningTimer = 0;
  private raycasterThree = new THREE.Raycaster(); // Dedicated raycaster for mobs

  constructor(
    private blockPlacer: BlockPlacerService,
    private store: GameStateService,
    private inventoryService: InventoryService,
    private raycaster: PlayerRaycasterService,
    private crackOverlay: CrackOverlayService,
    private toolRenderer: ToolRendererService,
    private sceneManager: SceneManagerService,
    private input: InputManagerService,
    private itemDropSystem: ItemDropSystemService,
    private chickenSystem: ChickenSystemService,
  ) {}

  handlePrimaryActionDown() {
    this.isMining = true;
    this.miningTimer = 0;
    this.toolRenderer.setSwinging(true);

    // Check for mob hit first
    if (this.checkMobHit()) {
        // If hit mob, don't mine block
        this.isMining = false; 
        return;
    }

    const hitPos = this.raycaster.getHitBlockPosition();
    if (hitPos) {
      const key = this.getKey(hitPos.x, hitPos.y, hitPos.z);
      this.crackOverlay.show(key, hitPos, 0);
    }
  }

  handlePrimaryActionUp() {
    this.toolRenderer.setSwinging(false);
    this.stopMining();
  }

  handleSecondaryAction() {
    // Simple check for mobs interaction if needed (e.g. feeding), 
    // but for now just blocks
    
    const hitPos = this.raycaster.getHitBlockPosition();
    if (!hitPos) {
      return;
    }

    const block = this.blockPlacer.getBlock(hitPos.x, hitPos.y, hitPos.z);
    if (block?.type === 'workbench') {
      // Temporarily disabled or use new UI
      // this.store.openWorkbenchMenu(); 
      this.store.openInventoryMenu(); // Open inventory instead since we have 2x2
      this.input.unlockPointer();
      return;
    }

    const selected = this.inventoryService.selectedItem();
    const type = selected.item;

    if (!type || type === 'axe') { // Simple check, ideally check isTool
      return;
    }

    const normal = this.raycaster.getHitBlockNormal();
    if (!normal) {
      return;
    }

    const target = hitPos.clone().add(normal);
    const playerPos = this.sceneManager.getCamera().position.clone();
    playerPos.y -= PLAYER_CONFIG.eyeHeight;

    if (target.distanceTo(playerPos) <= 1.2) {
      return;
    }

    const tx = Math.round(target.x);
    const ty = Math.round(target.y);
    const tz = Math.round(target.z);

    // workbench special handling removed as it's just a block now
    if (this.blockPlacer.addBlock(tx, ty, tz, type)) {
        this.inventoryService.removeOneFromSelected();
    }
  }

  update(delta: number) {
    if (!this.isMining) {
      return;
    }

    const hitPos = this.raycaster.getHitBlockPosition();
    if (!hitPos) {
      this.stopMining();
      return;
    }

    const key = this.getKey(hitPos.x, hitPos.y, hitPos.z);
    const block = this.blockPlacer.getBlock(hitPos.x, hitPos.y, hitPos.z);
    if (!block) {
      this.stopMining();
      return;
    }

    const activeKey = this.crackOverlay.getActiveBlockKey();
    if (activeKey && activeKey !== key) {
      this.miningTimer = 0;
    }

    let baseSpeed = this.MINING_SPEEDS[block.type] ?? 1.0;
    const selected = this.inventoryService.selectedItem();
    // Check axe
    if (selected.item === 'axe' && (block.type === 'wood' || block.type === 'workbench')) {
      baseSpeed /= 5.0;
    }

    this.miningTimer += delta;
    const miningRatio = Math.min(1, this.miningTimer / baseSpeed);
    this.crackOverlay.show(key, hitPos, miningRatio);

    if (this.miningTimer >= baseSpeed) {
      if (block.type === 'wood') {
        this.chopTreeColumn(hitPos.x, hitPos.y, hitPos.z);
      } else {
        this.spawnBlockDrop(hitPos.x, hitPos.y, hitPos.z, block.type);
        this.blockPlacer.removeBlock(hitPos.x, hitPos.y, hitPos.z);
      }
      this.stopMining();
    }
  }

  private checkMobHit(): boolean {
      // Very simple mob hit check
      // Ideally this would use the actual scene meshes, but we don't have easy access to them map here 
      // without injecting renderer. 
      // For now, let's do a mathematical ray-sphere intersection against chickens.
      
      const chickens = this.chickenSystem.getChickens();
      const camera = this.sceneManager.getCamera();
      const origin = camera.position.clone();
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      
      // Ray
      const maxDist = 4.0;
      let closestDist = maxDist;
      let hitId: string | null = null;
      
      for (const chicken of chickens) {
          // Approximate chicken as sphere radius 0.4 centered at position + 0.35y
          const center = chicken.position.clone().add(new THREE.Vector3(0, 0.35, 0));
          const radius = 0.4;
          
          // Ray-sphere intersection
          const m = origin.clone().sub(center);
          const b = m.dot(dir);
          const c = m.dot(m) - radius * radius;
          
          // If ray starts outside sphere (c > 0) and points away (b > 0), miss
          if (c > 0 && b > 0) continue;
          
          const discr = b * b - c;
          if (discr < 0) continue;
          
          // Hit
          let t = -b - Math.sqrt(discr);
          if (t < 0) t = -b + Math.sqrt(discr);
          
          if (t > 0 && t < closestDist) {
              closestDist = t;
              hitId = chicken.id;
          }
      }
      
      if (hitId) {
          this.chickenSystem.damageChicken(hitId);
          // Play hit sound?
          // Knockback is handled in panic logic (run away), but instant velocity impulse would be better
          return true;
      }
      
      return false;
  }

  private chopTreeColumn(x: number, y: number, z: number) {
    const ix = Math.round(x);
    const iz = Math.round(z);
    let currentY = Math.round(y);

    while (true) {
      const block = this.blockPlacer.getBlock(ix, currentY, iz);
      if (!block || block.type !== 'wood') {
        break;
      }
      this.spawnBlockDrop(ix, currentY, iz, 'wood');
      this.blockPlacer.removeBlock(ix, currentY, iz);
      currentY++;
    }
  }

  private spawnBlockDrop(x: number, y: number, z: number, type: string) {
    const blockDef = BLOCKS[type];
    const dropItem = blockDef?.drops?.item ?? type;
    const dropCount = blockDef?.drops?.count ?? 1;

    for (let i = 0; i < dropCount; i++) {
      this.itemDropSystem.spawnDrop(dropItem, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
    }
  }

  private stopMining() {
    this.isMining = false;
    this.miningTimer = 0;
    this.crackOverlay.hide();
  }

  private getKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }
}
