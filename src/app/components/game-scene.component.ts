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
import { GameStateService } from '../services/game-state.service';
import { WorldStorageService } from '../game/world/world-storage.service';
import { ItemDropSystemService } from '../game/systems/item-drop-system.service';
import { InventoryInitService } from '../game/inventory/inventory-init.service';
import { InventoryService } from '../game/inventory/inventory.service';

@Component({
  selector: 'app-game-scene',
  standalone: true,
  imports: [CommonModule],
  template: '<div #rendererContainer class="absolute top-0 left-0 w-full h-full" (click)="lockControls()"></div>',
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
  private gameState = inject(GameStateService);
  private worldStorage = inject(WorldStorageService);
  private itemDropSystem = inject(ItemDropSystemService);
  private inventoryInit = inject(InventoryInitService);
  private inventoryService = inject(InventoryService);

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
      onDropItem: () => this.playerInteraction.handleDropItem(),
    });

    // Apply fog settings from ChunkManager
    this.sceneManager.updateFog(this.chunkManager.getRenderDistanceBlocks());

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
    const handleWorldInit = async (seed: number) => {
        this.chunkManager.setSeed(seed);
        this.chunkManager.reset();
        
        // Load chunks with progress bar
        await this.chunkManager.generateInitialChunks(
            this.gameState.isResuming() ? new THREE.Vector3(
                 this.gameState.playerPosition().x, 
                 this.gameState.playerPosition().y, 
                 this.gameState.playerPosition().z
            ) : new THREE.Vector3(0, 0, 0), 
            (progress) => {
                 this.gameState.setLoadingProgress(progress);
        });

        // Wait for the center chunk to be actually loaded and processed from worker
        // We check for bedrock at 0,0,0 which is always generated
        while (!this.chunkManager.hasBlock(0, 0, 0)) {
             await new Promise(resolve => setTimeout(resolve, 50));
        }

        this.instancedRenderer.syncCounts();
        
        // Spawn logic
        let spawnY = 0;
        
        if (this.gameState.isResuming()) {
          const meta = await this.worldStorage.loadMetadata();
          if (meta) {
            // Restore player state
            const pos = meta.playerPos;
            this.playerController.setPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
            
            // Restore inventory
            this.gameState.grassCount.set(meta.inventory.grass);
            this.gameState.dirtCount.set(meta.inventory.dirt);
            this.gameState.stoneCount.set(meta.inventory.stone);
            this.gameState.woodCount.set(meta.inventory.wood);
            this.gameState.leavesCount.set(meta.inventory.leaves);
            this.gameState.hasWorkbench.set(meta.inventory.workbench);
            this.gameState.hasAxe.set(meta.inventory.axe);
            
            // Restore actual inventory slots
            if (meta.inventory.slots) {
                this.inventoryService.setSlots(meta.inventory.slots);
            }

            // Restore dropped items
            if (meta.droppedItems) {
              meta.droppedItems.forEach(drop => {
                this.itemDropSystem.spawnDrop(
                  drop.type, 
                  new THREE.Vector3(drop.position.x, drop.position.y, drop.position.z),
                  drop.count,
                  new THREE.Vector3(drop.velocity.x, drop.velocity.y, drop.velocity.z)
                );
              });
            }

            spawnY = pos.y;
          }
        } else {
          // Find the highest block at 0,0 to spawn on top of it
          let surfaceY = 150;
          while (surfaceY > 0 && !this.chunkManager.hasBlock(0, surfaceY, 0)) {
               surfaceY--;
          }
          spawnY = surfaceY + 2;
          
          this.sceneManager.getCamera().position.set(0, spawnY, 0);
          this.playerController.setSpawn(new THREE.Vector3(0, spawnY, 0));
          
          // Initialize clean inventory for new game
          this.inventoryInit.initializeNewGameInventory();
        }
        
        if (environment.multiplayer) {
             this.playerController.forceSendUpdate();
        }

        // Start game loop only after world is ready
        this.gameLoop.start();
        
        // Only spawn chicken if not resuming, or maybe spawn it anyway? 
        // For now let's just spawn it, we don't save entities yet.
        this.chickenSystem.spawnChicken(new THREE.Vector3(1, spawnY + 5, -3));

        // Hide loading screen only after everything is ready
        // Wait a tiny bit to ensure the first frame is rendered
        setTimeout(() => {
             this.gameState.hideLoadingScreen();
        }, 100);
    };

    if (this.gameState.isResuming()) {
      // Resume from saved game
      this.worldStorage.loadMetadata().then(meta => {
        if (meta) {
          // Restore GameState player position early for chunk generation
          this.gameState.playerPosition.set(meta.playerPos);
          handleWorldInit(meta.seed);
        } else {
          // Fallback if meta not found
          console.error('Could not load saved game metadata');
          handleWorldInit(Math.random() * 10000);
        }
      });
    } else if (environment.multiplayer) {
        // Wait for seed from server
        this.multiplayer.worldSeed$.pipe(take(1)).subscribe(handleWorldInit);
    } else {
        // Generate random seed locally
        const seed = Math.random() * 10000;
        handleWorldInit(seed);
    }
  }
}
