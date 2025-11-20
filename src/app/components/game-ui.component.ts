import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../services/game-state.service';

@Component({
  selector: 'app-game-ui',
  standalone: true,
  imports: [CommonModule],
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

    <!-- Inventory Display (Simplified for now, main focus on Hotbar) -->
    <div class="absolute top-5 right-5 text-white bg-black/50 p-4 rounded-lg select-none text-right hidden"> <!-- Hidden for now as hotbar shows counts -->
      <h3 class="font-bold border-b border-white/30 mb-2">Resources</h3>
      <p>Wood: {{ store.woodCount() }}</p>
    </div>

    <!-- Hotbar -->
    <div class="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 bg-black/30 p-2 rounded-lg">
      <!-- Slot 1: Grass -->
      <div class="w-12 h-12 border-[3px] rounded relative flex items-center justify-center text-white text-[10px] font-bold shadow-sm transition-transform cursor-pointer"
           [class.border-white]="store.selectedSlot() === 1" 
           [class.scale-110]="store.selectedSlot() === 1"
           [class.border-white/30]="store.selectedSlot() !== 1"
           [style.opacity]="store.grassCount() > 0 ? 1 : 0.3"
           style="background: #5fa848;">
        <span class="absolute top-0 left-1 text-[8px] opacity-80">1</span>
        <span class="absolute bottom-0 right-1 text-xs drop-shadow-md">{{ store.grassCount() }}</span>
      </div>

      <!-- Slot 2: Dirt -->
      <div class="w-12 h-12 border-[3px] rounded relative flex items-center justify-center text-white text-[10px] font-bold shadow-sm transition-transform cursor-pointer"
           [class.border-white]="store.selectedSlot() === 2" 
           [class.scale-110]="store.selectedSlot() === 2"
           [class.border-white/30]="store.selectedSlot() !== 2"
           [style.opacity]="store.dirtCount() > 0 ? 1 : 0.3"
           style="background: #795548;">
        <span class="absolute top-0 left-1 text-[8px] opacity-80">2</span>
        <span class="absolute bottom-0 right-1 text-xs drop-shadow-md">{{ store.dirtCount() }}</span>
      </div>
      
      <!-- Slot 3: Stone -->
      <div class="w-12 h-12 border-[3px] rounded relative flex items-center justify-center text-white text-[10px] font-bold shadow-sm transition-transform cursor-pointer"
           [class.border-white]="store.selectedSlot() === 3" 
           [class.scale-110]="store.selectedSlot() === 3"
           [class.border-white/30]="store.selectedSlot() !== 3"
           [style.opacity]="store.stoneCount() > 0 ? 1 : 0.3"
           style="background: #757575;">
        <span class="absolute top-0 left-1 text-[8px] opacity-80">3</span>
        <span class="absolute bottom-0 right-1 text-xs drop-shadow-md">{{ store.stoneCount() }}</span>
      </div>

      <!-- Slot 4: Wood -->
      <div class="w-12 h-12 border-[3px] rounded relative flex items-center justify-center text-white text-[10px] font-bold shadow-sm transition-transform cursor-pointer"
           [class.border-white]="store.selectedSlot() === 4" 
           [class.scale-110]="store.selectedSlot() === 4"
           [class.border-white/30]="store.selectedSlot() !== 4"
           [style.opacity]="store.woodCount() > 0 ? 1 : 0.3"
           style="background: #8D6E63;">
        <span class="absolute top-0 left-1 text-[8px] opacity-80">4</span>
        <span class="absolute bottom-0 right-1 text-xs drop-shadow-md">{{ store.woodCount() }}</span>
      </div>

      <!-- Slot 5: Leaves -->
      <div class="w-12 h-12 border-[3px] rounded relative flex items-center justify-center text-white text-[10px] font-bold shadow-sm transition-transform cursor-pointer"
           [class.border-white]="store.selectedSlot() === 5" 
           [class.scale-110]="store.selectedSlot() === 5"
           [class.border-white/30]="store.selectedSlot() !== 5"
           [style.opacity]="store.leavesCount() > 0 ? 1 : 0.3"
           style="background: #2d5a27;">
        <span class="absolute top-0 left-1 text-[8px] opacity-80">5</span>
        <span class="absolute bottom-0 right-1 text-xs drop-shadow-md">{{ store.leavesCount() }}</span>
      </div>
      
      <!-- Slot 8: Workbench (Conditional) -->
      @if (store.hasWorkbench() > 0) {
        <div class="w-12 h-12 border-[3px] rounded relative flex items-center justify-center text-black text-[10px] font-bold shadow-sm transition-transform cursor-pointer"
             [class.border-white]="store.selectedSlot() === 8" 
             [class.scale-110]="store.selectedSlot() === 8"
             [class.border-white/30]="store.selectedSlot() !== 8"
             style="background: #DAA520;">
          <span class="absolute top-0 left-1 text-[8px] opacity-80 text-white">8</span>
          <span class="absolute bottom-0 right-1 text-xs drop-shadow-md text-white">{{ store.hasWorkbench() }}</span>
        </div>
      }

      <!-- Slot 9: Axe (Conditional) -->
      @if (store.hasAxe() > 0) {
        <div class="w-12 h-12 border-[3px] rounded relative flex items-center justify-center text-white text-[10px] font-bold shadow-sm transition-transform cursor-pointer"
             [class.border-white]="store.selectedSlot() === 9" 
             [class.scale-110]="store.selectedSlot() === 9"
             [class.border-white/30]="store.selectedSlot() !== 9"
             style="background: red;">
          <span class="absolute top-0 left-1 text-[8px] opacity-80">9</span>
          <span class="absolute bottom-0 right-1 text-xs drop-shadow-md">1</span>
        </div>
      }
    </div>

    <!-- Basic Crafting Menu (Press E) -->
    @if (store.activeMenu() === 'crafting') {
      <div class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/90 border-2 border-[#8D6E63] p-5 w-[300px] text-white text-center rounded-xl z-30 shadow-lg">
        <span class="absolute top-1 right-3 cursor-pointer text-xl hover:text-red-400" (click)="handleClose()">×</span>
        <h2 class="text-xl font-bold mb-4">Crafting</h2>
        <div class="mb-4">
          <p class="mb-2 text-sm text-gray-300">Requires: 4 Wood</p>
          <button class="w-full py-2 px-4 bg-[#5fa848] text-white border-none cursor-pointer hover:bg-[#4a8538] disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
                  [disabled]="store.woodCount() < 4"
                  (click)="craftWorkbench()">
            Craft Workbench
          </button>
        </div>
      </div>
    }

    <!-- Workbench Menu (Right Click Workbench) -->
    @if (store.activeMenu() === 'workbench') {
      <div class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/90 border-2 border-[#8D6E63] p-5 w-[300px] text-white text-center rounded-xl z-30 shadow-lg">
        <span class="absolute top-1 right-3 cursor-pointer text-xl hover:text-red-400" (click)="handleClose()">×</span>
        <h2 class="text-xl font-bold mb-4">Workbench</h2>
        <div class="mb-4">
          <p class="mb-2 text-sm text-gray-300">Requires: 3 Wood</p>
          <button class="w-full py-2 px-4 bg-[#5fa848] text-white border-none cursor-pointer hover:bg-[#4a8538] disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
                  [disabled]="store.woodCount() < 3"
                  (click)="craftAxe()">
            Craft Axe
          </button>
        </div>
      </div>
    }

    <!-- Instructions Overlay -->
    @if (store.showInstructions()) {
      <div class="fixed top-0 left-0 w-full h-full bg-black/70 flex flex-col justify-center items-center text-white z-20 cursor-pointer backdrop-blur-sm"
           (click)="requestLock.emit()">
        <h1 class="text-4xl font-bold mb-4 animate-pulse">CLICK TO PLAY</h1>
        <div class="text-center space-y-2 text-lg font-mono bg-black/50 p-6 rounded-xl border border-white/20">
          <p>WASD - Move | SPACE - Jump</p>
          <p>LMB (Hold) - Mine | RMB - Build/Interact</p>
          <p>E - Crafting Menu</p>
          <p>1-5 - Select Block | 8 - Workbench | 9 - Axe</p>
        </div>
      </div>
    }
  `
})
export class GameUiComponent {
  store = inject(GameStateService);
  requestLock = output<void>();
  requestUnlock = output<void>();

  handleClose() {
    this.store.closeMenus();
    this.requestLock.emit();
  }

  craftWorkbench() {
    if (this.store.craftWorkbench()) {
      alert("Workbench crafted! Select slot 8.");
      this.requestLock.emit();
    }
  }

  craftAxe() {
    if (this.store.craftAxe()) {
      alert("Axe crafted! Select slot 9.");
      this.requestLock.emit();
    }
  }
}
