package com.lissenly.backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import com.lissenly.backend.entity.ChatMessage;
import com.lissenly.backend.entity.Room;
import com.lissenly.backend.entity.Song;
import com.lissenly.backend.service.RoomService;

@Controller
public class MessageController {
    @Autowired
    private RoomService roomService;

    // Xử lý chat
    @MessageMapping("/chat/{roomId}")
    @SendTo("/topic/room/{roomId}")
    public ChatMessage sendMessage(@DestinationVariable String roomId, ChatMessage message) {
        return message;
    }

    // Xử lý Đồng bộ nhạc (Play/Pause/Seek)
    @MessageMapping("/sync/{roomId}")
    @SendTo("/topic/room/{roomId}")
    public Room syncPlaylist(@DestinationVariable String roomId, Room updateInfo) {
        Room room = roomService.getRoom(roomId);
        if (room != null) {
            room.setPlaying(updateInfo.isPlaying());
            room.setCurrentTime(updateInfo.getCurrentTime());
            room.setCurrentSongIndex(updateInfo.getCurrentSongIndex());
        }
        return room;
    }

    // Thêm bài hát vào Playlist
    @MessageMapping("/playlist/add/{roomId}")
    @SendTo("/topic/room/{roomId}")
    public Song addSong(@DestinationVariable String roomId, Song song) {
        roomService.addSong(roomId, song);
        return song;
    }
}
