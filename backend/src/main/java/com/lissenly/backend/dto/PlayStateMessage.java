package com.lissenly.backend.dto;

import com.lissenly.backend.entity.SyncMessageType;

import lombok.Data;

@Data
public class PlayStateMessage {
    private SyncMessageType type = SyncMessageType.PLAY_STATE;
    private String roomId;
    private String hostId;
    private int currentSongIndex;
    private double currentTime;
    private boolean playing;
    private long startedAt;
    private long serverTimestamp;
    private boolean seeking = false;
}
