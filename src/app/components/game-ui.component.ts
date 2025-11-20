import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../services/game-state.service';
import { InventoryService } from '../game/inventory/inventory.service';
import { InventoryUiComponent } from './inventory-ui.component';
import { BLOCKS } from '../config/blocks.config';
import { GAME_CONFIG } from '../config/game.config';

@Component({
  selector: 'app-game-ui',
  standalone: true,
  imports: [CommonModule, InventoryUiComponent],
  template: `
    <!-- Crosshair -->
    <div class="absolute top-1/2 left-1/2 w-5 h-5 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 opacity-80">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
        <path d="M10 0v20M0 10h20" stroke="white" stroke-width="2"/>
      </svg>
    </div>

    <!-- Top Left Stats -->
    <div class="absolute top-5 left-5 text-white bg-black/50 p-4 rounded-lg pointer-events-none select-none">
      <h2 class="m-0 mt-0 font-bold">Voxel Survival</h2>
      <p>FPS: {{ store.fps() }}</p>
      <p>Blocks: {{ store.blockCount() }}</p>
    </div>

    <!-- Version Display -->
    <div class="absolute bottom-1 left-1 text-white/40 text-xs font-mono pointer-events-none select-none z-50">
      {{ config.version }}
    </div>

    <!-- Hotbar -->
    <div class="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 bg-black/30 p-2 rounded-lg">
      <ng-container *ngFor="let i of [0,1,2,3,4,5,6,7,8]">
        <div class="w-12 h-12 border-[3px] rounded relative flex items-center justify-center text-white text-[10px] font-bold shadow-sm transition-transform cursor-pointer"
             [class.border-white]="inventoryService.selectedHotbarIndex() === i" 
             [class.scale-110]="inventoryService.selectedHotbarIndex() === i"
             [class.border-white/30]="inventoryService.selectedHotbarIndex() !== i"
             [style.opacity]="inventoryService.getSlot(i).item ? 1 : 0.3"
             [style.background-color]="getSlotColor(inventoryService.getSlot(i).item)"
             [style.background-image]="getSlotImage(inventoryService.getSlot(i).item) ? 'url(' + getSlotImage(inventoryService.getSlot(i).item) + ')' : null"
             style="background-size: cover; image-rendering: pixelated;"
             (click)="inventoryService.selectHotbarSlot(i)">
          <span class="absolute top-0 left-1 text-[8px] opacity-80">{{ i + 1 }}</span>
          <span class="absolute bottom-0 right-1 text-xs drop-shadow-md" *ngIf="inventoryService.getSlot(i).count > 1">
            {{ inventoryService.getSlot(i).count }}
          </span>
        </div>
      </ng-container>
    </div>

    <!-- Inventory Menu -->
    @if (store.activeMenu() === 'inventory') {
      <app-inventory-ui></app-inventory-ui>
    }

    <!-- Instructions Overlay -->
    @if (store.showInstructions()) {
      <div class="fixed top-0 left-0 w-full h-full bg-black/70 flex flex-col justify-center items-center text-white z-20 cursor-pointer backdrop-blur-sm"
           (click)="requestLock.emit()">
        <h1 class="text-4xl font-bold mb-4 animate-pulse">CLICK TO PLAY</h1>
        <div class="text-center space-y-2 text-lg font-mono bg-black/50 p-6 rounded-xl border border-white/20">
          <p>WASD - Move | SPACE - Jump</p>
          <p>LMB (Hold) - Mine | RMB - Build/Interact</p>
          <p>E - Inventory</p>
          <p>1-9 - Select Slot</p>
        </div>
      </div>
    }
  `
})
export class GameUiComponent {
  store = inject(GameStateService);
  inventoryService = inject(InventoryService);
  requestLock = output<void>();
  readonly config = GAME_CONFIG;

  getSlotColor(item: string | null): string {
    if (!item) return 'transparent';
    const def = BLOCKS[item];
    if (def?.procedural?.color1) return def.procedural.color1;
    return 'transparent';
  }
  
  getSlotImage(item: string | null): string {
      if (!item) return '';
      const def = BLOCKS[item];
      if (def?.faces?.side?.texture) return def.faces.side.texture;
      if (def?.faces?.top?.texture) return def.faces.top.texture;
      if (item === 'workbench') return 'assets/textures/oak-side.png';
      return '';
  }

  handleClose() {
    this.store.closeMenus();
    this.requestLock.emit();
  }
}
