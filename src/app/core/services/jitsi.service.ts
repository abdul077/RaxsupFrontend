import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

declare var JitsiMeetExternalAPI: any;

export interface JitsiConfig {
  roomName: string;
  width?: number | string;
  height?: number | string;
  parentNode?: HTMLElement;
  configOverwrite?: any;
  interfaceConfigOverwrite?: any;
}

@Injectable({
  providedIn: 'root',
})
export class JitsiService {
  private api: any = null;
  private apiSubject = new Subject<any>();
  public api$ = this.apiSubject.asObservable();

  private participantJoinedSubject = new Subject<any>();
  public participantJoined$ = this.participantJoinedSubject.asObservable();

  private participantLeftSubject = new Subject<any>();
  public participantLeft$ = this.participantLeftSubject.asObservable();

  private videoConferenceJoinedSubject = new Subject<any>();
  public videoConferenceJoined$ = this.videoConferenceJoinedSubject.asObservable();

  private videoConferenceLeftSubject = new Subject<void>();
  public videoConferenceLeft$ = this.videoConferenceLeftSubject.asObservable();

  constructor() {
    this.loadJitsiScript();
  }

  private loadJitsiScript(): void {
    if (typeof JitsiMeetExternalAPI !== 'undefined') {
      return; // Already loaded
    }

    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    script.onload = () => {
      console.log('Jitsi Meet API loaded');
    };
    document.head.appendChild(script);
  }

  initializeJitsi(config: JitsiConfig): void {
    if (typeof JitsiMeetExternalAPI === 'undefined') {
      console.error('Jitsi Meet API not loaded');
      return;
    }

    this.dispose();

    const defaultConfig = {
      roomName: config.roomName,
      width: config.width || 700,
      height: config.height || 700,
      parentNode: config.parentNode || document.body,
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        ...config.configOverwrite
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
          'fodeviceselection', 'hangup', 'chat', 'settings', 'videoquality', 'filmstrip',
          'invite', 'feedback', 'stats', 'shortcuts', 'tileview', 'download', 'help', 'mute-everyone'
        ],
        SETTINGS_SECTIONS: ['devices', 'language', 'moderator', 'profile'],
        ...config.interfaceConfigOverwrite
      }
    };

    this.api = new JitsiMeetExternalAPI('meet.jit.si', defaultConfig);

    // Register event handlers
    this.api.addEventListener('participantJoined', (participant: any) => {
      console.log('Participant joined:', participant);
      this.participantJoinedSubject.next(participant);
    });

    this.api.addEventListener('participantLeft', (participant: any) => {
      console.log('Participant left:', participant);
      this.participantLeftSubject.next(participant);
    });

    this.api.addEventListener('videoConferenceJoined', (event: any) => {
      console.log('Video conference joined:', event);
      this.videoConferenceJoinedSubject.next(event);
    });

    this.api.addEventListener('videoConferenceLeft', () => {
      console.log('Video conference left');
      this.videoConferenceLeftSubject.next();
    });

    // Listen for audio mute/unmute events
    this.api.addEventListener('audioMuteStatusChanged', (event: any) => {
      console.log('Audio mute status changed:', event);
      if (event.muted) {
        console.warn('Audio was muted!');
      } else {
        console.log('Audio is unmuted');
      }
    });

    // Listen for video mute/unmute events
    this.api.addEventListener('videoMuteStatusChanged', (event: any) => {
      console.log('Video mute status changed:', event);
    });

    // Listen for ready to close (when Jitsi is ready)
    this.api.addEventListener('readyToClose', () => {
      console.log('Jitsi ready to close');
    });

    // Listen for audio availability changed
    this.api.addEventListener('audioAvailabilityChanged', (event: any) => {
      console.log('Audio availability changed:', event);
    });

    // Listen for device list changed
    this.api.addEventListener('deviceListChanged', (event: any) => {
      console.log('Device list changed:', event);
    });

    // Listen for raise hand
    this.api.addEventListener('raiseHandUpdated', (event: any) => {
      console.log('Raise hand updated:', event);
    });

    this.apiSubject.next(this.api);
  }

  dispose(): void {
    if (this.api) {
      this.api.dispose();
      this.api = null;
    }
  }

  executeCommand(command: string, ...args: any[]): void {
    if (this.api) {
      this.api.executeCommand(command, ...args);
    }
  }

  mute(): void {
    this.executeCommand('toggleAudio');
  }

  unmute(): void {
    this.executeCommand('toggleAudio');
  }

  toggleVideo(): void {
    this.executeCommand('toggleVideo');
  }

  hangup(): void {
    this.executeCommand('hangup');
  }

  getApi(): any {
    return this.api;
  }
}

