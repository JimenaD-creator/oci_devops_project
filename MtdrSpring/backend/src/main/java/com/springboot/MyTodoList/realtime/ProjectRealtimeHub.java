package com.springboot.MyTodoList.realtime;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class ProjectRealtimeHub {

    private static final Logger logger = LoggerFactory.getLogger(ProjectRealtimeHub.class);
    private static final long EMITTER_TIMEOUT_MS = 30L * 60 * 1000;

    private final ObjectMapper objectMapper;
    private final boolean enabled;
    private final ConcurrentHashMap<Long, CopyOnWriteArrayList<SseEmitter>> subscribers =
            new ConcurrentHashMap<>();

    public ProjectRealtimeHub(
            ObjectMapper objectMapper,
            @Value("${app.realtime.sse.enabled:true}") boolean enabled) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
    }

    public SseEmitter subscribe(Long projectId) {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
        subscribers.computeIfAbsent(projectId, ignored -> new CopyOnWriteArrayList<>()).add(emitter);

        Runnable remove = () -> removeEmitter(projectId, emitter);
        emitter.onCompletion(remove);
        emitter.onTimeout(remove);
        emitter.onError(ex -> remove.run());

        try {
            emitter.send(SseEmitter.event().name("connected").data("{\"status\":\"ok\"}"));
        } catch (IOException ex) {
            logger.debug("SSE connect failed for project {}: {}", projectId, ex.getMessage());
            remove.run();
        }
        return emitter;
    }

    public void broadcast(Long projectId, ProjectTaskEvent event) {
        if (!enabled || projectId == null || event == null) {
            return;
        }
        CopyOnWriteArrayList<SseEmitter> list = subscribers.get(projectId);
        if (list == null || list.isEmpty()) {
            return;
        }
        String json;
        try {
            json = objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException ex) {
            logger.warn("Could not serialize project task event: {}", ex.getMessage());
            return;
        }
        for (SseEmitter emitter : List.copyOf(list)) {
            try {
                emitter.send(SseEmitter.event().name("project-task-event").data(json));
            } catch (Exception ex) {
                removeEmitter(projectId, emitter);
            }
        }
    }

    @Scheduled(fixedDelayString = "${app.realtime.sse.heartbeat-ms:25000}")
    public void heartbeat() {
        if (!enabled) {
            return;
        }
        subscribers.forEach((projectId, list) -> {
            for (SseEmitter emitter : List.copyOf(list)) {
                try {
                    emitter.send(SseEmitter.event().name("ping").comment("keepalive"));
                } catch (Exception ex) {
                    removeEmitter(projectId, emitter);
                }
            }
        });
    }

    private void removeEmitter(Long projectId, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> list = subscribers.get(projectId);
        if (list == null) {
            return;
        }
        list.remove(emitter);
        if (list.isEmpty()) {
            subscribers.remove(projectId, list);
        }
    }
}
