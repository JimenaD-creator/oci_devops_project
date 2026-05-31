package com.springboot.MyTodoList.util;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Aligns persisted Gemini prose and trend claims with live sprint KPIs (same source as KPI cards).
 */
public final class GeminiInsightKpiAlignUtil {

    private static final Pattern ON_TIME_DECLINE_CLAIM = Pattern.compile(
        "(?i)(declined|declining|dropped|fell|fallen|decreased|reduced|worsened)"
            + "|declined\\s+for\\s+\\d+\\s+consecutive"
            + "|has\\s+not\\s+improved");

    private static final Pattern ON_TIME_CONTEXT = Pattern.compile(
        "(?i)on[- ]?time\\s+delivery|entrega\\s+a\\s+tiempo");

    private static final Pattern PERCENT_IN_PROSE = Pattern.compile("(-?\\d+(?:\\.\\d+)?)\\s*%");

    private static final Pattern ON_TIME_PRIMARY_CONCERN_CLAUSE = Pattern.compile(
        "(?i)on[- ]?time\\s+delivery\\s+is\\s+the\\s+primary\\s+concern,?\\s*"
            + "(?:having\\s+)?(?:which\\s+is\\s+at|is\\s+at|currently\\s+at|now\\s+at|stands\\s+at)?\\s*"
            + "\\d+(?:\\.\\d+)?\\s*%\\.?\\s*");

    /** On-time at or above this level should not be framed as a "primary concern". */
    private static final int ON_TIME_STRONG_PERCENT = 70;

    private static final String[] LIVE_METRIC_KEYS = {
        "completionRate", "onTimeDelivery", "teamParticipation", "workloadBalance", "productivityScore"
    };

    private GeminiInsightKpiAlignUtil() {}

    public static int intMetric(Map<String, Object> live, String key) {
        if (live == null || key == null) {
            return 0;
        }
        Object v = live.get(key);
        if (v instanceof Number) {
            return Math.min(100, Math.max(0, ((Number) v).intValue()));
        }
        return 0;
    }

    /** True when the last three chronological on-time values strictly decrease. */
    public static boolean onTimeDeclinedThreeConsecutiveSprints(List<Integer> chronologicalOtd) {
        if (chronologicalOtd == null || chronologicalOtd.size() < 3) {
            return false;
        }
        int n = chronologicalOtd.size();
        int a = chronologicalOtd.get(n - 3);
        int b = chronologicalOtd.get(n - 2);
        int c = chronologicalOtd.get(n - 1);
        return a > b && b > c;
    }

    public static boolean proseClaimsOnTimeDecline(String text) {
        return text != null && !text.isBlank() && ON_TIME_DECLINE_CLAIM.matcher(text).find();
    }

    /**
     * Replaces percentage literals in prose with live KPI values when the text mentions that metric.
     */
    public static String alignAllLiveKpisInProse(String text, Map<String, Object> live) {
        if (text == null || text.isBlank() || live == null) {
            return text;
        }
        String out = text;
        for (String key : LIVE_METRIC_KEYS) {
            out = alignMetricPercentInProse(out, key, intMetric(live, key));
        }
        int otd = intMetric(live, "onTimeDelivery");
        out = alignLooseAtPhrases(out, otd);
        out = alignLooseAtPhrases(out, intMetric(live, "productivityScore"));
        out = fixHavingIsAtGrammar(out);
        out = reconcileOnTimeDeliveryConcernProse(out, otd);
        return fixGluedPercentSpacing(out);
    }

    /** Fixes broken grammar after replacing "dropped to X%" inside "having dropped to X%". */
    public static String fixHavingIsAtGrammar(String text) {
        if (text == null) {
            return text;
        }
        return text.replaceAll("(?i)\\bhaving\\s+is\\s+at\\b", "which is at");
    }

    /**
     * When on-time delivery is strong, do not call it the "primary concern" (common after KPI % alignment).
     */
    public static String reconcileOnTimeDeliveryConcernProse(String text, int onTimePercent) {
        if (text == null || text.isBlank() || onTimePercent < ON_TIME_STRONG_PERCENT) {
            return fixHavingIsAtGrammar(text);
        }
        String out = fixHavingIsAtGrammar(text);
        if (!ON_TIME_CONTEXT.matcher(out).find()) {
            return out;
        }
        Matcher m = ON_TIME_PRIMARY_CONCERN_CLAUSE.matcher(out);
        if (m.find()) {
            out = m.replaceFirst(String.format(
                Locale.ROOT,
                "On-Time Delivery is at %d%% on completed work. ",
                onTimePercent));
        } else if (out.toLowerCase(Locale.ROOT).contains("primary concern")) {
            out = out.replaceAll(
                "(?i)is\\s+the\\s+primary\\s+concern,?\\s*(?:having\\s+)?(?:which\\s+is\\s+at|is\\s+at)?\\s*\\d+(?:\\.\\d+)?\\s*%",
                String.format("is at %d%% on completed work", onTimePercent));
        }
        return out.trim();
    }

    public static String alignMetricPercentInProse(String text, String metricKey, int actualPercent) {
        if (text == null || text.isBlank()) {
            return text;
        }
        String display = actualPercent + "%";
        String lower = text.toLowerCase(Locale.ROOT);
        boolean relevant;
        if ("completionRate".equals(metricKey)) {
            relevant = lower.contains("completion");
        } else if ("onTimeDelivery".equals(metricKey)) {
            relevant = lower.contains("on-time") || lower.contains("on time") || lower.contains("ontime");
        } else if ("teamParticipation".equals(metricKey)) {
            relevant = lower.contains("participation") || lower.contains("engagement");
        } else if ("workloadBalance".equals(metricKey)) {
            relevant = lower.contains("workload") || lower.contains("balance");
        } else if ("productivityScore".equals(metricKey)) {
            relevant = lower.contains("productiv");
        } else {
            relevant = false;
        }
        if (!relevant) {
            return text;
        }
        Matcher m = PERCENT_IN_PROSE.matcher(text);
        if (!m.find()) {
            return text;
        }
        return m.replaceFirst(display);
    }

    private static String alignLooseAtPhrases(String text, int actualPercent) {
        if (text == null) {
            return text;
        }
        String display = actualPercent + "%";
        String out = text;
        out = out.replaceAll("(?i)\\bcurrently\\s+at\\s+-?\\d+(?:\\.\\d+)?\\s*%", "currently at " + display);
        out = out.replaceAll("(?i)\\bnow\\s+at\\s+-?\\d+(?:\\.\\d+)?\\s*%", "now at " + display);
        out = out.replaceAll("(?i)\\bstands\\s+at\\s+-?\\d+(?:\\.\\d+)?\\s*%", "stands at " + display);
        out = out.replaceAll("(?i)\\bhaving\\s+dropped\\s+to\\s+-?\\d+(?:\\.\\d+)?\\s*%", "which is at " + display);
        out = out.replaceAll("(?i)\\bhaving\\s+fallen\\s+to\\s+-?\\d+(?:\\.\\d+)?\\s*%", "which is at " + display);
        out = out.replaceAll("(?i)\\bdropped\\s+to\\s+-?\\d+(?:\\.\\d+)?\\s*%", "is at " + display);
        out = out.replaceAll("(?i)\\bfell\\s+to\\s+-?\\d+(?:\\.\\d+)?\\s*%", "is at " + display);
        return fixHavingIsAtGrammar(out);
    }

    public static String fixGluedPercentSpacing(String text) {
        if (text == null) {
            return text;
        }
        return text.replaceAll("(\\d+)\\s*%([a-zA-Z])", "$1% $2");
    }

    /**
     * Removes sentences that claim on-time decline when live history does not support it.
     */
    public static String removeContradictoryOnTimeDeclineSentences(
            String text, List<Integer> chronologicalOtd) {
        if (text == null || text.isBlank()) {
            return text;
        }
        if (!proseClaimsOnTimeDecline(text)) {
            return text;
        }
        if (onTimeDeclinedThreeConsecutiveSprints(chronologicalOtd)) {
            return text;
        }
        String[] sentences = text.split("(?<=[.!?])\\s+");
        List<String> kept = new ArrayList<>();
        for (String sentence : sentences) {
            if (sentence == null || sentence.isBlank()) {
                continue;
            }
            boolean declineClaim = proseClaimsOnTimeDecline(sentence);
            boolean onTimeTopic = ON_TIME_CONTEXT.matcher(sentence).find()
                || sentence.toLowerCase(Locale.ROOT).contains("delivery");
            if (declineClaim && (onTimeTopic || sentence.toLowerCase(Locale.ROOT).contains("consecutive"))) {
                continue;
            }
            kept.add(sentence.trim());
        }
        if (kept.isEmpty()) {
            int otd = lastOtd(chronologicalOtd);
            return String.format(
                Locale.ROOT,
                "On-time delivery is at %d%% based on completed assignments in this sprint.",
                otd);
        }
        String joined = String.join(" ", kept);
        return reconcileOnTimeDeliveryConcernProse(joined, lastOtd(chronologicalOtd));
    }

    private static int lastOtd(List<Integer> chronologicalOtd) {
        if (chronologicalOtd == null || chronologicalOtd.isEmpty()) {
            return 0;
        }
        return chronologicalOtd.get(chronologicalOtd.size() - 1);
    }

    public static boolean alertContradictsLiveOnTimeTrend(String message, List<Integer> chronologicalOtd) {
        if (message == null || message.isBlank()) {
            return false;
        }
        if (!proseClaimsOnTimeDecline(message)) {
            return false;
        }
        return !onTimeDeclinedThreeConsecutiveSprints(chronologicalOtd);
    }
}
