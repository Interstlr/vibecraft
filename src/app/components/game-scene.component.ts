import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { WorldBuilder } from '../services/tree-generator.service';
import { WorldGeneratorService } from '../services/world-generator.service';
import { SceneManagerService } from '../game/core/scene-manager.service';
import { InstancedRendererService } from '../game/rendering/instanced-renderer.service';
import { HighlightRendererService } from '../game/rendering/highlight-renderer.service';
import { CrackOverlayService } from '../game/rendering/crack-overlay.service';
import { ToolRendererService } from '../game/rendering/tool-renderer.service';
import { InputManagerService } from '../game/core/input-manager.service';
import { PlayerInteractionService } from '../game/player/player-interaction.service';
import { BlockPlacerService } from '../game/world/block-placer.service';
import { GameLoopService } from '../game/core/game-loop.service';
import { SkyRendererService } from '../game/rendering/sky-renderer.service';
import { PlayerControllerService } from '../game/player/player-controller.service';
import { ChickenRendererService } from '../game/rendering/chicken-renderer.service';
import { ChickenSystemService } from '../game/systems/chicken-system.service';

@Component({
  selector: 'app-game-scene',
  standalone: true,
  imports: [CommonModule],
  template: '<div #rendererContainer class="absolute top-0 left-0 w-full h-full"></div>',
})
export class GameSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('rendererContainer') rendererContainer!: ElementRef<HTMLDivElement>;

  private sceneManager = inject(SceneManagerService);
  private instancedRenderer = inject(InstancedRendererService);
  private highlightRenderer = inject(HighlightRendererService);
  private crackOverlay = inject(CrackOverlayService);
  private toolRenderer = inject(ToolRendererService);
  private inputManager = inject(InputManagerService);
  private playerInteraction = inject(PlayerInteractionService);
  private blockPlacer = inject(BlockPlacerService);
  private worldGenerator = inject(WorldGeneratorService);
  private gameLoop = inject(GameLoopService);
  private skyRenderer = inject(SkyRendererService);
  private playerController = inject(PlayerControllerService);
  private chickenRenderer = inject(ChickenRendererService);
  private chickenSystem = inject(ChickenSystemService);

  ngAfterViewInit() {
    const container = this.rendererContainer.nativeElement;
    this.sceneManager.initialize(container);
    this.instancedRenderer.initialize();
    this.highlightRenderer.initialize();
    this.crackOverlay.initialize();
    this.toolRenderer.initialize();
    this.blockPlacer.initialize();
    this.skyRenderer.initialize();
    this.chickenRenderer.initialize();
    this.playerController.setSpawn(this.sceneManager.getCamera().position.clone());

    this.inputManager.initialize({
      onPrimaryDown: () => this.playerInteraction.handlePrimaryActionDown(),
      onPrimaryUp: () => this.playerInteraction.handlePrimaryActionUp(),
      onSecondaryDown: () => this.playerInteraction.handleSecondaryAction(),
    });

    this.generateWorld();
    this.gameLoop.start();

    this.chickenSystem.spawnChicken(new THREE.Vector3(1, 10, -3));
  }

  ngOnDestroy() {
    this.gameLoop.stop();
    this.inputManager.dispose();
    this.sceneManager.dispose();
  }

  lockControls() {
    this.inputManager.lockPointer();
  }

  private generateWorld() {
    const builder: WorldBuilder = {
      addBlock: (x, y, z, type) => this.blockPlacer.addBlock(x, y, z, type),
      hasBlock: (x, y, z) => this.blockPlacer.hasBlock(x, y, z),
    };

    this.worldGenerator.generate(builder);
    this.instancedRenderer.syncCounts();
  }
}
