package com.springboot.MyTodoList.realtime;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Persists task mutation events so every API pod can fan them out to local SSE subscribers
 * (required when running more than one replica behind a load balancer).
 */
@Repository
public class ProjectTaskEventRelayStore {

    private static final Logger logger = LoggerFactory.getLogger(ProjectTaskEventRelayStore.class);

    private final JdbcTemplate jdbcTemplate;
    private final boolean enabled;

    public ProjectTaskEventRelayStore(
            JdbcTemplate jdbcTemplate,
            @Value("${app.realtime.relay.enabled:true}") boolean enabled) {
        this.jdbcTemplate = jdbcTemplate;
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void save(ProjectTaskEvent event) {
        if (!enabled || event == null || event.getProjectId() == null) {
            return;
        }
        try {
            jdbcTemplate.update(
                    "INSERT INTO PROJECT_TASK_EVENTS "
                            + "(PROJECT_ID, EVENT_TYPE, TASK_ID, USER_ID, SOURCE, EVENT_TS) "
                            + "VALUES (?, ?, ?, ?, ?, ?)",
                    event.getProjectId(),
                    event.getType(),
                    event.getTaskId(),
                    event.getUserId(),
                    event.getSource(),
                    new Timestamp(event.getTimestamp() > 0 ? event.getTimestamp() : System.currentTimeMillis()));
        } catch (Exception ex) {
            logger.error(
                    "Failed to persist project task event type={} projectId={} taskId={}: {}",
                    event.getType(),
                    event.getProjectId(),
                    event.getTaskId(),
                    ex.getMessage());
        }
    }

    public long currentMaxId() {
        if (!enabled) {
            return 0L;
        }
        try {
            Long max = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(MAX(ID), 0) FROM PROJECT_TASK_EVENTS", Long.class);
            return max != null ? max : 0L;
        } catch (Exception ex) {
            logger.warn("Could not read PROJECT_TASK_EVENTS max id: {}", ex.getMessage());
            return 0L;
        }
    }

    public List<RelayedEvent> pollAfterId(long afterId, int limit) {
        if (!enabled || limit <= 0) {
            return List.of();
        }
        try {
            return jdbcTemplate.query(
                    "SELECT ID, PROJECT_ID, EVENT_TYPE, TASK_ID, USER_ID, SOURCE, EVENT_TS "
                            + "FROM PROJECT_TASK_EVENTS WHERE ID > ? ORDER BY ID ASC "
                            + "FETCH FIRST "
                            + limit
                            + " ROWS ONLY",
                    (rs, rowNum) -> {
                        long eventTs = rs.getTimestamp("EVENT_TS") != null
                                ? rs.getTimestamp("EVENT_TS").getTime()
                                : System.currentTimeMillis();
                        ProjectTaskEvent event = new ProjectTaskEvent(
                                rs.getString("EVENT_TYPE"),
                                rs.getLong("PROJECT_ID"),
                                rs.getObject("TASK_ID") != null ? rs.getLong("TASK_ID") : null,
                                rs.getObject("USER_ID") != null ? rs.getLong("USER_ID") : null,
                                rs.getString("SOURCE"),
                                eventTs);
                        return new RelayedEvent(rs.getLong("ID"), event);
                    },
                    afterId);
        } catch (Exception ex) {
            logger.debug("PROJECT_TASK_EVENTS poll skipped: {}", ex.getMessage());
            return List.of();
        }
    }

    public void purgeOlderThan(Instant cutoff) {
        if (!enabled || cutoff == null) {
            return;
        }
        try {
            int deleted = jdbcTemplate.update(
                    "DELETE FROM PROJECT_TASK_EVENTS WHERE CREATED_AT < ?",
                    Timestamp.from(cutoff));
            if (deleted > 0) {
                logger.debug("Purged {} old PROJECT_TASK_EVENTS rows", deleted);
            }
        } catch (Exception ex) {
            logger.debug("PROJECT_TASK_EVENTS purge skipped: {}", ex.getMessage());
        }
    }

    public static final class RelayedEvent {
        private final long id;
        private final ProjectTaskEvent event;

        public RelayedEvent(long id, ProjectTaskEvent event) {
            this.id = id;
            this.event = event;
        }

        public long id() {
            return id;
        }

        public ProjectTaskEvent event() {
            return event;
        }
    }
}
