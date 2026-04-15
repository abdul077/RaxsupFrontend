import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NotificationAudioService {
  private audio?: HTMLAudioElement;
  private soundEnabled = true;

  constructor() {
    // Check localStorage for sound preference
    const savedPreference = localStorage.getItem('notificationSoundEnabled');
    this.soundEnabled = savedPreference !== 'false';
    
    // Try to load the audio file
    try {
      this.audio = new Audio('assets/sounds/notification.mp3');
      this.audio.volume = 0.5; // Set to 50% volume
    } catch (error) {
      console.warn('[NotificationAudio] Failed to load notification sound:', error);
    }
  }

  play(category?: string): void {
    if (!this.soundEnabled || !this.audio) {
      return;
    }

    // Only play sound for certain categories
    const soundCategories = ['Warning', 'Error', 'Success'];
    if (category && !soundCategories.includes(category)) {
      return;
    }

    try {
      // Reset audio to start if already playing
      this.audio.currentTime = 0;
      this.audio.play().catch(err => {
        console.warn('[NotificationAudio] Audio play failed:', err);
      });
    } catch (error) {
      console.warn('[NotificationAudio] Error playing sound:', error);
    }
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    localStorage.setItem('notificationSoundEnabled', enabled.toString());
  }

  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }
}

