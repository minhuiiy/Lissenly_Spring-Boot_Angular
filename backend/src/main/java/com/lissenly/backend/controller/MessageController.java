package com.lissenly.backend.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import com.lissenly.backend.dto.PlayStateMessage;
import com.lissenly.backend.dto.QueueStateMessage;
import com.lissenly.backend.dto.SeekStateMessage;
import com.lissenly.backend.dto.SyncRequestMessage;
import com.lissenly.backend.entity.ChatMessage;
import com.lissenly.backend.entity.Room;
import com.lissenly.backend.entity.Song;
import com.lissenly.backend.service.RoomService;

@Controller
public class MessageController {
    @Autowired
    private RoomService roomService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat/{roomId}")
    @SendTo("/topic/room/{roomId}")
    public ChatMessage sendMessage(@DestinationVariable String roomId, ChatMessage message) {
        return message;
    }

    @MessageMapping("/member/join/{roomId}")
    public void joinMember(@DestinationVariable String roomId, @Payload Map<String, Object> payload) {
        String userId = payload == null ? null : String.valueOf(payload.get("userId"));
        String displayName = payload == null ? null : String.valueOf(payload.get("displayName"));
        Room room = roomService.joinRoom(roomId, userId, displayName);
        if (room == null) {
            return;
        }
        messagingTemplate.convertAndSend("/topic/room/" + room.getRoomId(), Map.of(
            "type", "ROOM_MEMBERS",
            "event", "JOIN",
            "roomId", room.getRoomId(),
            "members", room.getMembers(),
            "hostId", room.getHostId(),
            "userId", userId,
            "displayName", displayName
        ));
    }

    @MessageMapping("/member/leave/{roomId}")
    public void leaveMember(@DestinationVariable String roomId, @Payload Map<String, Object> payload) {
        String userId = payload == null ? null : String.valueOf(payload.get("userId"));
        roomService.leaveRoom(roomId, userId);
        Room room = roomService.getRoom(roomId);
        if (room == null) {
            return;
        }
        messagingTemplate.convertAndSend("/topic/room/" + room.getRoomId(), Map.of(
            "type", "ROOM_MEMBERS",
            "event", "LEAVE",
            "roomId", room.getRoomId(),
            "members", room.getMembers(),
            "hostId", room.getHostId(),
            "userId", userId
        ));
    }

    @MessageMapping("/sync/play/{roomId}")
    @SendTo("/topic/room/{roomId}")
    public PlayStateMessage syncPlayState(@DestinationVariable String roomId, @Payload PlayStateMessage updateInfo) {
        Room room = roomService.getRoom(roomId);
        if (room == null || updateInfo == null) {
            return updateInfo;
        }

        room.setPlaying(updateInfo.isPlaying());
        room.setCurrentSongIndex(updateInfo.getCurrentSongIndex());
        room.setCurrentTime(updateInfo.getCurrentTime());
        room.setStartedAt(updateInfo.getStartedAt());
        room.setServerTimestamp(System.currentTimeMillis());
        room.setSeeking(false);

        updateInfo.setServerTimestamp(room.getServerTimestamp());
        updateInfo.setSeeking(false);
        updateInfo.setRoomId(room.getRoomId());
        updateInfo.setHostId(room.getHostId());
        return updateInfo;
    }

    @MessageMapping("/sync/seek/{roomId}")
    @SendTo("/topic/room/{roomId}")
    public SeekStateMessage syncSeekState(@DestinationVariable String roomId, @Payload SeekStateMessage updateInfo) {
        Room room = roomService.getRoom(roomId);
        if (room == null || updateInfo == null) {
            return updateInfo;
        }

        room.setPlaying(updateInfo.isPlaying());
        room.setCurrentSongIndex(updateInfo.getCurrentSongIndex());
        room.setCurrentTime(updateInfo.getCurrentTime());
        room.setStartedAt(updateInfo.getStartedAt());
        room.setServerTimestamp(System.currentTimeMillis());
        room.setSeeking(true);

        updateInfo.setServerTimestamp(room.getServerTimestamp());
        updateInfo.setSeeking(true);
        updateInfo.setRoomId(room.getRoomId());
        updateInfo.setHostId(room.getHostId());
        return updateInfo;
    }

    @MessageMapping("/sync/queue/{roomId}")
    @SendTo("/topic/room/{roomId}")
    public QueueStateMessage syncQueueState(@DestinationVariable String roomId, @Payload QueueStateMessage updateInfo) {
        Room room = roomService.getRoom(roomId);
        if (room == null || updateInfo == null) {
            return updateInfo;
        }

        if (updateInfo.getPlaylist() != null) {
            room.setPlaylist(updateInfo.getPlaylist());
        }
        room.setCurrentSongIndex(updateInfo.getCurrentSongIndex());
        room.setCurrentTime(updateInfo.getCurrentTime());
        room.setPlaying(updateInfo.isPlaying());
        room.setStartedAt(updateInfo.getStartedAt());
        room.setServerTimestamp(System.currentTimeMillis());
        room.setSeeking(false);

        updateInfo.setServerTimestamp(room.getServerTimestamp());
        updateInfo.setSeeking(false);
        updateInfo.setRoomId(room.getRoomId());
        updateInfo.setHostId(room.getHostId());
        updateInfo.setPlaylist(room.getPlaylist());
        return updateInfo;
    }

    @MessageMapping("/sync-request/{roomId}")
    @SendTo("/topic/room/{roomId}")
    public QueueStateMessage syncRequest(@DestinationVariable String roomId, @Payload SyncRequestMessage payload) {
        Room room = roomService.getRoom(roomId);
        if (room == null) {
            return null;
        }

        QueueStateMessage message = new QueueStateMessage();
        message.setRoomId(room.getRoomId());
        message.setHostId(room.getHostId());
        message.setPlaylist(room.getPlaylist());
        message.setCurrentSongIndex(room.getCurrentSongIndex());
        message.setCurrentTime(room.getCurrentTime());
        message.setPlaying(room.isPlaying());
        message.setStartedAt(room.getStartedAt());
        message.setServerTimestamp(room.getServerTimestamp());
        message.setSeeking(room.isSeeking());
        return message;
    }

    @MessageMapping("/playlist/add/{roomId}")
    @SendTo("/topic/room/{roomId}")
    public QueueStateMessage addSong(@DestinationVariable String roomId, Song song) {
        roomService.addSong(roomId, song);
        Room room = roomService.getRoom(roomId);
        if (room == null) {
            return null;
        }

        QueueStateMessage message = new QueueStateMessage();
        message.setRoomId(room.getRoomId());
        message.setHostId(room.getHostId());
        message.setPlaylist(room.getPlaylist());
        message.setCurrentSongIndex(room.getCurrentSongIndex());
        message.setCurrentTime(room.getCurrentTime());
        message.setPlaying(room.isPlaying());
        message.setStartedAt(room.getStartedAt());
        message.setServerTimestamp(System.currentTimeMillis());
        message.setSeeking(false);
        return message;
    }

    @MessageMapping("/voice/signal/{roomId}")
    public void relayVoiceSignal(@DestinationVariable String roomId, @Payload Map<String, Object> payload) {
        if (payload == null) {
            return;
        }

        Map<String, Object> signal = new HashMap<>(payload);
        signal.put("roomId", roomId);
        messagingTemplate.convertAndSend("/topic/room/" + roomId, signal);
    }
}
