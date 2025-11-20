
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

    <!-- Mining Bar -->
    @if (store.isMiningVisible()) {
      <div class="absolute top-[53%] left-1/2 -translate-x-1/2 w-[100px] h-[6px] bg-black/50 border border-white z-[9]">
        <div class="h-full bg-lime-500 transition-all duration-75 ease-linear" [style.width.%]="store.miningProgress()"></div>
      </div>
    }

    <!-- Top Left Stats -->
    <div class="absolute top-5 left-5 text-white bg-black/50 p-4 rounded-lg pointer-events-none select-none">
      <h2 class="m-0 mt-0 font-bold">Voxel Survival</h2>
      <p>FPS: {{ store.fps() }}</p>
      <p>Blocks: {{ store.blockCount() }}</p>
    </div>

    <!-- Inventory Display -->
    <div class="absolute top-5 right-5 text-white bg-black/50 p-4 rounded-lg select-none text-right">
      <h3 class="font-bold border-b border-white/30 mb-2">Resources</h3>
      <p>Wood: {{ store.woodCount() }}</p>
      <div [class.text-lime-400]="store.hasAxe() > 0" [class.text-gray-400]="store.hasAxe() === 0">
        Axe: {{ store.hasAxe() > 0 ? 'Yes' : 'No' }}
      </div>
    </div>

    <!-- Hotbar -->
    <div class="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 bg-black/30 p-2 rounded-lg">
      <!-- Slot 1: Grass -->
      <div class="w-10 h-10 border-[3px] rounded relative flex items-center justify-center text-white text-[10px] font-bold shadow-sm transition-transform"
           [class.border-white]="store.selectedSlot() === 1" 
           [class.scale-110]="store.selectedSlot() === 1"
           [class.border-white-30]="store.selectedSlot() !== 1"
           style="background: #5fa848;">1</div>

      <!-- Slot 2: Dirt -->
      <div class="w-10 h-10 border-[3px] rounded relative flex items-center justify-center text-white text-[10px] font-bold shadow-sm transition-transform"
           [class.border-white]="store.selectedSlot() === 2" 
           [class.scale-110]="store.selectedSlot() === 2"
           [class.border-white-30]="store.selectedSlot() !== 2"
           style="background: #795548;">2</div>
      
      <!-- Slot 3: Stone -->
      <div class="w-10 h-10 border-[3px] rounded relative flex items-center justify-center text-white text-[10px] font-bold shadow-sm transition-transform"
           [class.border-white]="store.selectedSlot() === 3" 
           [class.scale-110]="store.selectedSlot() === 3"
           [class.border-white-30]="store.selectedSlot() !== 3"
           style="background: #757575;">3</div>

      <!-- Slot 4: Wood -->
      <div class="w-10 h-10 border-[3px] rounded relative flex items-center justify-center text-white text-[10px] font-bold shadow-sm transition-transform"
           [class.border-white]="store.selectedSlot() === 4" 
           [class.scale-110]="store.selectedSlot() === 4"
           [class.border-white-30]="store.selectedSlot() !== 4"
           style="background: #8D6E63;">4</div>
      
      <!-- Slot 5: Workbench (Conditional) -->
      @if (store.hasWorkbench() > 0) {
        <div class="w-10 h-10 border-[3px] rounded relative flex items-center justify-center text-black text-[10px] font-bold shadow-sm transition-transform"
             [class.border-white]="store.selectedSlot() === 5" 
             [class.scale-110]="store.selectedSlot() === 5"
             [class.border-white-30]="store.selectedSlot() !== 5"
             style="background: #DAA520;">5</div>
      }

      <!-- Slot 6: Axe (Conditional) -->
      @if (store.hasAxe() > 0) {
        <div class="w-10 h-10 border-[3px] rounded relative flex items-center justify-center text-white text-[10px] font-bold shadow-sm transition-transform"
             [class.border-white]="store.selectedSlot() === 6" 
             [class.scale-110]="store.selectedSlot() === 6"
             [class.border-white-30]="store.selectedSlot() !== 6"
             style="background: red;">6</div>
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
          <p>1-6 - Select Item</p>
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
      alert("Workbench crafted! Select slot 5.");
      this.requestLock.emit();
    }
  }

  craftAxe() {
    if (this.store.craftAxe()) {
      alert("Axe crafted! Select slot 6.");
      this.requestLock.emit();
    }
  }
}
