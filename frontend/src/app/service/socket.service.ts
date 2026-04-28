import { Injectable } from '@angular/core';
import SockJS from 'sockjs-client';
import { CompatClient, Stomp } from '@stomp/stompjs';
import { Subject } from 'rxjs';
import { PlayStatePayload, QueueStatePayload, SeekStatePayload, SyncRequestPayload } from '../models/types';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class SocketService {
    private stompClient: CompatClient | null = null;
    private connected = false;
    private connectionPromise: Promise<void> | null = null;
    public messageSubject = new Subject<any>();

    constructor() { }

    connect(roomId: string): Promise<void> {
        if (this.connected && this.stompClient?.connected) {
            return Promise.resolve();
        }

        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = new Promise((resolve, reject) => {
            const socket = new SockJS(`${environment.apiBaseUrl}/ws`);
            this.stompClient = Stomp.over(socket);

            this.stompClient.connect({}, () => {
                this.connected = true;
                console.log('Connected to WebSocket');
                this.stompClient.subscribe(`/topic/room/${roomId}`, (message: any) => {
                    if (message.body) {
                        this.messageSubject.next(JSON.parse(message.body));
                    }
                });
                resolve();
                this.connectionPromise = null;
            }, (error: any) => {
                this.connected = false;
                this.connectionPromise = null;
                reject(error);
            });
        });

        return this.connectionPromise;
    }

    private ensureConnected() {
        if (!this.stompClient || !this.connected || !this.stompClient.connected) {
            throw new Error('WebSocket connection has not been established yet');
        }
    }

    sendChatMessage(roomId: string, message: any) {
        this.ensureConnected();
        this.stompClient.send(`/app/chat/${roomId}`, {}, JSON.stringify(message));
    }

    sendPlayState(roomId: string, roomState: PlayStatePayload) {
        this.ensureConnected();
        this.stompClient.send(`/app/sync/play/${roomId}`, {}, JSON.stringify(roomState));
    }

    sendSeekState(roomId: string, roomState: SeekStatePayload) {
        this.ensureConnected();
        this.stompClient.send(`/app/sync/seek/${roomId}`, {}, JSON.stringify(roomState));
    }

    sendQueueState(roomId: string, roomState: QueueStatePayload) {
        this.ensureConnected();
        this.stompClient.send(`/app/sync/queue/${roomId}`, {}, JSON.stringify(roomState));
    }

    requestSync(roomId: string, payload: SyncRequestPayload) {
        this.ensureConnected();
        this.stompClient.send(`/app/sync-request/${roomId}`, {}, JSON.stringify(payload));
    }

    joinRoom(roomId: string, userId: string, displayName?: string) {
        this.ensureConnected();
        this.stompClient.send(`/app/member/join/${roomId}`, {}, JSON.stringify({ userId, displayName }));
    }

    leaveRoom(roomId: string, userId: string) {
        this.ensureConnected();
        this.stompClient.send(`/app/member/leave/${roomId}`, {}, JSON.stringify({ userId }));
    }

    sendAddSong(roomId: string, song: any) {
        this.ensureConnected();
        this.stompClient.send(`/app/playlist/add/${roomId}`, {}, JSON.stringify(song));
    }

    disconnect() {
        if (this.stompClient) {
            this.stompClient.disconnect();
        }
        this.connected = false;
        this.connectionPromise = null;
    }
}
