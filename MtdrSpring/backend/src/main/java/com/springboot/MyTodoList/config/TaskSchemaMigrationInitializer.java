package com.springboot.MyTodoList.config;

import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;

/**
 * Widens {@code TASK.ASSIGNED_HOURS} to accept fractional values like {@code USER_TASK.WORKED_HOURS}
 * when ddl-auto=none (prod/OKE). Only increases decimal scale — never narrows precision (ORA-01440 safe).
 */
@Component
@Profile("!test")
public class TaskSchemaMigrationInitializer {

    private static final Logger log = LoggerFactory.getLogger(TaskSchemaMigrationInitializer.class);
    private static final String UNCONSTRAINED_NUMBER = "NUMBER";

    private final JdbcTemplate jdbcTemplate;

    public TaskSchemaMigrationInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void applyTaskSchemaMigrations() {
        widenAssignedHoursForDecimalsIfNeeded();
    }

    private void widenAssignedHoursForDecimalsIfNeeded() {
        try {
            if (!columnExists("USER_TASK", "WORKED_HOURS")) {
                log.warn("USER_TASK.WORKED_HOURS missing — cannot align TASK.ASSIGNED_HOURS");
                return;
            }
            if (!columnExists("TASK", "ASSIGNED_HOURS")) {
                log.warn("TASK.ASSIGNED_HOURS missing — task APIs will fail until the column is added");
                return;
            }
            Map<String, Object> workedMeta = columnMeta("USER_TASK", "WORKED_HOURS");
            Map<String, Object> assignedMeta = columnMeta("TASK", "ASSIGNED_HOURS");
            if (!needsAssignedHoursWidening(assignedMeta, workedMeta)) {
                log.debug(
                        "TASK.ASSIGNED_HOURS already accepts fractional hours (no widening needed)");
                return;
            }
            String typeSql = widenAssignedHoursTypeSql(assignedMeta, workedMeta);
            if (!tryModifyAssignedHours(typeSql)) {
                log.warn(
                        "Precision-safe widen to {} hit ORA-01440 — falling back to unconstrained NUMBER",
                        typeSql);
                jdbcTemplate.execute("ALTER TABLE TASK MODIFY ASSIGNED_HOURS " + UNCONSTRAINED_NUMBER);
                log.info("Widened TASK.ASSIGNED_HOURS to NUMBER (existing rows kept)");
                return;
            }
            log.info(
                    "Widened TASK.ASSIGNED_HOURS to {} (decimal support aligned with USER_TASK.WORKED_HOURS)",
                    typeSql);
        } catch (Exception e) {
            log.error(
                    "Could not widen TASK.ASSIGNED_HOURS — "
                            + "run sql/oracle/02_task_assigned_hours_double_migration.sql manually ({})",
                    e.getMessage());
        }
    }

    private boolean tryModifyAssignedHours(String typeSql) {
        try {
            jdbcTemplate.execute("ALTER TABLE TASK MODIFY ASSIGNED_HOURS " + typeSql);
            return true;
        } catch (DataAccessException ex) {
            if (isOra01440(ex)) {
                return false;
            }
            throw ex;
        }
    }

    private static boolean isOra01440(Throwable ex) {
        Throwable current = ex;
        while (current != null) {
            String message = current.getMessage();
            if (message != null && message.contains("ORA-01440")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    /**
     * True only for integer-like NUMBER columns that still reject fractional values.
     */
    static boolean needsAssignedHoursWidening(Map<String, Object> assigned, Map<String, Object> worked) {
        if (supportsFractionalHours(assigned)) {
            return false;
        }
        return fractionalScale(worked) > 0 || isFloatingPointType(worked);
    }

    /**
     * Keeps assigned precision and only adds decimal scale. Never copies a smaller worked precision.
     */
    static String widenAssignedHoursTypeSql(Map<String, Object> assigned, Map<String, Object> worked) {
        Integer assignedPrecision = toInteger(assigned.get("DATA_PRECISION"));
        if (assignedPrecision == null) {
            return UNCONSTRAINED_NUMBER;
        }
        int scale = Math.max(fractionalScale(worked), 2);
        return "NUMBER(" + assignedPrecision + ", " + scale + ")";
    }

    static boolean supportsFractionalHours(Map<String, Object> meta) {
        if (isFloatingPointType(meta)) {
            return true;
        }
        String dataType = normalizeType(meta.get("DATA_TYPE"));
        if (!"NUMBER".equals(dataType)) {
            return false;
        }
        Integer precision = toInteger(meta.get("DATA_PRECISION"));
        Integer scale = toInteger(meta.get("DATA_SCALE"));
        if (precision == null) {
            return true;
        }
        return scale != null && scale > 0;
    }

    static int fractionalScale(Map<String, Object> meta) {
        Integer scale = toInteger(meta.get("DATA_SCALE"));
        return scale != null ? scale : 0;
    }

    static boolean isFloatingPointType(Map<String, Object> meta) {
        String dataType = normalizeType(meta.get("DATA_TYPE"));
        return dataType != null && (dataType.contains("FLOAT") || dataType.contains("DOUBLE"));
    }

    static String oracleColumnTypeSql(Map<String, Object> meta) {
        String dataType = String.valueOf(meta.get("DATA_TYPE")).toUpperCase(Locale.ROOT);
        if (!"NUMBER".equals(dataType)) {
            return dataType;
        }
        Integer precision = toInteger(meta.get("DATA_PRECISION"));
        Integer scale = toInteger(meta.get("DATA_SCALE"));
        if (precision != null && scale != null) {
            return "NUMBER(" + precision + ", " + scale + ")";
        }
        if (precision != null) {
            return "NUMBER(" + precision + ")";
        }
        return UNCONSTRAINED_NUMBER;
    }

    private static String normalizeType(Object value) {
        return value == null ? null : String.valueOf(value).toUpperCase(Locale.ROOT);
    }

    private static Integer toInteger(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private Map<String, Object> columnMeta(String tableName, String columnName) {
        return jdbcTemplate.queryForMap(
                "SELECT data_type, data_precision, data_scale FROM user_tab_columns "
                        + "WHERE UPPER(table_name) = ? AND UPPER(column_name) = ?",
                tableName.toUpperCase(),
                columnName.toUpperCase());
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
