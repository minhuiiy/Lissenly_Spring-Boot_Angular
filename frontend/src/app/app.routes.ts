import { Routes } from '@angular/router';
import { RoomComponent } from './components/room/room.component';
import { PlayerRoomComponent } from './components/player-room/player-room.component';
import { CreateRoomComponent } from './components/create-room/create-room.component';

export const routes: Routes = [
    { path: 'room/:id', component: RoomComponent },
    { path: 'create', component: CreateRoomComponent },
    { path: 'player-design', component: PlayerRoomComponent },
    { path: '**', redirectTo: '' },
];
