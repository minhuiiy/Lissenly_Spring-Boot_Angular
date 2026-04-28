package com.lissenly.backend.dto;

import java.util.List;

import com.lissenly.backend.entity.Song;
import com.lissenly.backend.entity.SyncMessageType;

import lombok.Data;

@Data
public class QueueStateMessage {
    private SyncMessageType type = SyncMessageType.QUEUE_STATE;
    private String roomId;
    private String hostId;
    private List<Song> playlist;
    private int currentSongIndex;
    private double currentTime;
    private boolean playing;
    private long startedAt;
    private long serverTimestamp;
    private boolean seeking = false;
}
