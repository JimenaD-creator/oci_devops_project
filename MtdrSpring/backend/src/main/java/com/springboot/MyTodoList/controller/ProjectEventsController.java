package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.realtime.ProjectRealtimeHub;
import com.springboot.MyTodoList.service.ProjectAccessAuthorization;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(origins = "http://localhost:3000")
public class ProjectEventsController {

    private final ProjectRealtimeHub hub;
    private final ProjectAccessAuthorization projectAccessAuthorization;
    private final boolean enabled;

    public ProjectEventsController(
            ProjectRealtimeHub hub,
            ProjectAccessAuthorization projectAccessAuthorization,
            @Value("${app.realtime.sse.enabled:true}") boolean enabled) {
        this.hub = hub;
        this.projectAccessAuthorization = projectAccessAuthorization;
        this.enabled = enabled;
    }

    @GetMapping(value = "/{projectId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe(@PathVariable Long projectId) {
        if (!enabled) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        if (!projectAccessAuthorization.userMayAccessProject(projectId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return hub.subscribe(projectId);
    }
}
