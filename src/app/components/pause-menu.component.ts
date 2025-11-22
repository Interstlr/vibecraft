import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorldStorageService } from '../game/world/world-storage.service';
import { ChunkManagerService } from '../game/world/management/chunk-manager.service';

@Component({
  selector: 'app-pause-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm">
      <div class="flex flex-col items-center gap-6 w-[300px]">
        
        <h2 class="text-4xl font-bold text-white mb-8 drop-shadow-[2px_2px_0_#000]">
          GAME PAUSED
        </h2>

        <!-- Resume Button -->
        <button (click)="resume.emit()" 
                class="group relative w-full h-12 bg-[#7d7d7d] active:bg-[#595959] border-[3px] border-black text-white text-xl shadow-xl transition-transform hover:scale-[1.02] cursor-pointer">
          <div class="absolute inset-0 border-t-[3px] border-l-[3px] border-[#c6c6c6] pointer-events-none"></div>
          <div class="absolute inset-0 border-b-[3px] border-r-[3px] border-[#3b3b3b] pointer-events-none"></div>
          <span class="relative z-10 drop-shadow-[2px_2px_0_#000] group-hover:text-[#ffffa0]">
            Back to Game
          </span>
        </button>

        <!-- Save Button -->
        <button (click)="saveGame()" 
                class="group relative w-full h-12 bg-[#7d7d7d] active:bg-[#595959] border-[3px] border-black text-white text-xl shadow-xl transition-transform hover:scale-[1.02] cursor-pointer">
          <div class="absolute inset-0 border-t-[3px] border-l-[3px] border-[#c6c6c6] pointer-events-none"></div>
          <div class="absolute inset-0 border-b-[3px] border-r-[3px] border-[#3b3b3b] pointer-events-none"></div>
          <span class="relative z-10 drop-shadow-[2px_2px_0_#000] group-hover:text-[#ffffa0]">
            {{ isSaving ? 'Saving...' : 'Save Game' }}
          </span>
        </button>

        <!-- Quit Button (Optional, but standard in pause menus) -->
         <button (click)="quitGame()" 
                class="group relative w-full h-12 bg-[#7d7d7d] active:bg-[#595959] border-[3px] border-black text-white text-xl shadow-xl transition-transform hover:scale-[1.02] cursor-pointer mt-4">
          <div class="absolute inset-0 border-t-[3px] border-l-[3px] border-[#c6c6c6] pointer-events-none"></div>
          <div class="absolute inset-0 border-b-[3px] border-r-[3px] border-[#3b3b3b] pointer-events-none"></div>
          <span class="relative z-10 drop-shadow-[2px_2px_0_#000] group-hover:text-[#ffffa0]">
            Save & Quit
          </span>
        </button>

      </div>
    </div>
  `
})
export class PauseMenuComponent {
  resume = output<void>();
  private worldStorage = inject(WorldStorageService);
  // We need to access current seed, maybe from ChunkManager or Store?
  // Currently seed is in ChunkManager private.
  // Let's assume we can get it or we need to expose it.
  // Actually GameSceneComponent handles init, but here we are in PauseMenu.
  // Ideally ChunkManager should expose seed.
  
  // Wait, we can't easily get the seed here without exposing it in ChunkManager.
  // Let's inject ChunkManager and use 'any' cast to get seed if necessary or add a getter.
  // Actually, let's add getSeed() to ChunkManager.
  private chunkManager = inject(ChunkManagerService);
  
  isSaving = false;

  async saveGame() {
    this.isSaving = true;
    // We need the seed. 
    // Quick fix: add getSeed() to ChunkManager in next step, for now assume it exists or use a property.
    // The typescript compiler will complain if I don't add it.
    // I'll add getSeed() to ChunkManagerService first.
    const seed = (this.chunkManager as any).seed; // Temporary cast until I add the getter
    await this.worldStorage.saveWorld(seed);
    this.isSaving = false;
    // alert('Game Saved!');
  }

  async quitGame() {
    await this.saveGame();
    location.reload();
  }
}

