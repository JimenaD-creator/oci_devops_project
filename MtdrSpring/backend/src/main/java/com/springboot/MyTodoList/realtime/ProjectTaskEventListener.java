package com.springboot.MyTodoList.realtime;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class ProjectTaskEventListener {

    private final ProjectRealtimeHub hub;

    public ProjectTaskEventListener(ProjectRealtimeHub hub) {
        this.hub = hub;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onProjectTaskEvent(ProjectTaskEvent event) {
        if (event == null || event.getProjectId() == null) {
            return;
        }
        hub.broadcast(event.getProjectId(), event);
    }
}
