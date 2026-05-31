package com.springboot.MyTodoList.realtime;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class ProjectRealtimeHubTest {

    private ProjectRealtimeHub hub;

    @BeforeEach
    void setUp() {
        hub = new ProjectRealtimeHub(new ObjectMapper(), true);
    }

    @Test
    void broadcastDoesNotThrowWhenNoSubscribers() {
        ProjectTaskEvent event = ProjectTaskEvent.of("task-updated", 1L, 10L, 2L, "test");
        assertDoesNotThrow(() -> hub.broadcast(1L, event));
    }

    @Test
    void subscribeAndBroadcastDoesNotThrow() {
        SseEmitter emitter = hub.subscribe(5L);
        ProjectTaskEvent event = ProjectTaskEvent.of("blocker-reported", 5L, 99L, 3L, "test");
        assertDoesNotThrow(() -> hub.broadcast(5L, event));
        emitter.complete();
    }
}
