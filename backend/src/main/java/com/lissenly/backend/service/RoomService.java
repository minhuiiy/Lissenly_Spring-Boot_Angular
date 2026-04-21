package com.lissenly.backend.service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import com.lissenly.backend.entity.Room;
import com.lissenly.backend.entity.Song;

@Service
public class RoomService {
    private final Map<String, Room> activeRooms = new ConcurrentHashMap<>();

    public Room createRoom(String hostId) {
        String roomId = UUID.randomUUID().toString().substring(0, 8); // Tạo mã phòng ngắn
        Room room = new Room();
        room.setRoomId(roomId);
        room.setHostId(hostId);
        activeRooms.put(roomId, room);
        return room;
    }

    public Room getRoom(String roomId) {
        return activeRooms.get(roomId);
    }

    public void addSong(String roomId, Song song) {
        Room room = activeRooms.get(roomId);
        if (room != null) {
            room.getPlaylist().add(song);
        }
    }
}
