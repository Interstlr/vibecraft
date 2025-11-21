import { Injectable } from '@angular/core';
import { SceneManagerService } from './scene-manager.service';
import { InputManagerService } from './input-manager.service';
import { PlayerControllerService } from '../player/player-controller.service';
import { PlayerRaycasterService } from '../player/player-raycaster.service';
import { PlayerInteractionService } from '../player/player-interaction.service';
import { ToolRendererService } from '../rendering/tool-renderer.service';
import { GrassSystemService } from '../systems/grass-system.service';
import { LeavesSystemService } from '../systems/leaves-system.service';
import { SkyRendererService } from '../rendering/sky-renderer.service';
import { GameStateService } from '../../services/game-state.service';
import { ItemDropSystemService } from '../systems/item-drop-system.service';
import { ItemDropRendererService } from '../rendering/item-drop-renderer.service';
import { InventoryStackService } from '../inventory/inventory-stack.service';
import { InventoryInitService } from '../inventory/inventory-init.service';
import { ChickenSystemService } from '../systems/chicken-system.service';
import { ChickenRendererService } from '../rendering/chicken-renderer.service';
import { ChunkManagerService } from '../world/management/chunk-manager.service';
import { InstancedRendererService } from '../rendering/instanced-renderer.service';

@Injectable({
  providedIn: 'root',
})
export class GameLoopService {
  private animationId = 0;
  private running = false;
  private prevTime = performance.now();
  private chunkUpdateTimer = 0;

  constructor(
    private sceneManager: SceneManagerService,
    private input: InputManagerService,
    private playerController: PlayerControllerService,
    private playerRaycaster: PlayerRaycasterService,
    private playerInteraction: PlayerInteractionService,
    private toolRenderer: ToolRendererService,
    private grassSystem: GrassSystemService,
    private leavesSystem: LeavesSystemService,
    private skyRenderer: SkyRendererService,
    private store: GameStateService,
    private itemDropSystem: ItemDropSystemService,
    private itemDropRenderer: ItemDropRendererService,
    private inventoryStackService: InventoryStackService,
    // Inject init service to ensure it runs
    private inventoryInit: InventoryInitService,
    private chickenSystem: ChickenSystemService,
    private chickenRenderer: ChickenRendererService,
    private chunkManager: ChunkManagerService,
    private instancedRenderer: InstancedRendererService
  ) {}

  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    this.prevTime = performance.now();

    // Initialize item drop renderer
    this.itemDropRenderer.initialize();

    this.animate();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.animationId);
  }

  private animate = () => {
    if (!this.running) {
      return;
    }

    this.animationId = requestAnimationFrame(this.animate);
    const time = performance.now();
    // Clamp delta to max 0.1s to prevent physics tunneling during lag spikes
    const delta = Math.min((time - this.prevTime) / 1000, 0.1);
    this.prevTime = time;

    // Chunk update throttle (every 0.5s)
    this.chunkUpdateTimer += delta;
    if (this.chunkUpdateTimer >= 0.5) {
      this.chunkUpdateTimer = 0;
      this.chunkManager.update(this.playerController.position);
    }

    if (Math.random() > 0.95 && delta > 0) {
      this.store.fps.set(Math.round(1 / delta));
    }

    // Update item drops logic and rendering
    const pickedUpIds = this.itemDropSystem.update(delta, this.playerController.position);
    pickedUpIds.forEach((id) => {
      const drop = this.itemDropSystem.getDropById(id);
      if (drop) {
        this.inventoryStackService.addItem(drop.type, drop.count);
        this.itemDropRenderer.removeDrop(id);
        this.itemDropSystem.removeDrop(id);
      }
    });
    this.itemDropRenderer.update(this.itemDropSystem.getDrops(), this.playerController.position, time / 1000);

    this.chickenSystem.update(delta);
    this.chickenRenderer.update(this.chickenSystem.getChickens(), delta);

    if (this.input.isLocked()) {
      this.playerController.update(delta);
      this.playerRaycaster.update();
      this.playerInteraction.update(delta);
      this.toolRenderer.update(time, delta);
    } else {
      this.playerRaycaster.reset();
    }

    this.grassSystem.update(delta);
    this.leavesSystem.update(delta);
    this.skyRenderer.update();
    this.instancedRenderer.syncCounts();
    this.sceneManager.render();
  };
}
