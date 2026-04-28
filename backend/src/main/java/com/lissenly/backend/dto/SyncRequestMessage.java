package com.lissenly.backend.dto;

import com.lissenly.backend.entity.SyncMessageType;

import lombok.Data;

@Data
public class SyncRequestMessage {
    private SyncMessageType type = SyncMessageType.SYNC_REQUEST;
    private String roomId;
    private String userId;
}
