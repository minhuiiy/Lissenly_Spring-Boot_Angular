export interface Song {
    videoId: string;
    title: string;
    thumbnail: string;
    channelTitle?: string;
    liked?: boolean;
}

export interface Room {
    roomId: string;
    name?: string;
    hostId: string;
    playlist: Song[];
    members?: string[];
    currentSongIndex: number;
    currentTime: number;
    playing: boolean;
    startedAt?: number;
    serverTimestamp?: number;
    isSeeking?: boolean;
    isPrivate?: boolean;
}

export enum SyncMessageType {
    PLAY_STATE = 'PLAY_STATE',
    SEEK_STATE = 'SEEK_STATE',
    QUEUE_STATE = 'QUEUE_STATE',
    SYNC_REQUEST = 'SYNC_REQUEST'
}

interface SyncPayloadBase {
    roomId: string;
    currentSongIndex: number;
    currentTime: number;
    playing: boolean;
    startedAt?: number;
    serverTimestamp?: number;
    isSeeking?: boolean;
}

export interface PlayStatePayload extends SyncPayloadBase {
    type: SyncMessageType.PLAY_STATE;
}

export interface SeekStatePayload extends SyncPayloadBase {
    type: SyncMessageType.SEEK_STATE;
}

export interface QueueStatePayload extends SyncPayloadBase {
    type: SyncMessageType.QUEUE_STATE;
    playlist: Song[];
}

export interface SyncRequestPayload {
    type: SyncMessageType.SYNC_REQUEST;
    roomId: string;
    userId: string;
}

export type RoomSyncPayload = PlayStatePayload | SeekStatePayload | QueueStatePayload;

export interface ChatMessage {
    sender: string;
    content: string;
    type: 'CHAT' | 'JOIN' | 'LEAVE' | 'SYNC';
}
