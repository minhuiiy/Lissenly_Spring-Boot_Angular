package com.lissenly.backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.lissenly.backend.entity.Room;
import com.lissenly.backend.service.RoomService;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*")
public class RoomController {
    @Autowired
    private RoomService roomService;

    @PostMapping("/create")
    public Room createRoom(
            @RequestParam String hostId,
            @RequestParam(required = false) String roomName,
            @RequestParam(required = false) Boolean isPrivate) {
        return roomService.createRoom(hostId, roomName, isPrivate);
    }

    @GetMapping("/public")
    public java.util.List<Room> getPublicRooms() {
        return roomService.getPublicRooms();
    }

    @GetMapping("/{roomId}")
    public Room getRoom(@PathVariable String roomId) {
        return roomService.getRoom(roomId);
    }

    @GetMapping("/{roomId}/exists")
    public ResponseEntity<?> roomExists(@PathVariable String roomId) {
        if (roomService.roomExists(roomId)) {
            return ResponseEntity.ok().body(java.util.Map.of("exists", true, "roomId", roomId.toUpperCase()));
        }
        return ResponseEntity.status(404).body(java.util.Map.of("exists", false, "message", "Room not found"));
    }

    @PostMapping("/{roomId}/join")
    public ResponseEntity<?> joinRoom(@PathVariable String roomId, @RequestParam String userId, @RequestParam(required = false) String displayName) {
        Room room = roomService.joinRoom(roomId, userId, displayName);
        if (room == null) {
            return ResponseEntity.status(404).body(java.util.Map.of("message", "Room not found"));
        }
        String resolvedDisplayName = (displayName == null || displayName.trim().isEmpty()) ? userId : displayName.trim();
        return ResponseEntity.ok().body(java.util.Map.of(
            "message", "Joined room",
            "roomId", room.getRoomId(),
            "userId", userId,
            "displayName", resolvedDisplayName,
            "members", room.getMembers()
        ));
    }

    @PostMapping("/{roomId}/leave")
    public ResponseEntity<?> leaveRoom(@PathVariable String roomId, @RequestParam String userId) {
        roomService.leaveRoom(roomId, userId);
        Room room = roomService.getRoom(roomId);
        if (room == null) {
            return ResponseEntity.status(404).body(java.util.Map.of("message", "Room not found"));
        }
        return ResponseEntity.ok().body(java.util.Map.of(
            "message", "Left room",
            "roomId", room.getRoomId(),
            "userId", userId,
            "members", room.getMembers()
        ));
    }
}
