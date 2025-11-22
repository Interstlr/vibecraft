
import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../services/game-state.service';

@Component({
  selector: 'app-loading-screen',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 flex flex-col items-center justify-center font-mono text-white select-none">
      
      <!-- Tiled Dirt Background -->
      <div class="absolute inset-0 z-0" 
           style="background-image: url('assets/minecraft/textures/block/dirt.png'); 
                  background-size: 64px; 
                  image-rendering: pixelated;">
        <div class="absolute inset-0 bg-black/50"></div>
      </div>

      <!-- Content -->
      <div class="z-10 flex flex-col items-center w-[600px] max-w-[90vw] gap-4">
        
        <!-- Title -->
        <h2 class="text-2xl mb-8 drop-shadow-[2px_2px_0_#000]">Generating World...</h2>

        <!-- Progress Bar Container -->
        <div class="w-full h-[40px] border-[2px] border-[#8f8f8f] bg-black relative">
            <!-- Green Progress -->
            <div class="h-full bg-[#00ff00] transition-all duration-200 ease-out"
                 [style.width.%]="progress()">
            </div>
        </div>

        <!-- Percentage text -->
        <div class="text-xl drop-shadow-[2px_2px_0_#000]">
            {{ progress() }}%
        </div>

      </div>
    </div>
  `
})
export class LoadingScreenComponent {
  private gameState = inject(GameStateService);
  
  progress = computed(() => Math.floor(this.gameState.loadingProgress()));
}

