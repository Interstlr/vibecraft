import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';

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

        <!-- Settings Button (Placeholder) -->
        <button (click)="openSettings()" 
                class="group relative w-full h-12 bg-[#7d7d7d] active:bg-[#595959] border-[3px] border-black text-white text-xl shadow-xl transition-transform hover:scale-[1.02] cursor-pointer">
          <div class="absolute inset-0 border-t-[3px] border-l-[3px] border-[#c6c6c6] pointer-events-none"></div>
          <div class="absolute inset-0 border-b-[3px] border-r-[3px] border-[#3b3b3b] pointer-events-none"></div>
          <span class="relative z-10 drop-shadow-[2px_2px_0_#000] group-hover:text-[#ffffa0]">
            Settings
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

  openSettings() {
    console.log('Settings clicked');
    // Future implementation
  }

  quitGame() {
    console.log('Quit clicked');
    // Future implementation: return to main menu
    location.reload(); // Simple restart for now
  }
}

