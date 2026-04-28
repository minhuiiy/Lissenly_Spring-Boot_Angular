import { Injectable } from '@angular/core';
import { PlayStatePayload, QueueStatePayload, Room, SeekStatePayload, SyncMessageType } from '../models/types';

@Injectable({
    providedIn: 'root'
})
export class RoomSyncService {
    buildPlayPayload(roomId: string, room: Room, currentTime: number): PlayStatePayload {
        return {
            type: SyncMessageType.PLAY_STATE,
            roomId,
            currentSongIndex: room.currentSongIndex,
            currentTime,
            playing: room.playing,
            startedAt: room.startedAt,
            serverTimestamp: Date.now(),
            isSeeking: false,
        };
    }

    buildSeekPayload(roomId: string, room: Room): SeekStatePayload {
        return {
            type: SyncMessageType.SEEK_STATE,
            roomId,
            currentSongIndex: room.currentSongIndex,
            currentTime: room.currentTime,
            playing: room.playing,
            startedAt: room.startedAt,
            serverTimestamp: Date.now(),
            isSeeking: room.isSeeking ?? true,
        };
    }

    buildQueuePayload(roomId: string, room: Room): QueueStatePayload {
        return {
            type: SyncMessageType.QUEUE_STATE,
            roomId,
            playlist: room.playlist,
            currentSongIndex: room.currentSongIndex,
            currentTime: room.currentTime,
            playing: room.playing,
            startedAt: room.startedAt,
            serverTimestamp: Date.now(),
            isSeeking: false,
        };
    }

    computeRemoteTime(remoteState: PlayStatePayload | SeekStatePayload | QueueStatePayload): number {
        if (remoteState.type === SyncMessageType.SEEK_STATE || remoteState.isSeeking) {
            return Math.max(0, remoteState.currentTime);
        }

        if (remoteState.playing && remoteState.startedAt) {
            return Math.max(0, (Date.now() - remoteState.startedAt) / 1000);
        }

        return Math.max(0, remoteState.currentTime);
    }

    shouldBroadcast(lastState: { currentTime: number; playing: boolean; songIndex: number; isSeeking: boolean }, room: Room): boolean {
        return !(
            lastState.currentTime === room.currentTime &&
            lastState.playing === room.playing &&
            lastState.songIndex === room.currentSongIndex &&
            lastState.isSeeking === (room.isSeeking ?? false)
        );
    }
}
