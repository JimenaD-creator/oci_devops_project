package com.springboot.MyTodoList.util;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Post-processing for manager chat replies (score alignment, etc.). */
public final class ManagerChatReplyUtil {

    /**
     * Only rewrites the numeric value after "productivity score … is/:/=/at",
     * so sprint labels like "Sprint 4" are not mistaken for the score.
     */
    private static final Pattern PRODUCTIVITY_SCORE_VALUE =
            Pattern.compile(
                    "(productivity\\s+score(?:\\s+[^.!?\\n]{0,80})?\\s*(?:is|:|=|at)\\s*)(-?\\d+(?:\\.\\d+)?)\\s*%?",
                    Pattern.CASE_INSENSITIVE);

    private ManagerChatReplyUtil() {}

    public static String alignProductivityScoreMentions(String text, Integer expectedScore) {
        if (text == null || text.isBlank() || expectedScore == null) {
            return text;
        }
        Matcher matcher = PRODUCTIVITY_SCORE_VALUE.matcher(text);
        StringBuffer out = new StringBuffer();
        while (matcher.find()) {
            String prefix = matcher.group(1);
            String replacement = prefix + expectedScore + "%";
            matcher.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    public static String clampPercentagesToRange(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        Pattern percentToken = Pattern.compile("(-?\\d+(?:\\.\\d+)?)\\s*%");
        Matcher matcher = percentToken.matcher(text);
        StringBuffer out = new StringBuffer();
        while (matcher.find()) {
            String raw = matcher.group(1);
            double n;
            try {
                n = Double.parseDouble(raw);
            } catch (NumberFormatException ex) {
                matcher.appendReplacement(out, Matcher.quoteReplacement(matcher.group(0)));
                continue;
            }
            double clamped = Math.max(0d, Math.min(100d, n));
            String replacement =
                    Math.abs(clamped - Math.rint(clamped)) < 1e-9
                            ? String.format(Locale.ROOT, "%.0f%%", clamped)
                            : String.format(Locale.ROOT, "%.1f%%", clamped);
            matcher.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(out);
        return out.toString();
    }
}
