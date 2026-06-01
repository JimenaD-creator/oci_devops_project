package com.springboot.MyTodoList.util;

import java.util.Locale;

/** Parsing and formatting for USER_TASK worked hours (supports decimals in Telegram bot). */
public final class WorkedHoursUtil {

    private static final double MIN_HOURS = 0.1;
    private static final double MAX_HOURS = 100.0;

    private WorkedHoursUtil() {}

    public static double parseBotInput(String raw) throws NumberFormatException {
        if (raw == null) {
            throw new NumberFormatException("empty");
        }
        String normalized = raw.trim().replace(',', '.');
        if (normalized.isEmpty()) {
            throw new NumberFormatException("empty");
        }
        double value = Double.parseDouble(normalized);
        return Math.round(value * 100.0) / 100.0;
    }

    public static String validateRange(double hours) {
        if (Double.isNaN(hours) || Double.isInfinite(hours)) {
            return "Please enter a valid number of hours.";
        }
        if (hours < MIN_HOURS) {
            return "Hours must be at least " + formatForDisplay(MIN_HOURS) + ". Please try again.";
        }
        if (hours > MAX_HOURS) {
            return "Please enter a reasonable number of hours (max " + formatForDisplay(MAX_HOURS) + ").";
        }
        return null;
    }

    public static String formatForDisplay(double hours) {
        if (Math.abs(hours - Math.rint(hours)) < 1e-9) {
            return String.valueOf((long) Math.rint(hours));
        }
        String formatted = String.format(Locale.US, "%.2f", hours);
        if (formatted.contains(".")) {
            formatted = formatted.replaceAll("0+$", "").replaceAll("\\.$", "");
        }
        return formatted;
    }
}
