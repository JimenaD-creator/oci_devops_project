package com.springboot.MyTodoList.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Renames {@code SPRINT.TEAM_PARTICIPATION} to {@code EFFICIENCY_SCORE} when ddl-auto=none.
 */
@Component
@Profile("!test")
public class SprintSchemaMigrationInitializer {

    private static final Logger log = LoggerFactory.getLogger(SprintSchemaMigrationInitializer.class);

    private final JdbcTemplate jdbcTemplate;

    public SprintSchemaMigrationInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void renameEfficiencyColumnIfNeeded() {
        try {
            if (!columnExists("SPRINT", "TEAM_PARTICIPATION")) {
                log.debug("SPRINT.TEAM_PARTICIPATION not present — migration skipped or already applied");
                return;
            }
            if (columnExists("SPRINT", "EFFICIENCY_SCORE")) {
                log.warn("SPRINT has both TEAM_PARTICIPATION and EFFICIENCY_SCORE; run manual cleanup");
                return;
            }
            jdbcTemplate.execute("ALTER TABLE SPRINT RENAME COLUMN TEAM_PARTICIPATION TO EFFICIENCY_SCORE");
            log.info("Renamed SPRINT.TEAM_PARTICIPATION -> EFFICIENCY_SCORE");
        } catch (Exception e) {
            log.warn(
                "Could not rename SPRINT.TEAM_PARTICIPATION — apply "
                    + "scripts/rename_sprint_team_participation_to_efficiency_score.sql manually: {}",
                e.getMessage());
        }
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM user_tab_columns "
                + "WHERE UPPER(table_name) = ? AND UPPER(column_name) = ?",
            Integer.class,
            tableName.toUpperCase(),
            columnName.toUpperCase());
        return count != null && count > 0;
    }
}
