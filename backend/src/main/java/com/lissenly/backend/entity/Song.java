package com.lissenly.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Song {
    private String videoId;
    private String title;
    private String thumbnail;
}
