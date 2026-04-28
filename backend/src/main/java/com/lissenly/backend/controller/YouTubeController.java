package com.lissenly.backend.controller;

import com.lissenly.backend.entity.Song;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/youtube")
@CrossOrigin(origins = "*")
public class YouTubeController {

    @Value("${youtube.api.key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    @GetMapping("/search")
    public List<Song> search(@RequestParam String q) {
        try {
            String videoId = extractVideoId(q);
            
            if (videoId != null) {
                // Handle single video URL
                String url = "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" + videoId + "&key=" + apiKey;
                System.out.println("Calling YouTube Video Details API: " + url);
                Map<String, Object> response = restTemplate.getForObject(url, Map.class);
                System.out.println("Video details response: " + response);
                
                if (response != null && response.containsKey("items")) {
                    List<Map<String, Object>> items = (List<Map<String, Object>>) response.get("items");
                    if (!items.isEmpty()) {
                        Map<String, Object> item = items.get(0);
                        Map<String, Object> snippet = (Map<String, Object>) item.get("snippet");
                        Song song = mapToSong(videoId, snippet);
                        return List.of(song);
                    }
                }
            }

            // Normal search
            String encodedQuery = java.net.URLEncoder.encode(q, java.nio.charset.StandardCharsets.UTF_8);
            String url = "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=" + encodedQuery + "&key=" + apiKey;
            System.out.println("Calling YouTube API: " + url);
            
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            System.out.println("Response from YouTube: " + response);
            
            if (response == null || !response.containsKey("items")) {
                System.out.println("No items in response");
                return new ArrayList<>();
            }

            List<Map<String, Object>> items = (List<Map<String, Object>>) response.get("items");
            List<Song> songs = new ArrayList<>();
            for (Map<String, Object> item : items) {
                Map<String, Object> snippet = (Map<String, Object>) item.get("snippet");
                Map<String, Object> idMap = (Map<String, Object>) item.get("id");
                songs.add(mapToSong((String) idMap.get("videoId"), snippet));
            }
            return songs;
        } catch (Exception e) {
            e.printStackTrace();
            return new ArrayList<>();
        }
    }

    private String extractVideoId(String query) {
        if (query.contains("youtube.com/watch?v=")) {
            return query.split("v=")[1].split("&")[0];
        } else if (query.contains("youtu.be/")) {
            return query.split("youtu.be/")[1].split("\\?")[0];
        }
        return null;
    }

    private Song mapToSong(String videoId, Map<String, Object> snippet) {
        Song song = new Song();
        song.setVideoId(videoId);
        song.setTitle((String) snippet.get("title"));
        song.setChannelTitle((String) snippet.get("channelTitle"));
        
        Map<String, Object> thumbnails = (Map<String, Object>) snippet.get("thumbnails");
        Map<String, Object> mediumThumb = (Map<String, Object>) thumbnails.get("medium");
        if (mediumThumb == null) mediumThumb = (Map<String, Object>) thumbnails.get("default");
        song.setThumbnail((String) mediumThumb.get("url"));
        return song;
    }
}
