package com.springboot.MyTodoList.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Aligns {@code SPRINT} with {@link com.springboot.MyTodoList.model.Sprint} when ddl-auto=none (prod/OKE).
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
    public void applySprintSchemaMigrations() {
        renameEfficiencyColumnIfNeeded();
        addGoalColumnIfNeeded();
    }

    private void renameEfficiencyColumnIfNeeded() {
        try {
            if (!columnExists("SPRINT", "TEAM_PARTICIPATION")) {
                if (!columnExists("SPRINT", "EFFICIENCY_SCORE")) {
                    log.warn(
                        "SPRINT has neither TEAM_PARTICIPATION nor EFFICIENCY_SCORE — "
                            + "dashboard/sprint APIs will fail until one is added");
                } else {
                    log.debug("SPRINT.EFFICIENCY_SCORE present — rename migration skipped");
                }
                return;
            }
            if (columnExists("SPRINT", "EFFICIENCY_SCORE")) {
                log.warn("SPRINT has both TEAM_PARTICIPATION and EFFICIENCY_SCORE; run manual cleanup");
                return;
            }
            jdbcTemplate.execute("ALTER TABLE SPRINT RENAME COLUMN TEAM_PARTICIPATION TO EFFICIENCY_SCORE");
            log.info("Renamed SPRINT.TEAM_PARTICIPATION -> EFFICIENCY_SCORE");
        } catch (Exception e) {
            log.error(
                "Could not rename SPRINT.TEAM_PARTICIPATION — run manually: "
                    + "ALTER TABLE SPRINT RENAME COLUMN TEAM_PARTICIPATION TO EFFICIENCY_SCORE; ({})",
                e.getMessage());
        }
    }

    private void addGoalColumnIfNeeded() {
        try {
            if (columnExists("SPRINT", "GOAL")) {
                log.debug("SPRINT.GOAL already present");
                return;
            }
            jdbcTemplate.execute("ALTER TABLE SPRINT ADD GOAL VARCHAR2(2000)");
            log.info("Added SPRINT.GOAL");
        } catch (Exception e) {
            log.error(
                "Could not add SPRINT.GOAL — run manually: ALTER TABLE SPRINT ADD GOAL VARCHAR2(2000); ({})",
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
