package com.springboot.MyTodoList.realtime;

import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Each API replica polls shared DB events and broadcasts to its local SSE subscribers.
 */
@Component
@ConditionalOnProperty(name = "app.realtime.relay.enabled", havingValue = "true", matchIfMissing = true)
public class ProjectTaskEventRelayPoller {

    private static final Logger logger = LoggerFactory.getLogger(ProjectTaskEventRelayPoller.class);
    private static final int BATCH_SIZE = 100;

    private final ProjectTaskEventRelayStore relayStore;
    private final ProjectRealtimeHub hub;
    private final boolean sseEnabled;
    private final long purgeAfterHours;

    private volatile long lastProcessedId;

    public ProjectTaskEventRelayPoller(
            ProjectTaskEventRelayStore relayStore,
            ProjectRealtimeHub hub,
            @Value("${app.realtime.sse.enabled:true}") boolean sseEnabled,
            @Value("${app.realtime.relay.purge-after-hours:48}") long purgeAfterHours) {
        this.relayStore = relayStore;
        this.hub = hub;
        this.sseEnabled = sseEnabled;
        this.purgeAfterHours = purgeAfterHours;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void initializeCursor() {
        if (!relayStore.isEnabled() || !sseEnabled) {
            return;
        }
        lastProcessedId = relayStore.currentMaxId();
        logger.info("Project task event relay cursor initialized at id={}", lastProcessedId);
    }

    @Scheduled(fixedDelayString = "${app.realtime.relay.poll-ms:750}")
    public void pollAndBroadcast() {
        if (!relayStore.isEnabled() || !sseEnabled) {
            return;
        }
        List<ProjectTaskEventRelayStore.RelayedEvent> batch = relayStore.pollAfterId(lastProcessedId, BATCH_SIZE);
        if (batch.isEmpty()) {
            return;
        }
        for (ProjectTaskEventRelayStore.RelayedEvent row : batch) {
            ProjectTaskEvent event = row.event();
            if (event != null && event.getProjectId() != null) {
                hub.broadcast(event.getProjectId(), event);
            }
            lastProcessedId = row.id();
        }
    }

    @Scheduled(cron = "${app.realtime.relay.purge-cron:0 15 3 * * *}")
    public void purgeOldEvents() {
        if (!relayStore.isEnabled() || purgeAfterHours <= 0) {
            return;
        }
        relayStore.purgeOlderThan(Instant.now().minusSeconds(purgeAfterHours * 3600L));
    }
}
