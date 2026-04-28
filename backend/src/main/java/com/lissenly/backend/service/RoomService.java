package com.lissenly.backend.service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.lissenly.backend.entity.Room;
import com.lissenly.backend.entity.RoomMember;
import com.lissenly.backend.entity.Song;

@Service
public class RoomService {
    private static final long ORPHAN_ROOM_TTL_MS = 10 * 60 * 1000L;
    private final Map<String, Room> activeRooms = new ConcurrentHashMap<>();

    private String normalizeRoomId(String roomId) {
        return roomId == null ? null : roomId.trim().replaceAll("[\\s-]+", "").toUpperCase();
    }

    public Room createRoom(String hostId, String roomName, Boolean isPrivate) {
        String roomId = UUID.randomUUID().toString().substring(0, 8).toUpperCase(); // Tạo mã phòng ngắn
        Room room = new Room();
        room.setRoomId(roomId);
        room.setHostId(hostId);
        room.setName(roomName == null || roomName.trim().isEmpty() ? "Phòng của " + hostId : roomName.trim());
        room.setPrivate(Boolean.TRUE.equals(isPrivate));
        room.setEmptySince(System.currentTimeMillis());
        activeRooms.put(roomId, room);
        return room;
    }

    private Room findRoom(String roomId) {
        String normalized = normalizeRoomId(roomId);
        Room room = activeRooms.get(normalized);
        if (room != null) {
            return room;
        }

        // Fallback for rooms that may have been created before normalization changed
        if (roomId != null) {
            room = activeRooms.get(roomId.trim());
            if (room != null) {
                return room;
            }
            room = activeRooms.get(roomId.trim().toLowerCase());
        }
        return room;
    }

    public Room getRoom(String roomId) {
        return findRoom(roomId);
    }

    public boolean roomExists(String roomId) {
        return findRoom(roomId) != null;
    }

    public Room joinRoom(String roomId, String userId, String displayName) {
        Room room = findRoom(roomId);
        if (room != null && userId != null) {
            String normalizedUser = userId.trim();
            String normalizedDisplayName = displayName == null || displayName.trim().isEmpty() ? normalizedUser : displayName.trim();
            room.getMembers().removeIf(member -> member != null && normalizedUser.equalsIgnoreCase(member.getUserId()));
            room.getMembers().add(new RoomMember(normalizedUser, normalizedDisplayName));
            room.setEmptySince(0L);
        }
        return room;
    }

    public void leaveRoom(String roomId, String userId) {
        Room room = findRoom(roomId);
        if (room != null && userId != null) {
            String normalizedUser = userId.trim();
            room.getMembers().removeIf(member -> member != null && normalizedUser.equalsIgnoreCase(member.getUserId()));

            if (room.getMembers().isEmpty()) {
                room.setEmptySince(System.currentTimeMillis());
            }
        }
    }

    public java.util.List<Room> getPublicRooms() {
        return activeRooms.values().stream()
                .filter(room -> room != null && !room.isPrivate())
                .filter(room -> room.getMembers() != null && !room.getMembers().isEmpty())
                .toList();
    }

    @Scheduled(fixedDelay = 60_000)
    public void cleanupOrphanRooms() {
        long now = System.currentTimeMillis();
        activeRooms.values().removeIf(room -> room != null
                && (room.getMembers() == null || room.getMembers().isEmpty())
                && room.getEmptySince() > 0
                && (now - room.getEmptySince()) >= ORPHAN_ROOM_TTL_MS);
    }

    public void addSong(String roomId, Song song) {
        Room room = findRoom(roomId);
        if (room != null) {
            room.getPlaylist().add(song);
        }
    }
}
