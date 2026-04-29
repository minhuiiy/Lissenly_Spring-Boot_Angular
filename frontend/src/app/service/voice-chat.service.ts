import { Injectable } from '@angular/core';
import { SocketService } from './socket.service';
import { SyncMessageType, VoiceSignalPayload } from '../models/types';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class VoiceChatService {
    private roomId = '';
    private userId = '';
    private members: string[] = [];
    private localStream: MediaStream | null = null;
    private peerConnections = new Map<string, RTCPeerConnection>();
    private remoteStreams = new Map<string, MediaStream>();
    private remoteAudios = new Map<string, HTMLAudioElement>();
    private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();

    isVoiceEnabled = false;
    isMicMuted = true;

    private rtcConfig: RTCConfiguration = {
        iceServers: environment.rtc?.iceServers ?? [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ],
        iceTransportPolicy: 'all'
    };

    constructor(private socketService: SocketService) { }

    init(roomId: string, userId: string) {
        this.roomId = roomId;
        this.userId = userId;
    }

    updateMembers(memberIds: string[]) {
        this.members = memberIds.filter(id => !!id && id !== this.userId);
        if (!this.isVoiceEnabled) return;
        this.members.forEach((id) => {
            if (!this.peerConnections.has(id) && this.shouldInitiate(id)) {
                this.createOfferTo(id).catch((err) => console.error('Voice offer error', err));
            }
        });
    }

    async enableVoice() {
        if (this.isVoiceEnabled) return;
        this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });
        this.isVoiceEnabled = true;
        this.isMicMuted = false;
        this.setTrackEnabled(true);

        for (const memberId of this.members) {
            if (this.shouldInitiate(memberId)) {
                await this.createOfferTo(memberId);
            }
        }
    }

    disableVoice() {
        this.isVoiceEnabled = false;
        this.isMicMuted = true;

        this.localStream?.getTracks().forEach((track) => track.stop());
        this.localStream = null;

        this.peerConnections.forEach((pc) => pc.close());
        this.peerConnections.clear();

        this.remoteAudios.forEach((audio) => {
            try { audio.pause(); } catch {}
            audio.srcObject = null;
            audio.remove();
        });
        this.remoteAudios.clear();
        this.remoteStreams.clear();
        this.pendingCandidates.clear();
    }

    toggleMicMute() {
        if (!this.isVoiceEnabled) return;
        this.isMicMuted = !this.isMicMuted;
        this.setTrackEnabled(!this.isMicMuted);
    }

    private setTrackEnabled(enabled: boolean) {
        this.localStream?.getAudioTracks().forEach((track) => {
            track.enabled = enabled;
        });
    }

    async handleSignal(signal: VoiceSignalPayload) {
        if (!this.isVoiceEnabled) return;
        if (!signal || signal.fromUserId === this.userId) return;
        if (signal.toUserId && signal.toUserId !== this.userId) return;

        const from = signal.fromUserId;
        const pc = this.getOrCreatePeerConnection(from);

        if (signal.type === SyncMessageType.VOICE_OFFER) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
            await this.flushPendingCandidates(from, pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this.sendSignal({
                type: SyncMessageType.VOICE_ANSWER,
                roomId: this.roomId,
                fromUserId: this.userId,
                toUserId: from,
                payload: answer
            });
            return;
        }

        if (signal.type === SyncMessageType.VOICE_ANSWER) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
            await this.flushPendingCandidates(from, pc);
            return;
        }

        if (signal.type === SyncMessageType.VOICE_ICE_CANDIDATE) {
            const candidate = signal.payload as RTCIceCandidateInit;
            if (!pc.remoteDescription) {
                const current = this.pendingCandidates.get(from) ?? [];
                current.push(candidate);
                this.pendingCandidates.set(from, current);
            } else {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        }
    }

    private async createOfferTo(peerId: string) {
        const pc = this.getOrCreatePeerConnection(peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.sendSignal({
            type: SyncMessageType.VOICE_OFFER,
            roomId: this.roomId,
            fromUserId: this.userId,
            toUserId: peerId,
            payload: offer
        });
    }

    private getOrCreatePeerConnection(peerId: string): RTCPeerConnection {
        const existing = this.peerConnections.get(peerId);
        if (existing) return existing;

        const pc = new RTCPeerConnection(this.rtcConfig);

        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream as MediaStream));
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal({
                    type: SyncMessageType.VOICE_ICE_CANDIDATE,
                    roomId: this.roomId,
                    fromUserId: this.userId,
                    toUserId: peerId,
                    payload: event.candidate.toJSON()
                });
            }
        };

        pc.ontrack = (event) => {
            const stream = event.streams[0];
            if (!stream) return;
            this.remoteStreams.set(peerId, stream);

            let audio = this.remoteAudios.get(peerId);
            if (!audio) {
                audio = document.createElement('audio');
                audio.autoplay = true;
                audio.setAttribute('playsinline', 'true');
                audio.style.display = 'none';
                document.body.appendChild(audio);
                this.remoteAudios.set(peerId, audio);
            }
            audio.srcObject = stream;
        };

        pc.onconnectionstatechange = () => {
            if (['closed', 'failed', 'disconnected'].includes(pc.connectionState)) {
                this.cleanupPeer(peerId);
            }
        };

        this.peerConnections.set(peerId, pc);
        return pc;
    }

    private cleanupPeer(peerId: string) {
        const pc = this.peerConnections.get(peerId);
        if (pc) {
            try { pc.close(); } catch {}
            this.peerConnections.delete(peerId);
        }

        const audio = this.remoteAudios.get(peerId);
        if (audio) {
            try { audio.pause(); } catch {}
            audio.srcObject = null;
            audio.remove();
            this.remoteAudios.delete(peerId);
        }

        this.remoteStreams.delete(peerId);
        this.pendingCandidates.delete(peerId);
    }

    private async flushPendingCandidates(peerId: string, pc: RTCPeerConnection) {
        const queued = this.pendingCandidates.get(peerId);
        if (!queued?.length) return;
        for (const c of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        this.pendingCandidates.delete(peerId);
    }

    private shouldInitiate(peerId: string): boolean {
        return this.userId.localeCompare(peerId) > 0;
    }

    private sendSignal(payload: VoiceSignalPayload) {
        this.socketService.sendVoiceSignal(this.roomId, payload);
    }
}
