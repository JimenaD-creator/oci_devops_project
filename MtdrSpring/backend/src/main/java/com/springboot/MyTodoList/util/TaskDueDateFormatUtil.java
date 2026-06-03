package com.springboot.MyTodoList.util;

import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

/** Telegram display formatting for task due dates (date-only UI → end of day). */
public final class TaskDueDateFormatUtil {

    private static final DateTimeFormatter DATE_ONLY =
            DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.ENGLISH);
    private static final DateTimeFormatter TIME_ONLY =
            DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH);

    private TaskDueDateFormatUtil() {}

    /**
     * Task due dates come from a date picker (start or end of day). Show the calendar day with
     * {@code 11:59 PM} and no timezone suffix so Telegram does not render {@code 23:59 +00:00}.
     */
    public static String formatDueDateForTelegram(OffsetDateTime dt) {
        if (dt == null) {
            return "Not set";
        }
        LocalTime wall = dt.toLocalTime().truncatedTo(ChronoUnit.SECONDS);
        if (isDateOnlyDueBoundary(wall)) {
            return dt.toLocalDate().format(DATE_ONLY) + " 11:59 PM";
        }
        return dt.toLocalDate().format(DATE_ONLY) + " " + dt.format(TIME_ONLY);
    }

    /** Midnight (legacy) or 23:59 (web manager default) — end of that calendar day. */
    static boolean isDateOnlyDueBoundary(LocalTime wall) {
        if (wall == null) {
            return false;
        }
        if (LocalTime.MIDNIGHT.equals(wall)) {
            return true;
        }
        return wall.getHour() == 23 && wall.getMinute() >= 59;
    }
}
