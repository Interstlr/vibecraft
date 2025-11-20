import { Injectable } from '@angular/core';
import { BlockPlacerService } from '../world/block-placer.service';
import { GameStateService } from '../../services/game-state.service';
import { PlayerRaycasterService } from './player-raycaster.service';
import { CrackOverlayService } from '../rendering/crack-overlay.service';
import { ToolRendererService } from '../rendering/tool-renderer.service';
import { SceneManagerService } from '../core/scene-manager.service';
import { PLAYER_CONFIG } from '../../config/player.config';
import { InputManagerService } from '../core/input-manager.service';
import { ItemDropSystemService } from '../systems/item-drop-system.service';
import { BLOCKS } from '../../config/blocks.config';
import * as THREE from 'three';

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

  constructor(
    private blockPlacer: BlockPlacerService,
    private store: GameStateService,
    private raycaster: PlayerRaycasterService,
    private crackOverlay: CrackOverlayService,
    private toolRenderer: ToolRendererService,
    private sceneManager: SceneManagerService,
    private input: InputManagerService,
    private itemDropSystem: ItemDropSystemService,
  ) {}

  handlePrimaryActionDown() {
    this.isMining = true;
    this.miningTimer = 0;
    this.toolRenderer.setSwinging(true);

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
    const hitPos = this.raycaster.getHitBlockPosition();
    if (!hitPos) {
      return;
    }

    const block = this.blockPlacer.getBlock(hitPos.x, hitPos.y, hitPos.z);
    if (block?.type === 'workbench') {
      this.store.openWorkbenchMenu();
      this.input.unlockPointer();
      return;
    }

    const type = this.store.selectedBlockName();
    if (type === 'axe') {
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

    if (type === 'workbench') {
      if (this.store.hasWorkbench() > 0 && this.blockPlacer.addBlock(tx, ty, tz, 'workbench')) {
        this.store.removeFromInventory('workbench', 1);
        if (this.store.hasWorkbench() === 0) {
          this.store.selectedSlot.set(1);
        }
      }
      return;
    }

    if (this.store.hasItem(type) && this.blockPlacer.addBlock(tx, ty, tz, type)) {
      this.store.removeFromInventory(type, 1);
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
    const slot = this.store.selectedSlot();
    if (slot === 9 && this.store.hasAxe() > 0 && (block.type === 'wood' || block.type === 'workbench')) {
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
