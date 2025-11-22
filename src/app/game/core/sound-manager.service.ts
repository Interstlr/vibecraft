import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SoundManagerService {
  playRandom(baseName: string, count: number, volume = 1.0) {
    const index = Math.floor(Math.random() * count) + 1;
    const path = `assets/sounds/${baseName}${index}.mp3`;
    this.playSound(path, volume);
  }

  playSound(path: string, volume = 1.0) {
    const audio = new Audio(path);
    audio.volume = volume;
    // Minecraft-like pitch variation
    audio.playbackRate = 0.8 + Math.random() * 0.4;
    audio.play().catch(e => console.warn('Audio play failed', e));
  }
}

