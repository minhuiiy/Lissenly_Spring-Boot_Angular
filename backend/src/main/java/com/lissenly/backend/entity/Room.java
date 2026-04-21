package com.lissenly.backend.entity;

import java.util.ArrayList;
import java.util.List;

import lombok.Data;

@Data
public class Room {
    private String roomId;
    private String hostId;
    private List<Song> playlist = new ArrayList<>();
    private int currentSongIndex = 0;
    private double currentTime = 0.0; // Thời gian hiện tại của bài hát
    private boolean playing = false;
}
