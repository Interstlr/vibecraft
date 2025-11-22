
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../services/game-state.service';
import { WorldStorageService } from '../game/world/world-storage.service';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-full h-full overflow-hidden font-mono select-none flex flex-col items-center justify-center">
      
      <!-- Background Image (Asset) -->
      <div class="absolute inset-0 z-0 w-full h-full"
           style="background-image: url('assets/minecraft/textures/gui/presets/isles.png'); 
                  background-size: cover;
                  background-position: center;
                  image-rendering: pixelated;">
        <div class="absolute inset-0 bg-black/50"></div>
      </div>

      <!-- Content -->
      <div class="z-10 flex flex-col items-center gap-8">
        
        <!-- Title -->
        <h1 class="text-center flex flex-col items-center">
            <div class="text-6xl font-bold text-[#AAAAAA] drop-shadow-[4px_4px_0_#000] tracking-wider mb-2 relative">
              <span class="absolute inset-0 text-[#3f3f3f] translate-x-1 translate-y-1 blur-[1px]">MINECRAFT</span>
              <span class="relative z-10 text-white">MINECRAFT</span>
            </div>
            <div class="text-4xl font-bold text-yellow-400 drop-shadow-[3px_3px_0_#3f3f3f] tracking-wide animate-pulse -rotate-2 mt-2">
              - VIBE EDITION -
            </div>
        </h1>

        <!-- Resume Button -->
        @if (hasSavedGame()) {
          <button (click)="resumeGame()" 
                  class="group relative w-[400px] h-[60px] bg-[#7d7d7d] active:bg-[#595959] border-[3px] border-black text-white text-2xl shadow-xl transition-transform hover:scale-[1.02] cursor-pointer">
            <!-- Pseudo-3D Borders -->
            <div class="absolute inset-0 border-t-[3px] border-l-[3px] border-[#c6c6c6] pointer-events-none"></div>
            <div class="absolute inset-0 border-b-[3px] border-r-[3px] border-[#3b3b3b] pointer-events-none"></div>
            
            <!-- Text -->
            <span class="relative z-10 drop-shadow-[2px_2px_0_#000] group-hover:text-[#ffffa0]">
              Resume Game
            </span>
          </button>
        }

        <!-- Play Button (Minecraft Style) -->
        <button (click)="startGame()" 
                class="group relative w-[400px] h-[60px] bg-[#7d7d7d] active:bg-[#595959] border-[3px] border-black text-white text-2xl shadow-xl transition-transform hover:scale-[1.02] mt-0 cursor-pointer">
          <!-- Pseudo-3D Borders -->
          <div class="absolute inset-0 border-t-[3px] border-l-[3px] border-[#c6c6c6] pointer-events-none"></div>
          <div class="absolute inset-0 border-b-[3px] border-r-[3px] border-[#3b3b3b] pointer-events-none"></div>
          
          <!-- Text -->
          <span class="relative z-10 drop-shadow-[2px_2px_0_#000] group-hover:text-[#ffffa0]">
            {{ hasSavedGame() ? 'New Game' : 'Play Game' }}
          </span>
        </button>

        <!-- Footer / Version -->
        <div class="absolute bottom-4 left-4 text-white text-lg drop-shadow-[2px_2px_0_#000]">
          Minecraft Vibe Edition v1.0
        </div>
        
        <div class="absolute bottom-4 right-4 text-white text-lg drop-shadow-[2px_2px_0_#000]">
          Angular 18+ | Three.js
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
    }
  `]
})
export class MainMenuComponent implements OnInit {
  store = inject(GameStateService);
  worldStorage = inject(WorldStorageService);
  
  hasSavedGame = signal(false);

  async ngOnInit() {
    try {
      const hasSave = await this.worldStorage.hasSavedWorld();
      console.log('Checking for saved world:', hasSave);
      this.hasSavedGame.set(hasSave);
    } catch (e) {
      console.error('Error checking for saved world:', e);
    }
  }

  startGame() {
    this.store.startGame(false);
  }

  resumeGame() {
    this.store.startGame(true);
  }
}