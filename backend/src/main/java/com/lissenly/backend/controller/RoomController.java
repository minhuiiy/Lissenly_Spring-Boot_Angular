package com.lissenly.backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
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
    public Room createRoom(@RequestParam String hostId) {
        return roomService.createRoom(hostId);
    }

    @GetMapping("/{roomId}")
    public Room getRoom(@PathVariable String roomId) {
        return roomService.getRoom(roomId);
    }
}
