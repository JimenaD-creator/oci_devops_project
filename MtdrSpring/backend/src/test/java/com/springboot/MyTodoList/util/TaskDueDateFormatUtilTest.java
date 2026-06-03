package com.springboot.MyTodoList.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class TaskDueDateFormatUtilTest {

    @Test
    void formatDueDateForTelegram_midnightShowsEndOfDay() {
        OffsetDateTime due = OffsetDateTime.of(2026, 6, 15, 0, 0, 0, 0, ZoneOffset.ofHours(-6));
        assertEquals("2026-06-15 11:59 PM", TaskDueDateFormatUtil.formatDueDateForTelegram(due));
    }

    @Test
    void formatDueDateForTelegram_utc2359ShowsElevenFiftyNinePmWithoutZone() {
        OffsetDateTime due = OffsetDateTime.of(2026, 6, 15, 23, 59, 0, 0, ZoneOffset.UTC);
        assertEquals("2026-06-15 11:59 PM", TaskDueDateFormatUtil.formatDueDateForTelegram(due));
    }

    @Test
    void formatDueDateForTelegram_endOfDayStoredShowsElevenFiftyNinePm() {
        OffsetDateTime due = OffsetDateTime.of(2026, 6, 15, 23, 59, 59, 999_000_000, ZoneOffset.ofHours(-6));
        assertEquals("2026-06-15 11:59 PM", TaskDueDateFormatUtil.formatDueDateForTelegram(due));
    }

    @Test
    void formatDueDateForTelegram_specificTimeOmitsTimezone() {
        OffsetDateTime due = OffsetDateTime.of(2026, 6, 15, 14, 30, 0, 0, ZoneOffset.ofHours(-6));
        assertEquals("2026-06-15 02:30 PM", TaskDueDateFormatUtil.formatDueDateForTelegram(due));
    }

    @Test
    void isDateOnlyDueBoundary_detectsMidnightAndEndOfDay() {
        assertTrue(TaskDueDateFormatUtil.isDateOnlyDueBoundary(LocalTime.MIDNIGHT));
        assertTrue(TaskDueDateFormatUtil.isDateOnlyDueBoundary(LocalTime.of(23, 59, 59)));
        assertFalse(TaskDueDateFormatUtil.isDateOnlyDueBoundary(LocalTime.of(14, 30)));
    }
}
