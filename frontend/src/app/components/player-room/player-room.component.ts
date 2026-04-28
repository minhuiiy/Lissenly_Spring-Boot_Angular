import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-player-room',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player-room.component.html',
  styleUrl: './player-room.component.css'
})
export class PlayerRoomComponent {
  songTitle = "Stardust Memories";
  artistName = "Luna Eclipse";
  isPlaying = false;
  currentTime = "2:15";
  duration = "3:45";
  progress = 60;

  togglePlayback() {
    this.isPlaying = !this.isPlaying;
  }
}
