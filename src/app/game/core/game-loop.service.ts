import { Injectable } from '@angular/core';
import { SceneManagerService } from './scene-manager.service';
import { InputManagerService } from './input-manager.service';
import { PlayerControllerService } from '../player/player-controller.service';
import { PlayerRaycasterService } from '../player/player-raycaster.service';
import { PlayerInteractionService } from '../player/player-interaction.service';
import { ToolRendererService } from '../rendering/tool-renderer.service';
import { GrassSystemService } from '../systems/grass-system.service';
import { SkyRendererService } from '../rendering/sky-renderer.service';
import { GameStateService } from '../../services/game-state.service';
import { ItemDropSystemService } from '../systems/item-drop-system.service';
import { ItemDropRendererService } from '../rendering/item-drop-renderer.service';
import { InventoryStackService } from '../inventory/inventory-stack.service';
import { InventoryInitService } from '../inventory/inventory-init.service';

@Injectable({
  providedIn: 'root',
})
export class GameLoopService {
  private animationId = 0;
  private running = false;
  private prevTime = performance.now();

  constructor(
    private sceneManager: SceneManagerService,
    private input: InputManagerService,
    private playerController: PlayerControllerService,
    private playerRaycaster: PlayerRaycasterService,
    private playerInteraction: PlayerInteractionService,
    private toolRenderer: ToolRendererService,
    private grassSystem: GrassSystemService,
    private skyRenderer: SkyRendererService,
    private store: GameStateService,
    private itemDropSystem: ItemDropSystemService,
    private itemDropRenderer: ItemDropRendererService,
    private inventoryStackService: InventoryStackService,
    // Inject init service to ensure it runs
    private inventoryInit: InventoryInitService
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
    const delta = (time - this.prevTime) / 1000;
    this.prevTime = time;

    if (Math.random() > 0.95 && delta > 0) {
      this.store.fps.set(Math.round(1 / delta));
    }

    // Update item drops logic and rendering
    const pickedUpIds = this.itemDropSystem.update(delta, this.playerController.position);
    pickedUpIds.forEach((id) => {
      const drop = this.itemDropSystem.getDropById(id);
      if (drop) {
        this.inventoryStackService.addItem(drop.type, 1);
        this.itemDropRenderer.removeDrop(id);
        this.itemDropSystem.removeDrop(id);
      }
    });
    this.itemDropRenderer.update(this.itemDropSystem.getDrops(), this.playerController.position, time / 1000);

    if (this.input.isLocked()) {
      this.playerController.update(delta);
      this.playerRaycaster.update();
      this.playerInteraction.update(delta);
      this.toolRenderer.update(time, delta);
    } else {
      this.playerRaycaster.reset();
    }

    this.grassSystem.update(delta);
    this.skyRenderer.update();
    this.sceneManager.render();
  };
}
