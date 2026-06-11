package com.springboot.MyTodoList.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class TaskSchemaMigrationInitializerTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    private TaskSchemaMigrationInitializer initializer;

    @BeforeEach
    void setUp() {
        initializer = new TaskSchemaMigrationInitializer(jdbcTemplate);
    }

    @Test
    void widenAssignedHoursTypeSql_keepsAssignedPrecisionAndAddsScale() {
        Map<String, Object> worked =
                Map.of("DATA_TYPE", "NUMBER", "DATA_PRECISION", 10, "DATA_SCALE", 2);
        Map<String, Object> assigned =
                Map.of("DATA_TYPE", "NUMBER", "DATA_PRECISION", 38, "DATA_SCALE", 0);

        assertEquals(
                "NUMBER(38, 2)",
                TaskSchemaMigrationInitializer.widenAssignedHoursTypeSql(assigned, worked));
    }

    @Test
    void supportsFractionalHours_trueWhenPrecisionIsNullEvenIfScaleIsZero() {
        Map<String, Object> assigned = new HashMap<>();
        assigned.put("DATA_TYPE", "NUMBER");
        assigned.put("DATA_SCALE", 0);

        assertTrue(TaskSchemaMigrationInitializer.supportsFractionalHours(assigned));
        assertFalse(TaskSchemaMigrationInitializer.needsAssignedHoursWidening(assigned, Map.of(
                "DATA_TYPE", "NUMBER", "DATA_PRECISION", 10, "DATA_SCALE", 2)));
    }

    @Test
    void applyTaskSchemaMigrations_widensIntegerAssignedHoursWithoutNarrowingPrecision() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), anyString(), anyString()))
                .thenReturn(1);
        when(jdbcTemplate.queryForMap(anyString(), anyString(), anyString()))
                .thenReturn(
                        Map.of("DATA_TYPE", "NUMBER", "DATA_PRECISION", 10, "DATA_SCALE", 2),
                        Map.of("DATA_TYPE", "NUMBER", "DATA_PRECISION", 10, "DATA_SCALE", 0));

        initializer.applyTaskSchemaMigrations();

        verify(jdbcTemplate).execute("ALTER TABLE TASK MODIFY ASSIGNED_HOURS NUMBER(10, 2)");
    }

    @Test
    void applyTaskSchemaMigrations_skipsUnconstrainedNumber() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), anyString(), anyString()))
                .thenReturn(1);
        Map<String, Object> unconstrained = new HashMap<>();
        unconstrained.put("DATA_TYPE", "NUMBER");
        unconstrained.put("DATA_SCALE", 0);
        when(jdbcTemplate.queryForMap(anyString(), anyString(), anyString()))
                .thenReturn(
                        Map.of("DATA_TYPE", "NUMBER", "DATA_PRECISION", 10, "DATA_SCALE", 2),
                        unconstrained);

        initializer.applyTaskSchemaMigrations();

        verify(jdbcTemplate, never()).execute(anyString());
    }

    @Test
    void applyTaskSchemaMigrations_skipsWhenScaleAlreadyMatches() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), anyString(), anyString()))
                .thenReturn(1);
        Map<String, Object> shared =
                Map.of("DATA_TYPE", "NUMBER", "DATA_PRECISION", 10, "DATA_SCALE", 2);
        when(jdbcTemplate.queryForMap(anyString(), anyString(), anyString()))
                .thenReturn(shared, shared);

        initializer.applyTaskSchemaMigrations();

        verify(jdbcTemplate, never()).execute(anyString());
    }
}
