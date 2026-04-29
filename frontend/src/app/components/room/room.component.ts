import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SocketService } from '../../service/socket.service';
import { RoomService } from '../../service/room.service';
import {
    ChatMessage,
    PlayStatePayload,
    QueueStatePayload,
    Room,
    SeekStatePayload,
    Song,
    SyncMessageType,
    SyncRequestPayload,
} from '../../models/types';
import { RoomSyncService } from '../../service/room-sync.service';
import { YouTubePlayer } from '@angular/youtube-player';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YouTubePlayerModule } from '@angular/youtube-player';
import { HttpClient } from '@angular/common/http';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { SvgIconButtonComponent } from '../ui/svg-icon-button/svg-icon-button.component';
import { VoiceChatService } from '../../service/voice-chat.service';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-room',
    templateUrl: './room.component.html',
    styleUrls: ['./room.component.css'],
    standalone: true,
    imports: [CommonModule, FormsModule, YouTubePlayerModule, DragDropModule, SvgIconButtonComponent]
})
export class RoomComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChild('player') player!: YouTubePlayer;
    @ViewChild('scrollMe') scrollMe?: any;

    roomId = '';
    room!: Room;
    messages: ChatMessage[] = [];
    newMessage = '';
    userId = '';
    displayName: string | null = null;
    nickname: string | null = null;
    requiresNameBeforeJoin = false;
    isHost = false;
    activeTab: 'chat' | 'playlist' = 'chat';
    isSidebarOpen = false;
    isShareDialogOpen = false;
    isSettingsDialogOpen = false;
    toastMessage = '';
    showToast = false;
    syncMode: 'host' | 'guest' = 'guest';
    guestManualAudioEnabled = false;
    joinedStateApplied = false;
    private hasJoinedRoom = false;
    dragOverIndex: number | null = null;
    draggedIndex: number | null = null;
    isMuted = false;
    isVoiceEnabled = false;
    isMicMuted = true;
    volume = 80;
    lastNonMutedVolume = 80;
    private readonly defaultVolume = 80;
    currentProgress = 0;
    currentVideoId = '';
    private playerReady = false;
    private pendingRemoteState: PlayStatePayload | SeekStatePayload | QueueStatePayload | null = null;
    playPauseIconPath = 'M8 5v14l11-7-11-7z';
    nextIconPath = 'M7 6l8 6-8 6V6zm9 0h2v12h-2V6z';
    private progressTimer?: number;
    private syncTimer?: number;
    private seekDebounceTimer?: number;
    private seekBroadcastThrottleTimer?: number;
    private suppressPlayerStateBroadcast = false;
    private lastBroadcastState = { currentTime: -1, playing: false, songIndex: -1, isSeeking: false };
    private remotePlayRetryTimer?: number;
    playerVars = {
        autoplay: 1,
        controls: 1,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
        enablejsapi: 1,
        origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    };
    roomTheme = 'cream';
    roomPassword = '';
    roomVisibility: 'public' | 'private' = 'public';
    shareLink = '';
    shareQrUrl = '';
    searchQuery = '';
    searchResults: Song[] = [];
    isSearching = false;
    activeSuggestion: string | null = null;
    readonly searchSuggestions = [
        'V-Pop Chill',
        'Lofi Làm Việc',
        'US-UK 2010s',
        'K-pop Upbeat',
        'Night Drive',
    ];

    constructor(
        private route: ActivatedRoute,
        public router: Router,
        private socketService: SocketService,
        private roomService: RoomService,
        private roomSyncService: RoomSyncService,
        private http: HttpClient,
        private voiceChatService: VoiceChatService
    ) { }

    async ngOnInit() {
        this.roomId = this.route.snapshot.paramMap.get('id') || '';
        this.volume = this.loadSavedVolume();
        this.lastNonMutedVolume = this.volume || this.defaultVolume;
        const savedDisplayName = localStorage.getItem('lissenly_display_name') || localStorage.getItem('lissenly_name');
        this.userId = (localStorage.getItem('lissenly_user_id') || '').trim();
        this.displayName = savedDisplayName ? savedDisplayName.trim() : null;

        if (this.displayName) {
            this.setNickname(this.displayName);
            this.requiresNameBeforeJoin = false;
        } else {
            this.requiresNameBeforeJoin = true;
        }

        this.roomService.getRoom(this.roomId).subscribe({
            next: (data) => {
                this.room = data;
                this.roomId = data.roomId.toUpperCase();
                this.shareLink = `${window.location.origin}/room/${this.roomId}`;
                this.shareQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(this.shareLink)}`;
                if (this.nickname) {
                    this.connectToSocket();
                }
            },
            error: () => {
                alert('Không tìm thấy phòng. Vui lòng kiểm tra lại mã phòng.');
                this.router.navigate(['/']);
            }
        });

        this.socketService.messageSubject.subscribe((data: any) => this.handleSocketMessage(data));
    }

    ngAfterViewInit() {
        this.scrollMessagesToBottom();
        this.startProgressSync();
        this.startSyncLoop();
    }

    setNickname(name: string) {
        const cleanName = (name || '').trim();
        const fallbackName = (this.userId || localStorage.getItem('lissenly_user_id') || '').trim();
        const resolvedName = cleanName || fallbackName;
        if (!resolvedName) return;
        this.displayName = resolvedName;
        this.nickname = resolvedName;
        localStorage.setItem('lissenly_display_name', resolvedName);
        localStorage.setItem('lissenly_name', resolvedName);
        this.requiresNameBeforeJoin = false;
        if (this.room) this.connectToSocket();
    }

    submitGuestName(name: string) {
        const cleanName = (name || '').trim();
        if (!cleanName) return;
        this.setNickname(cleanName);
    }

    connectToSocket() {
        if (!this.userId) {
            const savedUserId = (localStorage.getItem('lissenly_user_id') || '').trim();
            if (savedUserId) {
                this.userId = savedUserId;
            } else {
                this.userId = `guest-${Math.random().toString(36).slice(2, 10)}`;
                localStorage.setItem('lissenly_user_id', this.userId);
            }
        }
        this.isHost = (this.room.hostId === this.userId || this.room.hostId === 'Admin');
        this.syncMode = this.isHost ? 'host' : 'guest';
        this.volume = this.loadSavedVolume();
        this.lastNonMutedVolume = this.volume || this.defaultVolume;
        this.socketService.connect(this.roomId)
            .then(() => {
                this.voiceChatService.init(this.roomId, this.userId);
                if (!this.hasJoinedRoom) {
                    this.hasJoinedRoom = true;
                    try {
                        this.socketService.joinRoom(this.roomId, this.userId, this.displayName || this.nickname || this.userId);
                    } catch (error) {
                        this.hasJoinedRoom = false;
                        console.error('Join room failed', error);
                    }
                }
                this.syncVoiceMembers();
                this.sendInitialSyncRequest();
            })
            .catch((error) => console.error('WebSocket connect failed', error));
    }

    handleSocketMessage(data: any) {
        if (data?.type === 'ROOM_MEMBERS') {
            if (this.room && Array.isArray(data.members)) {
                this.room.members = this.deduplicateMembers(data.members);
                this.syncVoiceMembers();

                const joinedUserId = typeof data.userId === 'string' ? data.userId.trim() : '';
                const isAnotherUserJoining = data.event === 'JOIN' && !!joinedUserId && joinedUserId !== this.userId;
                if (this.isHost && isAnotherUserJoining && this.room.playlist?.length) {
                    this.socketService.sendQueueState(this.roomId, this.roomSyncService.buildQueuePayload(this.roomId, this.room));
                }
            }
            return;
        }

        if (data?.type === SyncMessageType.VOICE_OFFER || data?.type === SyncMessageType.VOICE_ANSWER || data?.type === SyncMessageType.VOICE_ICE_CANDIDATE) {
            this.voiceChatService.handleSignal(data).catch((err) => console.error('Voice signal handling failed', err));
            return;
        }

        if (data.content && data.sender) {
            this.messages.push(data);
            this.scrollMessagesToBottom();
            return;
        }

        const syncPayload = this.normalizeSyncPayload(data);
        if (syncPayload) {
            console.log('[sync]', syncPayload.type, {
                currentSongIndex: syncPayload.currentSongIndex,
                currentTime: syncPayload.currentTime,
                playing: syncPayload.playing,
                seeking: syncPayload.isSeeking,
            });
            this.applyRemotePlaybackState(syncPayload);
        }
    }

    private normalizeSyncPayload(data: any): PlayStatePayload | SeekStatePayload | QueueStatePayload | null {
        if (!data) return null;

        if (typeof data.type === 'string' && [
            SyncMessageType.PLAY_STATE,
            SyncMessageType.SEEK_STATE,
            SyncMessageType.QUEUE_STATE
        ].includes(data.type)) {
            return data;
        }

        if (data.roomId && Array.isArray(data.playlist)) {
            return { ...data, type: SyncMessageType.QUEUE_STATE } as QueueStatePayload;
        }

        return null;
    }

    openShareDialog() {
        this.shareLink = `${window.location.origin}/room/${this.roomId.toUpperCase()}`;
        this.shareQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(this.shareLink)}`;
        this.isShareDialogOpen = true;
    }

    openSettingsDialog() {
        this.roomTheme = this.getSavedRoomTheme();
        this.roomVisibility = this.room?.isPrivate ? 'private' : 'public';
        this.roomPassword = localStorage.getItem(this.getPasswordStorageKey()) || '';
        this.isSettingsDialogOpen = true;
    }

    closeSettingsDialog() {
        this.isSettingsDialogOpen = false;
    }

    closeShareDialog() { this.isShareDialogOpen = false; }

    async copyShareLink() {
        if (!this.shareLink) return;
        try { await navigator.clipboard.writeText(this.shareLink); this.showToastMessage('Đã copy link'); }
        catch (error) { console.error('Copy failed', error); }
    }

    showToastMessage(message: string) {
        this.toastMessage = message;
        this.showToast = true;
        window.clearTimeout((this as any)._toastTimer);
        (this as any)._toastTimer = window.setTimeout(() => (this.showToast = false), 2000);
    }

    private getVolumeStorageKey() {
        return `lissenly_volume_${this.roomId || 'default'}_${this.userId || 'guest'}`;
    }

    private getThemeStorageKey() {
        return `lissenly_room_theme_${this.roomId || 'default'}`;
    }

    private getPasswordStorageKey() {
        return `lissenly_room_password_${this.roomId || 'default'}`;
    }

    private loadSavedVolume() {
        const raw = localStorage.getItem(this.getVolumeStorageKey());
        const saved = raw ? Number(raw) : this.defaultVolume;
        return Number.isFinite(saved) ? Math.max(0, Math.min(100, saved)) : this.defaultVolume;
    }

    private saveVolume(value: number) {
        localStorage.setItem(this.getVolumeStorageKey(), String(Math.max(0, Math.min(100, value))));
    }

    resolveMemberName(member: any): string {
        if (typeof member === 'string') return member.trim();
        if (member && typeof member === 'object') {
            const displayName = typeof member.displayName === 'string' ? member.displayName.trim() : '';
            const userId = typeof member.userId === 'string' ? member.userId.trim() : '';
            return displayName || userId;
        }
        return '';
    }

    memberInitial(member: any): string {
        const name = this.resolveMemberName(member);
        return name ? name.charAt(0).toUpperCase() : '?';
    }

    isHostMember(member: any): boolean {
        const memberName = this.resolveMemberName(member).toLowerCase();
        const hostName = (this.room?.hostId || '').trim().toLowerCase();
        if (!memberName || !hostName) return false;
        return memberName === hostName;
    }

    private deduplicateMembers(members: any[] = []): any[] {
        const seen = new Set<string>();
        const normalizedMembers = members.filter((member) => !!this.resolveMemberName(member));

        return normalizedMembers.filter((member) => {
            const userId = member && typeof member === 'object' && typeof member.userId === 'string'
                ? member.userId.trim().toLowerCase()
                : '';
            const displayName = this.resolveMemberName(member).toLowerCase();
            const key = userId || `name:${displayName}`;
            if (!key) return false;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private getSavedRoomTheme() {
        return localStorage.getItem(this.getThemeStorageKey()) || 'cream';
    }

    saveRoomSettings() {
        if (!this.room) return;
        this.room.name = this.room.name?.trim() || this.room.name;
        this.room.isPrivate = this.roomVisibility === 'private';
        localStorage.setItem(this.getThemeStorageKey(), this.roomTheme);
        if (this.roomPassword.trim()) {
            localStorage.setItem(this.getPasswordStorageKey(), this.roomPassword.trim());
        } else {
            localStorage.removeItem(this.getPasswordStorageKey());
        }
        this.isSettingsDialogOpen = false;
        this.showToastMessage('Đã lưu cài đặt phòng');
    }

    closeRoomForever() {
        if (!confirm('Bạn chắc chắn muốn đóng phòng vĩnh viễn? Hành động này chỉ xóa phòng khỏi giao diện hiện tại.')) return;
        this.router.navigate(['/']);
    }

    private setPlayerVideo(videoId: string, startSeconds = 0) {
        if (!this.player) return;
        this.currentVideoId = videoId;
        this.player.videoId = videoId;
        this.player.startSeconds = startSeconds;
        window.setTimeout(() => this.restorePlayerVolume(), 0);
    }

    private restorePlayerVolume() {
        if (!this.player) return;
        const volume = this.isMuted ? 0 : Math.max(0, Math.min(100, this.lastNonMutedVolume || this.volume || this.defaultVolume));
        this.volume = volume;
        if (volume === 0) {
            this.player.mute();
            this.isMuted = true;
        } else {
            this.player.setVolume(volume);
            this.player.unMute();
            this.isMuted = false;
        }
    }

    onPlayerReady() {
        this.playerReady = true;
        this.restorePlayerVolume();
        if (this.pendingRemoteState) {
            const pending = this.pendingRemoteState;
            this.pendingRemoteState = null;
            this.applyRemotePlaybackState(pending);
        }
    }

    private scheduleRemotePlayRetry(targetTime: number) {
        if (typeof window === 'undefined' || !this.player) return;
        window.clearTimeout(this.remotePlayRetryTimer);
        window.clearTimeout(this.remotePlayRetryTimer);
        this.remotePlayRetryTimer = window.setTimeout(() => {
            if (!this.player || !this.room?.playing) return;
            const state = this.player.getPlayerState?.();
            if (state !== 1) {
                this.player.seekTo(targetTime, true);
                this.player.playVideo();
            }
        }, 900);
    }

    enableGuestManualAudio() {
        if (this.isHost) return;
        this.guestManualAudioEnabled = true;
        if (!this.player || !this.room?.playlist?.length) return;

        const targetTime = Math.max(0, this.room.currentTime || 0);
        const currentVideoId = this.currentVideoId || this.room.playlist[this.room.currentSongIndex]?.videoId;
        if (currentVideoId) {
            this.setPlayerVideo(currentVideoId, targetTime);
        }

        window.setTimeout(() => {
            if (!this.player) return;
            if (Math.abs(this.player.getCurrentTime() - targetTime) > 0.35) {
                this.player.seekTo(targetTime, true);
            }
            this.restorePlayerVolume();
            if (this.room.playing) {
                this.player.playVideo();
                this.scheduleRemotePlayRetry(targetTime);
            }
        }, 250);
    }

    scrollMessagesToBottom() {
        requestAnimationFrame(() => {
            if (this.scrollMe?.nativeElement) this.scrollMe.nativeElement.scrollTop = this.scrollMe.nativeElement.scrollHeight;
        });
    }

    searchYouTube(query: string = this.searchQuery) {
        const normalizedQuery = query.trim();
        if (!normalizedQuery) return;

        this.searchQuery = normalizedQuery;
        this.activeSuggestion = null;
        this.isSearching = true;
        const encodedQuery = encodeURIComponent(normalizedQuery);
        this.http.get<Song[]>(`${environment.apiBaseUrl}/api/youtube/search?q=${encodedQuery}`).subscribe({
            next: (results) => { this.searchResults = results; this.isSearching = false; },
            error: (err) => { console.error('Search failed', err); this.isSearching = false; }
        });
    }

    onStateChange(event: any) {
        if (!this.isHost || this.suppressPlayerStateBroadcast || !this.room?.playlist?.length || !this.player) return;

        const state = event.data;
        this.room.playing = state === 1;
        this.room.currentTime = this.player.getCurrentTime();
        this.room.startedAt = this.room.playing ? Date.now() - (this.room.currentTime * 1000) : 0;
        this.room.serverTimestamp = Date.now();

        const nextState = {
            currentTime: Math.round(this.room.currentTime * 1000) / 1000,
            playing: this.room.playing,
            songIndex: this.room.currentSongIndex,
            isSeeking: state === 2,
        };

        if (!this.roomSyncService.shouldBroadcast(this.lastBroadcastState, { ...this.room, isSeeking: nextState.isSeeking })) {
            return;
        }

        this.lastBroadcastState = nextState;

        if (state === 1 || state === 0) {
            console.log('[send]', SyncMessageType.PLAY_STATE, {
                currentSongIndex: this.room.currentSongIndex,
                currentTime: this.room.currentTime,
                playing: this.room.playing,
            });
            this.socketService.sendPlayState(this.roomId, this.roomSyncService.buildPlayPayload(this.roomId, this.room, this.room.currentTime));
        } else if (state === 2) {
            console.log('[send]', SyncMessageType.SEEK_STATE, {
                currentSongIndex: this.room.currentSongIndex,
                currentTime: this.room.currentTime,
                playing: this.room.playing,
            });
            this.socketService.sendSeekState(this.roomId, this.roomSyncService.buildSeekPayload(this.roomId, this.room));
        }
    }

    applyRemotePlaybackState(remoteState: PlayStatePayload | SeekStatePayload | QueueStatePayload) {
        if (!this.room) {
            this.room = {
                roomId: this.roomId,
                hostId: '',
                playlist: [],
                currentSongIndex: 0,
                currentTime: 0,
                playing: false,
            } as Room;
        }

        const currentSongIndex = remoteState.currentSongIndex ?? this.room.currentSongIndex ?? 0;
        const playlist = remoteState.type === SyncMessageType.QUEUE_STATE
            ? (remoteState as QueueStatePayload).playlist ?? this.room.playlist ?? []
            : this.room.playlist ?? [];
        const remoteVideoId = playlist[currentSongIndex]?.videoId;
        const currentVideoId = this.currentVideoId || this.room.playlist?.[this.room.currentSongIndex]?.videoId;

        this.room.playlist = playlist;
        this.room.currentSongIndex = currentSongIndex;
        this.room.serverTimestamp = remoteState.serverTimestamp ?? Date.now();

        if (remoteState.type === SyncMessageType.QUEUE_STATE) {
            this.room.currentTime = remoteState.currentTime;
            this.room.playing = remoteState.playing;
            this.room.startedAt = remoteState.startedAt ?? 0;
            this.room.serverTimestamp = remoteState.serverTimestamp ?? Date.now();
            this.room.isSeeking = false;
            this.currentVideoId = remoteVideoId || this.currentVideoId;
            this.suppressPlayerStateBroadcast = true;

            if (!this.playerReady) {
                this.pendingRemoteState = remoteState;
                return;
            }

            const applyQueueStateToPlayer = () => {
                if (!this.player) return;
                const targetTime = this.roomSyncService.computeRemoteTime(remoteState);
                this.room.currentTime = targetTime;

                this.suppressPlayerStateBroadcast = true;
                if (Math.abs(this.player.getCurrentTime() - targetTime) > 0.35) {
                    this.player.seekTo(targetTime, true);
                }

                if (this.room.playing) {
                    if (this.isHost || this.guestManualAudioEnabled) {
                        this.restorePlayerVolume();
                        this.player.playVideo();
                        this.scheduleRemotePlayRetry(targetTime);
                    } else {
                        this.player.pauseVideo();
                    }
                } else {
                    this.player.pauseVideo();
                }

                this.updatePlayerUIFromState(this.room);
                window.setTimeout(() => (this.suppressPlayerStateBroadcast = false), 180);
            };

            if (remoteVideoId && this.player && currentVideoId !== remoteVideoId) {
                this.suppressPlayerStateBroadcast = true;
                this.setPlayerVideo(remoteVideoId, remoteState.currentTime);
                window.setTimeout(() => {
                    this.restorePlayerVolume();
                    applyQueueStateToPlayer();
                }, 300);
                return;
            }

            applyQueueStateToPlayer();
            return;
        }

        if (remoteState.type !== SyncMessageType.PLAY_STATE && remoteState.type !== SyncMessageType.SEEK_STATE) {
            return;
        }

        if (!this.playerReady) {
            this.pendingRemoteState = remoteState;
            return;
        }

        if (!remoteVideoId) {
            this.pendingRemoteState = remoteState;
            return;
        }

        this.room.playing = remoteState.playing;
        this.room.startedAt = remoteState.startedAt ?? 0;
        this.room.isSeeking = remoteState.type === SyncMessageType.SEEK_STATE || !!remoteState.isSeeking;

        const targetTime = this.roomSyncService.computeRemoteTime(remoteState);
        this.room.currentTime = targetTime;

        const applyPlayerState = () => {
            this.suppressPlayerStateBroadcast = true;
            if (Math.abs(this.player.getCurrentTime() - targetTime) > 0.35 || this.room.isSeeking) {
                this.player.seekTo(targetTime, true);
            }
            if (this.room.playing) {
                if (this.isHost || this.guestManualAudioEnabled) {
                    this.restorePlayerVolume();
                    window.setTimeout(() => {
                        this.player.playVideo();
                        window.setTimeout(() => {
                            if (this.room.playing && this.player.getPlayerState() !== 1) {
                                this.player.playVideo();
                            }
                        }, 250);
                        this.scheduleRemotePlayRetry(targetTime);
                    }, 50);
                } else {
                    this.player.pauseVideo();
                }
            } else {
                this.player.pauseVideo();
            }
            this.updatePlayerUIFromState(this.room);
            window.setTimeout(() => (this.suppressPlayerStateBroadcast = false), 350);
        };

        if (!this.player) {
            this.currentVideoId = remoteVideoId;
            return;
        }

        if (currentVideoId !== remoteVideoId) {
            this.currentVideoId = remoteVideoId;
            this.setPlayerVideo(remoteVideoId, targetTime);
            window.setTimeout(() => {
                applyPlayerState();
            }, 350);
            return;
        }

        applyPlayerState();
    }

    selectSong(index: number) {
        if (!this.room?.playlist?.[index]) return;
        this.room.currentSongIndex = index;
        this.room.currentTime = 0;
        this.room.playing = true;
        this.room.startedAt = Date.now();
        this.room.serverTimestamp = Date.now();
        this.currentVideoId = this.room.playlist[index].videoId;

        this.socketService.sendQueueState(this.roomId, this.roomSyncService.buildQueuePayload(this.roomId, this.room));

        requestAnimationFrame(() => {
            if (this.player) {
                this.suppressPlayerStateBroadcast = true;
                this.currentVideoId = this.room.playlist[index].videoId;
                this.player.videoId = this.currentVideoId;
                this.player.startSeconds = 0;
                setTimeout(() => {
                    this.player.playVideo();
                    window.setTimeout(() => {
                        this.room.currentTime = this.player.getCurrentTime();
                        this.room.startedAt = Date.now() - (this.room.currentTime * 1000);
                        this.room.serverTimestamp = Date.now();
                        this.suppressPlayerStateBroadcast = false;
                        this.socketService.sendPlayState(this.roomId, this.roomSyncService.buildPlayPayload(this.roomId, this.room, this.room.currentTime));
                    }, 250);
                }, 300);
            }
        });
    }

    playSong(index: number, event?: Event) {
        event?.preventDefault();
        event?.stopPropagation();
        this.selectSong(index);
    }

    togglePlayPause() {
        if (!this.room?.playlist?.length || !this.player) return;

        if (this.room.playing) {
            this.player.pauseVideo();
            this.room.playing = false;
            this.room.currentTime = this.player.getCurrentTime();
            this.room.serverTimestamp = Date.now();

            const nextState = {
                currentTime: Math.round(this.room.currentTime * 1000) / 1000,
                playing: false,
                songIndex: this.room.currentSongIndex,
                isSeeking: false,
            };
            if (!this.roomSyncService.shouldBroadcast(this.lastBroadcastState, { ...this.room, isSeeking: false })) return;
            this.lastBroadcastState = nextState;
            this.socketService.sendPlayState(this.roomId, this.roomSyncService.buildPlayPayload(this.roomId, this.room, this.room.currentTime));
            return;
        }

        this.room.playing = true;
        this.room.currentTime = this.player.getCurrentTime();
        this.room.startedAt = Date.now() - (this.room.currentTime * 1000);
        this.room.serverTimestamp = Date.now();
        this.player.playVideo();

        window.setTimeout(() => {
            if (!this.room?.playing) return;
            this.room.currentTime = this.player.getCurrentTime();
            this.room.startedAt = Date.now() - (this.room.currentTime * 1000);
            this.room.serverTimestamp = Date.now();
            this.scheduleRemotePlayRetry(this.room.currentTime);

            const nextState = {
                currentTime: Math.round(this.room.currentTime * 1000) / 1000,
                playing: true,
                songIndex: this.room.currentSongIndex,
                isSeeking: false,
            };
            if (!this.roomSyncService.shouldBroadcast(this.lastBroadcastState, { ...this.room, isSeeking: false })) return;
            this.lastBroadcastState = nextState;
            this.socketService.sendPlayState(this.roomId, this.roomSyncService.buildPlayPayload(this.roomId, this.room, this.room.currentTime));
        }, 120);
    }

    toggleMute() {
        if (!this.player) return;

        if (this.isMuted) {
            const restoredVolume = this.lastNonMutedVolume || this.volume || this.defaultVolume;
            this.volume = restoredVolume;
            this.player.setVolume(restoredVolume);
            this.player.unMute();
            this.isMuted = false;
            this.saveVolume(this.volume);
        } else {
            if (this.volume > 0) {
                this.lastNonMutedVolume = this.volume;
            }
            this.player.mute();
            this.isMuted = true;
            this.saveVolume(0);
        }
    }

    onVolumeChange(event: Event) {
        const target = event.target as HTMLInputElement;
        this.volume = Number(target.value);
        this.isMuted = this.volume === 0;
        if (this.volume > 0) {
            this.lastNonMutedVolume = this.volume;
        }
        this.saveVolume(this.volume);
        if (!this.player) return;
        this.player.setVolume(this.volume);
        if (this.isMuted) {
            this.player.mute();
        } else {
            this.player.unMute();
        }
    }

    resetVolume() {
        this.volume = this.defaultVolume;
        this.lastNonMutedVolume = this.defaultVolume;
        this.isMuted = false;
        this.saveVolume(this.volume);
        if (!this.player) return;
        this.player.setVolume(this.volume);
        this.player.unMute();
    }

    restartSong() {
        if (!this.player) return;
        this.player.seekTo(0, true);
        this.player.playVideo();
        this.room.playing = true;
        this.room.currentTime = 0;
        this.room.startedAt = Date.now();
        this.room.serverTimestamp = Date.now();
        this.socketService.sendPlayState(this.roomId, this.roomSyncService.buildPlayPayload(this.roomId, this.room, 0));
    }

    nextSong() {
        if (!this.room?.playlist?.length) return;
        const nextIndex = (this.room.currentSongIndex + 1) % this.room.playlist.length;
        this.selectSong(nextIndex);
    }

    seekByProgress(event: Event) {
        if (!this.player || !this.room?.playlist?.length) return;
        const target = event.target as HTMLInputElement;
        const progress = Number(target.value);
        const duration = this.player.getDuration();
        if (!duration) return;

        this.currentProgress = progress;
        const seekTime = (duration * progress) / 100;
        this.player.seekTo(seekTime, true);
        this.room.currentTime = seekTime;
        this.room.startedAt = Date.now() - (this.room.currentTime * 1000);
        this.room.isSeeking = true;
        this.room.serverTimestamp = Date.now();

        window.clearTimeout(this.seekBroadcastThrottleTimer);
        this.seekBroadcastThrottleTimer = window.setTimeout(() => {
            this.socketService.sendSeekState(this.roomId, this.roomSyncService.buildSeekPayload(this.roomId, this.room));
        }, 50);

        window.clearTimeout(this.seekDebounceTimer);
        this.seekDebounceTimer = window.setTimeout(() => {
            this.room.isSeeking = false;
            this.socketService.sendSeekState(this.roomId, this.roomSyncService.buildSeekPayload(this.roomId, this.room));
        }, 160);
    }

    updatePlayerUI() {
        if (!this.player) return;
        const duration = this.player.getDuration();
        const currentTime = this.player.getCurrentTime();
        this.currentProgress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
        this.isMuted = typeof this.player.isMuted === 'function' ? this.player.isMuted() : this.isMuted;
        if (!this.isMuted) {
            const actualVolume = typeof this.player.getVolume === 'function' ? this.player.getVolume() : this.volume;
            if (typeof actualVolume === 'number' && actualVolume > 0) {
                this.volume = actualVolume;
                this.lastNonMutedVolume = actualVolume;
            }
        }
    }

    updatePlayerUIFromState(remoteState: Room) {
        const duration = this.player?.getDuration?.() || 0;
        const currentTime = remoteState.currentTime || 0;
        this.currentProgress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : this.currentProgress;
    }

    formatTime(seconds: number): string {
        const totalSeconds = Math.max(0, Math.floor(seconds || 0));
        const minutes = Math.floor(totalSeconds / 60);
        const remainingSeconds = totalSeconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    startSyncLoop() {
        if (typeof window === 'undefined') return;
        window.clearInterval(this.syncTimer);
        this.syncTimer = window.setInterval(() => {
            if (!this.room?.playlist?.length || !this.player || !this.isHost) return;
            this.room.currentTime = this.player.getCurrentTime();
            this.room.playing = this.player.getPlayerState() === 1;
            this.room.startedAt = this.room.playing ? Date.now() - (this.room.currentTime * 1000) : 0;
            this.room.serverTimestamp = Date.now();
            this.socketService.sendPlayState(this.roomId, this.roomSyncService.buildPlayPayload(this.roomId, this.room, this.room.currentTime));
        }, 500);
    }

    startProgressSync() {
        if (typeof window === 'undefined') return;
        window.clearInterval(this.progressTimer);
        this.progressTimer = window.setInterval(() => {
            if (!this.player || !this.room?.playlist?.length) return;
            this.updatePlayerUI();
        }, 250);
    }

    onDragStart(index: number, event: DragEvent) {
        if (!this.isHost || !event.dataTransfer) return;
        this.draggedIndex = index;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
    }

    onDragOver(index: number, event: DragEvent) {
        if (!this.isHost) return;
        event.preventDefault();
        this.dragOverIndex = index;
    }

    onDragEnd() {
        this.dragOverIndex = null;
        this.draggedIndex = null;
    }

    toggleLike(index: number, event: MouseEvent) {
        event.stopPropagation();
        if (!this.room?.playlist?.[index]) return;
        this.room.playlist[index].liked = !this.room.playlist[index].liked;
        this.socketService.sendQueueState(this.roomId, this.roomSyncService.buildQueuePayload(this.roomId, this.room));
    }

    removeSong(index: number, event: MouseEvent) {
        event.stopPropagation();
        if (!this.isHost || !this.room?.playlist?.[index]) return;
        const wasCurrent = this.room.currentSongIndex === index;
        this.room.playlist.splice(index, 1);
        if (this.room.playlist.length === 0) {
            this.room.currentSongIndex = 0;
            this.room.playing = false;
            this.room.currentTime = 0;
        } else if (wasCurrent) {
            this.room.currentSongIndex = Math.min(index, this.room.playlist.length - 1);
            this.room.currentTime = 0;
            this.room.playing = true;
        } else if (index < this.room.currentSongIndex) {
            this.room.currentSongIndex -= 1;
        }
        this.socketService.sendQueueState(this.roomId, this.roomSyncService.buildQueuePayload(this.roomId, this.room));
    }

    dropSong(event: CdkDragDrop<Song[]>) {
        if (!this.isHost || event.previousIndex === event.currentIndex) return;
        moveItemInArray(this.room.playlist, event.previousIndex, event.currentIndex);
        if (this.room.currentSongIndex === event.previousIndex) {
            this.room.currentSongIndex = event.currentIndex;
        } else if (event.previousIndex < this.room.currentSongIndex && event.currentIndex >= this.room.currentSongIndex) {
            this.room.currentSongIndex -= 1;
        } else if (event.previousIndex > this.room.currentSongIndex && event.currentIndex <= this.room.currentSongIndex) {
            this.room.currentSongIndex += 1;
        }
        this.dragOverIndex = null;
        this.draggedIndex = null;
        this.socketService.sendQueueState(this.roomId, this.roomSyncService.buildQueuePayload(this.roomId, this.room));
    }

    sendChat() {
        if (this.newMessage.trim()) {
            const msg: ChatMessage = { sender: this.userId, content: this.newMessage, type: 'CHAT' };
            this.socketService.sendChatMessage(this.roomId, msg);
            this.newMessage = '';
        }
    }

    addSong(song: Song) {
        if (!this.room?.playlist) return;

        const exists = this.room.playlist.some(item => item.videoId === song.videoId);
        if (!exists) {
            this.room.playlist = [...this.room.playlist, song];
        }

        this.socketService.sendAddSong(this.roomId, song);
        this.searchResults = [];
        this.searchQuery = '';
        this.activeSuggestion = null;
    }

    searchBySuggestion(suggestion: string) {
        this.activeSuggestion = suggestion;
        this.searchYouTube(suggestion);
    }

    sendInitialSyncRequest() {
        if (!this.room?.playlist?.length || this.isHost || this.joinedStateApplied) return;
        this.joinedStateApplied = true;
        const payload: SyncRequestPayload = { type: SyncMessageType.SYNC_REQUEST, roomId: this.roomId, userId: this.userId };
        this.socketService.requestSync(this.roomId, payload);
    }

    sendMemberSyncRequest() {
        // removed duplicate websocket join call to avoid double member entries
    }

    private syncVoiceMembers() {
        const members = (this.room?.members || [])
            .map((m) => this.resolveMemberName(m))
            .filter((name) => !!name);
        this.voiceChatService.updateMembers(members);
    }

    async toggleVoiceChat() {
        try {
            if (this.isVoiceEnabled) {
                this.voiceChatService.disableVoice();
                this.isVoiceEnabled = false;
                this.isMicMuted = true;
                return;
            }
            await this.voiceChatService.enableVoice();
            this.isVoiceEnabled = this.voiceChatService.isVoiceEnabled;
            this.isMicMuted = this.voiceChatService.isMicMuted;
            this.syncVoiceMembers();
        } catch (error) {
            console.error('Enable voice failed', error);
            this.showToastMessage('Không bật được micro. Hãy cấp quyền micro và thử lại.');
        }
    }

    toggleMicMute() {
        if (!this.isVoiceEnabled) return;
        this.voiceChatService.toggleMicMute();
        this.isMicMuted = this.voiceChatService.isMicMuted;
    }

    ngOnDestroy() {
        if (typeof window !== 'undefined') {
            window.clearInterval(this.progressTimer);
            window.clearInterval(this.syncTimer);
            window.clearTimeout(this.seekDebounceTimer);
            window.clearTimeout(this.seekBroadcastThrottleTimer);
        }
        if (this.roomId && this.userId && this.hasJoinedRoom) {
            try {
                this.socketService.leaveRoom(this.roomId, this.userId);
            } catch {
                // ignore disconnect race
            }
            this.hasJoinedRoom = false;
        }
        this.voiceChatService.disableVoice();
        this.socketService.disconnect();
    }
}
