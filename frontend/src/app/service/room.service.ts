import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Room } from '../models/types';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class RoomService {
    private apiUrl = `${environment.apiBaseUrl}/api/rooms`;

    constructor(private http: HttpClient) { }

    createRoom(hostId: string, roomName?: string, isPrivate?: boolean): Observable<Room> {
        const params = new URLSearchParams({ hostId });
        if (roomName && roomName.trim()) {
            params.set('roomName', roomName.trim());
        }
        if (typeof isPrivate === 'boolean') {
            params.set('isPrivate', String(isPrivate));
        }
        return this.http.post<Room>(`${this.apiUrl}/create?${params.toString()}`, {});
    }

    getPublicRooms(): Observable<Room[]> {
        return this.http.get<Room[]>(`${this.apiUrl}/public`);
    }

    getRoom(roomId: string): Observable<Room> {
        return this.http.get<Room>(`${this.apiUrl}/${roomId}`);
    }

    checkRoomExists(roomId: string): Observable<{ exists: boolean }> {
        return this.http.get<{ exists: boolean }>(`${this.apiUrl}/${roomId}/exists`);
    }

    joinRoom(roomId: string, userId: string, displayName?: string): Observable<any> {
        const params = new URLSearchParams({ userId });
        if (displayName && displayName.trim()) {
            params.set('displayName', displayName.trim());
        }
        return this.http.post(`${this.apiUrl}/${encodeURIComponent(roomId)}/join?${params.toString()}`, {});
    }

    leaveRoom(roomId: string, userId: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/${encodeURIComponent(roomId)}/leave?userId=${encodeURIComponent(userId)}`, {});
    }
}
