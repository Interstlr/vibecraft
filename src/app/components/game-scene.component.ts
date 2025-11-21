import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { WorldBuilder } from '../game/world/generation/tree-generator.service';
import { WorldGeneratorService } from '../game/world/generation/world-generator.service';
import { ChunkManagerService } from '../game/world/management/chunk-manager.service';
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
import { MultiplayerService } from '../game/networking/multiplayer.service';
import { RemotePlayerRendererService } from '../game/rendering/remote-player-renderer.service';
import { environment } from '../../environments/environment';
import { take } from 'rxjs/operators';

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
  private chunkManager = inject(ChunkManagerService);
  private gameLoop = inject(GameLoopService);
  private skyRenderer = inject(SkyRendererService);
  private playerController = inject(PlayerControllerService);
  private chickenRenderer = inject(ChickenRendererService);
  private chickenSystem = inject(ChickenSystemService);
  private multiplayer = inject(MultiplayerService);
  private remotePlayerRenderer = inject(RemotePlayerRendererService);

  ngAfterViewInit() {
    const container = this.rendererContainer.nativeElement;
    this.sceneManager.initialize(container);
    this.instancedRenderer.initialize();
    this.highlightRenderer.initialize();
    this.crackOverlay.initialize();
    this.toolRenderer.initialize();
    
    // Initialize multiplayer before world gen so we can receive initial state
    this.multiplayer.initialize();
    this.remotePlayerRenderer.initialize();
    
    this.blockPlacer.initialize();
    this.skyRenderer.initialize();
    this.chickenRenderer.initialize();

    this.inputManager.initialize({
      onPrimaryDown: () => this.playerInteraction.handlePrimaryActionDown(),
      onPrimaryUp: () => this.playerInteraction.handlePrimaryActionUp(),
      onSecondaryDown: () => this.playerInteraction.handleSecondaryAction(),
    });

    this.initializeWorld();
  }

  ngOnDestroy() {
    this.gameLoop.stop();
    this.inputManager.dispose();
    this.sceneManager.dispose();
  }

  lockControls() {
    this.inputManager.lockPointer();
  }

  private initializeWorld() {
    const handleWorldInit = (seed: number) => {
        this.chunkManager.setSeed(seed);
        
        // Force initial load around 0,0 (load all chunks immediately)
        this.chunkManager.update(new THREE.Vector3(0, 0, 0), true);
        this.instancedRenderer.syncCounts();
        
        // Spawn logic
        const spawnY = this.worldGenerator.getSurfaceHeight(0, 0, seed) + 2;
        this.sceneManager.getCamera().position.set(0, spawnY, 0);
        this.playerController.setSpawn(new THREE.Vector3(0, spawnY, 0));
        
        if (environment.multiplayer) {
             this.playerController.forceSendUpdate();
        }

        // Start game loop only after world is ready
        this.gameLoop.start();
        this.chickenSystem.spawnChicken(new THREE.Vector3(1, spawnY + 5, -3));
    };

    if (environment.multiplayer) {
        // Wait for seed from server
        this.multiplayer.worldSeed$.pipe(take(1)).subscribe(handleWorldInit);
    } else {
        // Generate random seed locally
        const seed = Math.random() * 10000;
        handleWorldInit(seed);
    }
  }
}
