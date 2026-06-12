package com.springboot.MyTodoList.realtime;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProjectTaskEventRelayPollerTest {

    @Mock
    private ProjectTaskEventRelayStore relayStore;

    @Mock
    private ProjectRealtimeHub hub;

    private ProjectTaskEventRelayPoller poller;

    @BeforeEach
    void setUp() {
        poller = new ProjectTaskEventRelayPoller(relayStore, hub, true, 48);
    }

    @Test
    void pollAndBroadcast_forwardsNewRowsToLocalHub() {
        when(relayStore.isEnabled()).thenReturn(true);
        when(relayStore.currentMaxId()).thenReturn(0L);
        poller.initializeCursor();
        ProjectTaskEvent event = ProjectTaskEvent.of("task-updated", 2L, 99L, 5L, "telegram");
        when(relayStore.pollAfterId(0L, 100)).thenReturn(List.of(new ProjectTaskEventRelayStore.RelayedEvent(7L, event)));

        poller.pollAndBroadcast();

        verify(hub).broadcast(eq(2L), eq(event));
    }
}
