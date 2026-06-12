package com.springboot.MyTodoList.util;

import com.fasterxml.jackson.databind.JsonNode;
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

    private static final Pattern VAGUE_TEAM_CHANGE_SUMMARY = Pattern.compile(
        "(?i)(throughput has slowed|overall throughput slowed|meeting deadlines for completed work|"
            + "while the team is meeting|while the team is|the team is meeting deadlines|"
            + "pace has slowed|delivery has slowed significantly)");

    private static final Pattern INSTRUCTION_ECHO_IN_PROSE = Pattern.compile(
        "(?i)(not a final verdict|not a final scorecard|must not contradict|canonical comparison|"
            + "frame as a live snapshot|do not treat lower done|must stay team-focused)");

    private static final Pattern FROM_SPRINT_TO_OPENING = Pattern.compile(
        "(?i)^From\\s+(Sprint\\s+\\d+)\\s+to\\s+(Sprint\\s+\\d+),?\\s*the\\s+team\\s+");

    private static final Pattern DUPLICATE_TEAM_PHRASE = Pattern.compile("(?i)\\bthe team,\\s*the team\\b");

    private static final Pattern DANGLING_AT_COMMA = Pattern.compile("(?i)\\bat\\s*,");
    private static final Pattern DANGLING_AT_PERIOD = Pattern.compile("(?i)\\bat\\s*\\.");

    private static final Pattern PRIOR_SPRINT_PHRASE = Pattern.compile("(?i)\\bprior sprint\\b");

    /** Server-generated KPI checklist (not original Gemini narrative). */
    private static final Pattern MECHANICAL_EXECUTIVE_TRENDS = Pattern.compile(
        "(?is)(?:Compared with|Vs|In progress vs)\\s+[^:]+:\\s*[^;]+;\\s*[^;]+;");

    private static final Pattern INVENTED_LARGE_PERCENT_DROP = Pattern.compile(
        "(?i)(?:\\b\\d{2,}\\s*%\\s*(?:drop|decline|fall)\\b|"
            + "\\b(?:drop|decline|fall)\\b[^.]{0,40}?\\b\\d{2,}\\s*%)");

    private static final Pattern REPETITIVE_SOFT_WORD = Pattern.compile("(?i)\\bsoft(?:en(?:ed)?|er)?\\b");

    private static final Pattern OPEN_SPRINT_PENDING_ALREADY = Pattern.compile(
        "(?i)\\b(?:not done yet|not finished|sprint is still|still open|still running|"
            + "still in progress|work is still|open tasks?|unfinished|score is lower because|score may rise)\\b");

    /** Gemini often writes relative % (e.g. 24%) instead of absolute score points (e.g. 15). */
    private static final Pattern PRODUCTIVITY_TREND_DELTA_PERCENT = Pattern.compile(
        "(?i)(productivity(?:\\s+score)?\\s+(?:has\\s+)?(?:decreased|increased|improved|declined|dropped|rose|fell)\\s+by\\s+)\\d+(?:\\.\\d+)?\\s*%");

    /** Gemini may also write wrong absolute points (e.g. 18 points when live delta is 13). */
    private static final Pattern PRODUCTIVITY_TREND_DELTA_POINTS = Pattern.compile(
        "(?i)(productivity(?:\\s+score)?\\s+(?:has\\s+)?(?:decreased|increased|improved|declined|dropped|rose|fell)\\s+by\\s+)\\d+(?:\\.\\d+)?\\s*(?:percentage\\s+)?points?");

    /** Trends are UI-facing coaching lines — keep them brief and direct. */
    private static final int EXECUTIVE_TRENDS_MAX_CHARS = 180;

    private static final int EXECUTIVE_TRENDS_MAX_WORDS = 28;

    private static final int EXECUTIVE_TRENDS_MAX_SENTENCES = 2;

    private static final Pattern ON_TIME_PRIMARY_CONCERN_CLAUSE = Pattern.compile(
        "(?i)on[- ]?time\\s+delivery\\s+is\\s+the\\s+primary\\s+concern,?\\s*"
            + "(?:having\\s+)?(?:which\\s+is\\s+at|is\\s+at|currently\\s+at|now\\s+at|stands\\s+at)?\\s*"
            + "\\d+(?:\\.\\d+)?\\s*%\\.?\\s*");

    /** On-time at or above this level should not be framed as a "primary concern". */
    private static final int ON_TIME_STRONG_PERCENT = 70;

    /** On-time at or above this level should not trigger delay/missed-deadline alerts or estimates advice. */
    private static final int ON_TIME_PERFECT_BAND_PERCENT = 90;

    private static final Pattern ON_TIME_DELIVERY_PROBLEM_CLAIM = Pattern.compile(
        "(?i)\\b(?:slight\\s+)?delay(?:ed|s)?\\b(?:\\s+in\\s+meeting)?|"
            + "\\bmissed\\b.{0,48}\\b(?:due|deadline)\\b|"
            + "\\b(?:after|past|beyond)\\s+(?:their\\s+|the\\s+)?(?:original\\s+)?(?:due|deadline)\\b|"
            + "\\blate\\s+delivery\\b|"
            + "\\bbehind\\s+schedule\\b|"
            + "\\bnot\\s+on\\s+time\\b|"
            + "\\bmonitor(?:\\s+deadlines?|\\s+due\\s+dates?)\\s+more\\s+closely\\b|"
            + "\\brefine\\s+future\\s+estimation\\b|"
            + "\\bmissed\\s+their\\s+original\\s+due\\s+dates?\\b");

    private static final String[] LIVE_METRIC_KEYS = {
        "completionRate", "onTimeDelivery", "efficiencyScore", "workloadBalance", "productivityScore"
    };

    private GeminiInsightKpiAlignUtil() {}

    public static int intMetric(Map<String, Object> live, String key) {
        if (live == null || key == null) {
            return 0;
        }
        Object v = live.get(key);
        if (v == null && "efficiencyScore".equals(key)) {
            v = live.get("teamParticipation");
        }
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

    /** Delay / missed-deadline wording that contradicts a strong on-time KPI (e.g. 100%). */
    public static boolean proseClaimsOnTimeDeliveryProblem(String text) {
        return text != null && !text.isBlank() && ON_TIME_DELIVERY_PROBLEM_CLAIM.matcher(text).find();
    }

    public static boolean shouldDropOnTimeDeliveryAlertAtStrongScore(String kpi, String message, int liveOtd) {
        if (liveOtd < ON_TIME_PERFECT_BAND_PERCENT) {
            return false;
        }
        String normKpi = kpi == null ? "" : kpi.toLowerCase(Locale.ROOT).replace("_", "");
        boolean onTimeKpi = "ontimedelivery".equals(normKpi);
        String msg = message == null ? "" : message;
        if (liveOtd >= 100 && onTimeKpi) {
            return true;
        }
        if (proseClaimsOnTimeDeliveryProblem(msg) || proseClaimsOnTimeDecline(msg)) {
            return onTimeKpi || ON_TIME_CONTEXT.matcher(msg).find();
        }
        return false;
    }

    public static boolean shouldDropOnTimeEstimationRecommendation(String text, int liveOtd) {
        if (liveOtd < ON_TIME_PERFECT_BAND_PERCENT) {
            return false;
        }
        return proseClaimsOnTimeDeliveryProblem(text) || proseClaimsOnTimeDecline(text);
    }

    /**
     * When the sprint window has ended, incomplete scope is a delivery gap — not a neutral info note.
     * @return {@code critical} if {@code completionRate < 40}, else {@code warning}; {@code null} if complete.
     */
    public static String completionRateAlertSeverityForEndedSprint(int completionRate) {
        if (completionRate >= 100) {
            return null;
        }
        return completionRate < 40 ? "critical" : "warning";
    }

    public static boolean shouldElevateCompletionRateAlertForEndedSprint(String sprintPhase, int completionRate) {
        return "ended".equals(sprintPhase) && completionRate >= 0 && completionRate < 100;
    }

    /** Point band within which next-sprint forecast is treated as flat vs current productivity. */
    public static int forecastStabilityBand(int currentProductivityScore) {
        if (currentProductivityScore >= 98) {
            return 2;
        }
        if (currentProductivityScore >= 90) {
            return 1;
        }
        return 0;
    }

    /** Trend for productivityPrediction vs live sprint score (not vs previous sprint). */
    public static String productivityForecastTrend(int liveProductivityScore, int predictedScore) {
        int delta = predictedScore - liveProductivityScore;
        int band = forecastStabilityBand(liveProductivityScore);
        if (Math.abs(delta) <= band) {
            return "stable";
        }
        if (delta > 0) {
            return "up";
        }
        if (delta < 0) {
            return "down";
        }
        return "stable";
    }

    /** When forecast is within stability band, show live score so UI matches "about the same". */
    public static int resolveForecastPredictedScore(int liveProductivityScore, int rawPredicted) {
        int predicted = Math.max(0, Math.min(100, rawPredicted));
        if ("stable".equals(productivityForecastTrend(liveProductivityScore, predicted))
            && predicted != liveProductivityScore) {
            return liveProductivityScore;
        }
        return predicted;
    }

    private static final List<String> GENERATION_KPI_SNAPSHOT_KEYS = List.of(
        "completionRate", "onTimeDelivery", "efficiencyScore", "workloadBalance", "productivityScore");

    private static final List<String> GENERATION_TASK_BREAKDOWN_KEYS = List.of(
        "total", "done", "toDo", "inProgress", "inReview");

    /**
     * Compares persisted {@code generationKpiSnapshot} (stored at Generate) with live sprint KPIs / task counts.
     */
    public static List<String> detectGenerationKpiDrift(JsonNode snapshotNode, Map<String, Object> liveKpis, JsonNode liveBreakdown) {
        if (snapshotNode == null || !snapshotNode.isObject() || liveKpis == null) {
            return List.of();
        }
        JsonNode snapKpis = snapshotNode.get("kpis");
        if (snapKpis == null || !snapKpis.isObject()) {
            return List.of();
        }
        List<String> changed = new ArrayList<>();
        for (String key : GENERATION_KPI_SNAPSHOT_KEYS) {
            int expected = snapKpis.path(key).asInt(-1);
            int actual = intMetric(liveKpis, key);
            if (expected >= 0 && expected != actual) {
                changed.add(key);
            }
        }
        JsonNode snapBreakdown = snapshotNode.get("taskStatusBreakdown");
        if (snapBreakdown != null && snapBreakdown.isObject() && liveBreakdown != null && liveBreakdown.isObject()) {
            for (String key : GENERATION_TASK_BREAKDOWN_KEYS) {
                if (!snapBreakdown.has(key) || !liveBreakdown.has(key)) {
                    continue;
                }
                int expected = snapBreakdown.path(key).asInt(-1);
                int actual = liveBreakdown.path(key).asInt(-1);
                if (expected >= 0 && actual >= 0 && expected != actual) {
                    changed.add("taskStatusBreakdown." + key);
                }
            }
        }
        return changed;
    }

    /**
     * "Productivity remained stable at 100 points" → live KPI score (e.g. 99 points).
     */
    public static String alignProductivityStableLevelInProse(String text, int productivityScore) {
        if (text == null || text.isBlank()) {
            return text;
        }
        Pattern pattern = Pattern.compile(
            "(?i)(productivity\\s+(?:remained|stays|stayed|is|was)\\s+(?:stable\\s+)?at\\s+)"
                + "(-?\\d+(?:\\.\\d+)?)(\\s*%|\\s*(?:percentage\\s+)?points?)?");
        Matcher matcher = pattern.matcher(text);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String suffix = matcher.group(3);
            String replacement;
            if (suffix != null
                && suffix.toLowerCase(Locale.ROOT).contains("point")
                && !"%".equals(suffix.trim())) {
                String unit = productivityScore == 1 ? " point" : " points";
                replacement = matcher.group(1) + productivityScore + unit;
            } else {
                replacement = matcher.group(1) + productivityScore + "%";
            }
            matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(sb);
        return sb.toString();
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
        out = alignProductivityStableLevelInProse(out, intMetric(live, "productivityScore"));
        out = fixHavingIsAtGrammar(out);
        out = reconcileOnTimeDeliveryConcernProse(out, otd);
        out = fixProductivityPercentMisattributedToOnTime(out, live);
        out = alignCompletionRatePercentLabels(
            out, intMetric(live, "completionRate"), intMetric(live, "onTimeDelivery"));
        return fixGluedPercentSpacing(out);
    }

    private static final Pattern COMPLETION_RATE_PERCENT_BEFORE_LABEL = Pattern.compile(
        "(?i)(\\d+(?:\\.\\d+)?)\\s*%\\s*completion\\s*rate");

    /**
     * Fixes "93% completion rate" when 93 matches on-time delivery, not completion rate (forecast, trends).
     */
    public static String alignCompletionRatePercentLabels(
            String text, int completionPercent, int onTimePercent) {
        if (text == null || text.isBlank()) {
            return text;
        }
        if (Math.abs(completionPercent - onTimePercent) <= 3) {
            return text;
        }
        Matcher m = COMPLETION_RATE_PERCENT_BEFORE_LABEL.matcher(text);
        StringBuffer sb = new StringBuffer();
        boolean changed = false;
        while (m.find()) {
            int cited = (int) Math.round(Double.parseDouble(m.group(1)));
            String repl;
            if (Math.abs(cited - onTimePercent) <= 2 && Math.abs(cited - completionPercent) > 5) {
                changed = true;
                repl = onTimePercent + "% on-time delivery";
            } else {
                repl = completionPercent + "% completion rate";
            }
            m.appendReplacement(sb, Matcher.quoteReplacement(repl));
        }
        if (!changed) {
            return text;
        }
        m.appendTail(sb);
        String out = sb.toString();
        out = out.replaceAll(
            "(?i)(on[- ]?time delivery at \\d+)%\\.?\\s+and\\s+a strong on[- ]?time delivery[^.!?]*",
            "$1%");
        return out;
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
        switch (metricKey) {
            case "completionRate":
                if (!lower.contains("completion")) {
                    return text;
                }
                return applyTightMetricPatterns(text, display, COMPLETION_RATE_PATTERNS);
            case "onTimeDelivery":
                if (!lower.contains("on-time") && !lower.contains("on time") && !lower.contains("ontime")) {
                    return text;
                }
                return alignOnTimePhrasesInProse(text, actualPercent);
            case "teamParticipation":
            case "efficiencyScore":
                if (!lower.contains("efficiency")
                        && !lower.contains("participation")
                        && !lower.contains("engagement")) {
                    return text;
                }
                return applyTightMetricPatterns(text, display, EFFICIENCY_SCORE_PATTERNS);
            case "workloadBalance":
                if (!lower.contains("workload") && !lower.contains("balance")) {
                    return text;
                }
                return applyTightMetricPatterns(text, display, WORKLOAD_BALANCE_PATTERNS);
            case "productivityScore":
                if (!lower.contains("productiv")) {
                    return text;
                }
                return applyTightMetricPatterns(text, display, PRODUCTIVITY_SCORE_PATTERNS);
            default:
                return text;
        }
    }

    private static final Pattern[] COMPLETION_RATE_PATTERNS = {
        Pattern.compile("(?i)(completion\\s*rate(?:\\s+is\\s+(?:currently\\s+)?|\\s*(?:of|is|was|at)\\s*))(-?\\d+(?:\\.\\d+)?)\\s*%?"),
        Pattern.compile("(?i)(current\\s+completion\\s*rate\\s+of\\s+)(-?\\d+(?:\\.\\d+)?)\\s*%?"),
    };

    private static final Pattern[] ON_TIME_TIGHT_PATTERNS = {
        Pattern.compile("(?i)(on[- ]?time\\s*delivery(?:\\s+is\\s+(?:currently\\s+)?|\\s*(?:of|is|was|at)\\s*))(-?\\d+(?:\\.\\d+)?)\\s*%?"),
        Pattern.compile("(?i)(on[- ]?time\\s*delivery\\s+is\\s+at\\s+)(-?\\d+(?:\\.\\d+)?)\\s*%?"),
    };

    private static final Pattern[] EFFICIENCY_SCORE_PATTERNS = {
        Pattern.compile("(?i)(efficiency\\s*score(?:\\s+is\\s+(?:currently\\s+)?|\\s*(?:of|is|was|at)\\s*))(-?\\d+(?:\\.\\d+)?)\\s*%?"),
        Pattern.compile("(?i)(efficiency\\s*score\\s+is\\s+at\\s+)(-?\\d+(?:\\.\\d+)?)\\s*%?"),
        Pattern.compile("(?i)(team\\s*participation(?:\\s+is\\s+(?:currently\\s+)?|\\s*(?:of|is|was|at)\\s*))(-?\\d+(?:\\.\\d+)?)\\s*%?"),
        Pattern.compile("(?i)(team\\s*participation\\s+is\\s+at\\s+)(-?\\d+(?:\\.\\d+)?)\\s*%?"),
    };

    private static final Pattern[] WORKLOAD_BALANCE_PATTERNS = {
        Pattern.compile("(?i)(workload\\s*balance(?:\\s+is\\s+(?:currently\\s+)?|\\s*(?:of|is|was|at)\\s*))(-?\\d+(?:\\.\\d+)?)\\s*%?"),
        Pattern.compile("(?i)(workload\\s*balance\\s*score\\s+of\\s+)(-?\\d+(?:\\.\\d+)?)\\s*%?"),
    };

    private static final Pattern[] PRODUCTIVITY_SCORE_PATTERNS = {
        Pattern.compile("(?i)(productivity\\s*score(?:\\s+is\\s+at\\s+|\\s+is\\s+(?:currently\\s+)?|\\s+stands\\s+at\\s+|\\s*(?:of|is|was|at)\\s*))(-?\\d+(?:\\.\\d+)?)\\s*(?:%|points?)?"),
        Pattern.compile("(?i)(the\\s+productivity\\s*score\\s+of\\s+)(-?\\d+(?:\\.\\d+)?)\\s*%?"),
    };

    /** Gemini often cites productivity score % as "improvement in on-time delivery". */
    private static final Pattern ON_TIME_IMPROVEMENT_PERCENT = Pattern.compile(
        "(?i)(\\d+(?:\\.\\d+)?)\\s*%\\s*(?:improvement|increase|gain|decline|drop|reduction|decrease)\\s+in\\s+on[- ]?time[^.!?]*");

    private static String applyTightMetricPatterns(String text, String display, Pattern[] patterns) {
        String out = text;
        for (Pattern pattern : patterns) {
            out = pattern.matcher(out).replaceAll("$1" + display);
        }
        return out;
    }

    private static String alignOnTimePhrasesInProse(String text, int onTimePercent) {
        String display = onTimePercent + "%";
        String out = applyTightMetricPatterns(text, display, ON_TIME_TIGHT_PATTERNS);
        out = out.replaceAll(
            "(?i)improved on[- ]?time delivery by \\d+(?:\\.\\d+)?\\s*%",
            String.format(Locale.ROOT, "on-time delivery at %s", display));
        Matcher m = ON_TIME_IMPROVEMENT_PERCENT.matcher(out);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            m.appendReplacement(
                sb,
                Matcher.quoteReplacement(String.format(Locale.ROOT, "on-time delivery at %s", display)));
        }
        m.appendTail(sb);
        out = sb.toString();
        out = out.replaceAll("(?i)driven by a on[- ]?time delivery", "with on-time delivery");
        out = out.replaceAll("(?i)driven by an on[- ]?time delivery", "with on-time delivery");
        return out;
    }

    /**
     * When trends cite productivity score (e.g. 97%) as on-time improvement, rewrite to live on-time %.
     */
    public static String fixProductivityPercentMisattributedToOnTime(String text, Map<String, Object> live) {
        if (text == null || text.isBlank() || live == null) {
            return text;
        }
        int ps = intMetric(live, "productivityScore");
        int otd = intMetric(live, "onTimeDelivery");
        if (Math.abs(ps - otd) <= 3) {
            return text;
        }
        Matcher m = ON_TIME_IMPROVEMENT_PERCENT.matcher(text);
        if (!m.find()) {
            return text;
        }
        int cited = (int) Math.round(Double.parseDouble(m.group(1)));
        if (Math.abs(cited - ps) > 2 || Math.abs(cited - otd) <= 5) {
            return text;
        }
        return alignOnTimePhrasesInProse(text, otd);
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
        String out = text.replaceAll("(\\d+)\\s*%([a-zA-Z])", "$1% $2");
        return out.replaceAll("(\\d(?:\\.\\d+)?)(?:\\s*%){2,}", "$1%");
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

    /** Qualitative trend phrase (no percentages or point deltas). */
    public static String qualitativeMovementPhrase(String label, int deltaPoints) {
        if (deltaPoints == 0) {
            return label + " held steady";
        }
        if (deltaPoints >= 8) {
            return label + " improved noticeably";
        }
        if (deltaPoints > 0) {
            return label + " improved slightly";
        }
        if (deltaPoints <= -8) {
            return label + " declined noticeably";
        }
        return label + " declined slightly";
    }

    /**
     * Removes KPI percentages and point deltas from team-change prose (numbers belong in the comparison table).
     */
    public static String stripMetricNumbersFromTeamChangeSummary(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        String out = text;
        out = out.replaceAll("(?i)\\s*\\(\\s*\\d+%\\s*→\\s*\\d+%\\s*\\)", "");
        out = out.replaceAll("(?i)\\bby\\s+\\d+\\s*points?\\b", "");
        out = out.replaceAll("(?i)\\bfrom\\s+\\d+%\\s+to\\s+\\d+%\\b", "");
        out = out.replaceAll("\\d+(\\.\\d+)?\\s*%", "");
        out = out.replaceAll("(?i)\\bwhich is at\\b", "which remains");
        out = out.replaceAll("(?i)\\bhaving is at\\b", "which remains");
        out = out.replaceAll("\\s{2,}", " ");
        out = out.replaceAll("\\s+([,.])", "$1");
        return fixBrokenMetricPhrases(out);
    }

    /**
     * Keeps Gemini wording; only replaces "21 percentage points" with "21%" (same meaning, correct symbol).
     */
    public static String normalizePercentagePointsLabel(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        return text.replaceAll("(?i)\\b(\\d+(?:\\.\\d+)?)\\s+percentage points?\\b", "$1%");
    }

    /**
     * Rewrites productivity sprint-over-sprint deltas to absolute score points (matches KPI Analytics).
     * Example: "decreased by 24%" with live delta -15 → "decreased by 15 points".
     */
    public static String alignProductivityTrendDeltaInProse(String text, int deltaProductivityPoints) {
        if (text == null || text.isBlank() || deltaProductivityPoints == 0) {
            return text;
        }
        int absPoints = Math.abs(deltaProductivityPoints);
        String pointsLabel = absPoints == 1 ? " point" : " points";
        String verb = deltaProductivityPoints > 0 ? "increased" : "decreased";
        String replacement = "Productivity " + verb + " by " + absPoints + pointsLabel;
        if (PRODUCTIVITY_TREND_DELTA_PERCENT.matcher(text).find()) {
            return PRODUCTIVITY_TREND_DELTA_PERCENT.matcher(text).replaceAll(replacement);
        }
        if (PRODUCTIVITY_TREND_DELTA_POINTS.matcher(text).find()) {
            return PRODUCTIVITY_TREND_DELTA_POINTS.matcher(text).replaceAll(replacement);
        }
        return text;
    }

    /** Repairs prose broken when legacy summaries had % stripped (e.g. "from to completion"). */
    public static String fixBrokenMetricPhrases(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        String out = text;
        out = out.replaceAll("(?i)\\bfrom\\s+to\\s+", "");
        out = out.replaceAll("(?i)\\bmoved from\\s+to\\s+", "");
        out = out.replaceAll("(?i)\\band\\s+to\\s+on-time", "and on-time");
        out = out.replaceAll("(?i)\\bfrom\\s+completion and to\\s+", "completion and ");
        out = DUPLICATE_TEAM_PHRASE.matcher(out).replaceAll("the team");
        out = out.replaceAll("\\s{2,}", " ");
        out = out.replaceAll("\\s+([,.])", "$1");
        return out.trim();
    }

    /**
     * Final pass for sprintChangeSummary: fix rewrite glitches, dangling \"at,\" phrases, and align % with live KPIs.
     */
    public static String polishSprintChangeSummary(String text, Map<String, Object> live) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String out = DUPLICATE_TEAM_PHRASE.matcher(text).replaceAll("the team");
        out = fixBrokenMetricPhrases(out);
        out = normalizePercentagePointsLabel(out);
        out = alignAllLiveKpisInProse(out, live);
        out = fixDanglingAtMetricPhrases(out, live);
        out = DUPLICATE_TEAM_PHRASE.matcher(out).replaceAll("the team");
        out = capitalizeSentenceStarts(out);
        out = out.replaceAll("(?i)\\s*\\(\\s*\\d+%\\s*→\\s*\\d+%\\s*\\)", "");
        out = out.replaceAll("\\s{2,}", " ");
        out = out.replaceAll("\\s+([,.])", "$1");
        return out.trim();
    }

    private static String fixDanglingAtMetricPhrases(String text, Map<String, Object> live) {
        if (text == null || text.isBlank() || live == null) {
            return text;
        }
        int cr = intMetric(live, "completionRate");
        int es = intMetric(live, "efficiencyScore");
        int wb = intMetric(live, "workloadBalance");
        String out = text;
        out = out.replaceAll("(?i)remained stable at\\s*,", "remained stable at " + cr + "%,");
        out = out.replaceAll("(?i)remained stable at\\s*\\.", "remained stable at " + cr + "%.");
        out = out.replaceAll(
            "(?i)(completion(?:\\s+rate)?s?)\\s+remained stable at\\s*,",
            "$1 remained stable at " + cr + "%,");
        out = out.replaceAll(
            "(?i)(efficiency\\s+score|team participation|participation)\\s+stayed at\\s*,",
            "efficiency score stayed at " + es + "%,");
        out = out.replaceAll(
            "(?i)(efficiency\\s+score|team participation|participation)\\s+stayed at\\s*\\.",
            "efficiency score stayed at " + es + "%.");
        out = out.replaceAll("(?i)\\bstayed at\\s*\\.", "stayed at " + es + "%.");
        out = out.replaceAll(
            "(?i)(workload balance)\\s+(?:saw[^.]*?at|stayed at|remained at)\\s*,",
            "$1 remained at " + wb + "%,");
        if (DANGLING_AT_COMMA.matcher(out).find()) {
            out = DANGLING_AT_COMMA.matcher(out).replaceFirst("at " + cr + "%,");
        }
        if (DANGLING_AT_PERIOD.matcher(out).find()) {
            out = DANGLING_AT_PERIOD.matcher(out).replaceFirst("at " + es + "%.");
        }
        return out;
    }

    private static String capitalizeSentenceStarts(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        String[] parts = text.split("(?<=[.!?])\\s+");
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) {
                b.append(' ');
            }
            String part = parts[i].trim();
            if (!part.isEmpty()) {
                b.append(Character.toUpperCase(part.charAt(0)));
                if (part.length() > 1) {
                    b.append(part.substring(1));
                }
            }
        }
        return b.toString();
    }

    public static boolean containsObviousMetricNumbers(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        return text.matches(".*\\d+\\s*%.*")
            || text.matches("(?is).*\\b\\d+\\s*points?\\b.*")
            || text.matches("(?is).*\\d+%\\s*→\\s*\\d+%.*");
    }

    /**
     * True when Gemini returned generic coaching without sprint comparison anchors.
     */
    public static boolean isWeakTeamChangeSummary(String text) {
        if (text == null || text.isBlank()) {
            return true;
        }
        String t = text.trim();
        if (t.length() < 70) {
            return true;
        }
        String lower = t.toLowerCase(Locale.ROOT);
        boolean hasWorkInsight = lower.contains("task")
            || lower.contains("assign")
            || lower.contains("done")
            || lower.contains("goal")
            || lower.contains("block")
            || lower.contains("developer")
            || lower.contains("deliver")
            || lower.contains("in progress")
            || lower.contains("in review")
            || lower.contains("to do")
            || lower.contains("workload")
            || lower.contains("overloaded");
        if (!hasWorkInsight) {
            return true;
        }
        boolean hasComparison = lower.contains("previous")
            || lower.contains("earlier sprint")
            || lower.contains("across")
            || lower.contains("compared to")
            || lower.contains("compared with")
            || lower.contains(" versus ")
            || lower.contains(" vs ")
            || lower.contains("from sprint")
            || lower.contains("to sprint")
            || lower.matches("(?s).*sprint\\s+\\d+.*");
        if (!hasComparison) {
            return true;
        }
        if (VAGUE_TEAM_CHANGE_SUMMARY.matcher(t).find()) {
            return true;
        }
        boolean mentionsTeam = lower.contains("team")
            || lower.contains("developer")
            || lower.contains("workload")
            || lower.contains("performance")
            || lower.contains("work")
            || lower.contains("overloaded")
            || lower.contains("block")
            || lower.contains("participation")
            || lower.contains("assign");
        return !mentionsTeam;
    }

    /**
     * True when prose echoes prompt instructions or reads like a closed-sprint verdict while the sprint is still open.
     */
    public static boolean isUnacceptableTeamChangeSummary(String text, SprintChangeContext ctx) {
        if (isWeakTeamChangeSummary(text)) {
            return true;
        }
        if (text == null || text.isBlank()) {
            return true;
        }
        String t = text.trim();
        if (INSTRUCTION_ECHO_IN_PROSE.matcher(t).find()) {
            return true;
        }
        if (PRIOR_SPRINT_PHRASE.matcher(t).find()) {
            return true;
        }
        if (ctx != null && ctx.isSprintStillOpen()) {
            if (FROM_SPRINT_TO_OPENING.matcher(t).find()
                && !t.toLowerCase(Locale.ROOT).contains("in progress")
                && !t.toLowerCase(Locale.ROOT).contains("still open")) {
                return true;
            }
            String lower = t.toLowerCase(Locale.ROOT);
            if (lower.contains("fewer tasks reached done than")
                && !lower.contains("so far")
                && !lower.contains("at close")) {
                return true;
            }
        }
        return false;
    }

    /**
     * Removes instruction echoes and rewrites premature closed-sprint framing when the sprint is still open.
     * KPI alignment (percentages, on-time claims, etc.) is handled separately — not here.
     */
    public static String sanitizeTeamChangeSummary(String text, SprintChangeContext ctx) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String normalized = text.replaceAll("\\s{2,}", " ").trim();
        String[] parts = normalized.split("(?<=[.!?])\\s+");
        List<String> kept = new ArrayList<>();
        for (String part : parts) {
            String sentence = part.trim();
            if (sentence.isEmpty()) {
                continue;
            }
            if (INSTRUCTION_ECHO_IN_PROSE.matcher(sentence).find()) {
                continue;
            }
            sentence = rewriteOpenSprintSentence(sentence, ctx);
            sentence = PRIOR_SPRINT_PHRASE.matcher(sentence).replaceAll("the preceding sprint");
            kept.add(sentence);
        }
        if (kept.isEmpty()) {
            return "";
        }
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < kept.size(); i++) {
            if (i > 0) {
                b.append(' ');
            }
            String s = kept.get(i);
            b.append(s);
            if (!s.endsWith(".") && !s.endsWith("!") && !s.endsWith("?")) {
                b.append('.');
            }
        }
        return fixBrokenMetricPhrases(b.toString().replaceAll("\\s{2,}", " ").trim());
    }

    private static String rewriteOpenSprintSentence(String sentence, SprintChangeContext ctx) {
        if (sentence == null || sentence.isBlank() || ctx == null || !ctx.isSprintStillOpen()) {
            return sentence;
        }
        Matcher fromTo = FROM_SPRINT_TO_OPENING.matcher(sentence);
        if (fromTo.find()) {
            String rewritten = String.format(
                Locale.ROOT,
                "%s is still in progress; compared with %s, the team ",
                fromTo.group(2),
                fromTo.group(1));
            return fromTo.replaceFirst(Matcher.quoteReplacement(rewritten));
        }
        String lower = sentence.toLowerCase(Locale.ROOT);
        if (lower.contains("fewer tasks reached done than")) {
            return sentence
                .replaceAll("(?i)fewer tasks reached Done than", "fewer tasks have reached Done so far than")
                .replaceAll("(?i)than in the prior sprint", "than at the close of the preceding sprint")
                .replaceAll("(?i)than in the preceding sprint at close", "than at the close of the preceding sprint");
        }
        if (lower.contains("compared with a more balanced prior sprint")) {
            return sentence.replaceAll(
                "(?i)compared with a more balanced prior sprint",
                "while workload sharing still looks uneven in the current picture");
        }
        return sentence;
    }

    /** Keeps the first {@code maxSentences} sentence-like segments for a brief coaching paragraph. */
    public static String trimToMaxSentences(String text, int maxSentences) {
        if (text == null || text.isBlank() || maxSentences < 1) {
            return text == null ? "" : text.trim();
        }
        String normalized = text.replaceAll("\\s{2,}", " ").trim();
        String[] parts = normalized.split("(?<=[.!?])\\s+");
        if (parts.length <= maxSentences) {
            return normalized;
        }
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < maxSentences; i++) {
            if (i > 0) {
                b.append(' ');
            }
            String part = parts[i].trim();
            b.append(part);
            if (!part.endsWith(".") && !part.endsWith("!") && !part.endsWith("?")) {
                b.append('.');
            }
        }
        return b.toString().trim();
    }

    /**
     * Short fallback when Gemini did not produce a work-focused sprintChangeSummary (tasks, goal, team behaviors).
     */
    public static String buildBriefTeamWorkSummary(
            String immediatePriorLabel,
            String currentLabel,
            String earlierSprintsList,
            long todoCount,
            long inProcessCount,
            long inReviewCount,
            long doneCount,
            String sprintGoal,
            int deltaCompletion,
            int deltaOnTime,
            String teamWorkloadNote,
            SprintChangeContext ctx) {
        String cur = currentLabel == null || currentLabel.isBlank() ? "this sprint" : currentLabel;
        String priorRef = immediatePriorRef(immediatePriorLabel);
        StringBuilder b = new StringBuilder();
        if (ctx != null && ctx.isSprintStillOpen()) {
            b.append(String.format(Locale.ROOT, "%s is in progress. ", cur));
        } else {
            b.append(String.format(Locale.ROOT, "In %s, ", cur));
        }
        if (sprintGoal != null && !sprintGoal.isBlank()) {
            String goal = sprintGoal.replaceAll("\\s{2,}", " ").trim();
            if (goal.length() > 140) {
                goal = goal.substring(0, 137).trim() + "...";
            }
            b.append(String.format(Locale.ROOT, "the sprint goal is \"%s\". ", goal));
        }
        long tracked = todoCount + inProcessCount + inReviewCount + doneCount;
        if (tracked > 0) {
            b.append(String.format(
                Locale.ROOT,
                "Assigned work shows %d Done, %d In progress, %d In review, and %d To do. ",
                doneCount,
                inProcessCount,
                inReviewCount,
                todoCount));
        } else {
            b.append("The team has little or no tracked assignment activity in this snapshot yet. ");
        }
        if (earlierSprintsList != null && !earlierSprintsList.isBlank()) {
            b.append(String.format(
                Locale.ROOT,
                "Compared with earlier sprints (%s) and %s, ",
                earlierSprintsList,
                priorRef));
        } else {
            b.append(String.format(Locale.ROOT, "Compared with %s, ", priorRef));
        }
        String shift = explainCompletionAndOnTimeShift(deltaCompletion, deltaOnTime, ctx, true, immediatePriorLabel)
            .trim();
        if (!shift.isEmpty()) {
            b.append(shift);
            if (!shift.endsWith(".")) {
                b.append('.');
            }
            b.append(' ');
        }
        if (teamWorkloadNote != null && !teamWorkloadNote.isBlank()) {
            String note = teamWorkloadNote.trim()
                .replace(", which affects team performance entering this sprint.", ".");
            if (!note.endsWith(".")) {
                note = note + '.';
            }
            String lower = b.toString().toLowerCase(Locale.ROOT);
            String noteLower = note.toLowerCase(Locale.ROOT);
            if (!lower.contains("overloaded") && noteLower.contains("overloaded")
                || !lower.contains("block") && noteLower.contains("block")) {
                b.append(note).append(' ');
            }
        }
        return trimToMaxSentences(b.toString().replaceAll("\\s{2,}", " ").trim(), 4);
    }

    /**
     * True when the paragraph lists direction of change but not what drove it (behaviors, bottlenecks, people).
     */
    public static boolean lacksHowAndWhyInsight(String text) {
        if (text == null || text.isBlank()) {
            return true;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        boolean hasWhy = lower.contains("because")
            || lower.contains("due to")
            || lower.contains("driven by")
            || lower.contains("as a result")
            || lower.contains("which suggests")
            || lower.contains("which points to")
            || lower.contains("which often means")
            || lower.contains("likely")
            || lower.contains("indicating")
            || lower.contains("suggesting")
            || lower.contains("bottleneck")
            || lower.contains("concentrated on")
            || lower.contains("depends on")
            || lower.contains("depended on")
            || lower.contains("blocked assignment")
            || lower.contains("overloaded")
            || lower.contains("in progress or review")
            || lower.contains("narrower core")
            || lower.contains("single-person")
            || lower.contains("heaviest queue")
            || lower.contains("performance")
            || lower.contains("day-to-day work")
            || lower.contains("work patterns");
        return !hasWhy;
    }

    /**
     * Live sprint facts for narrative guardrails (phase, assignment scope).
     */
    public static final class SprintChangeContext {
        public final String phase;
        public final int currentTotalTasks;
        public final int previousTotalTasks;
        public final int currentDone;
        public final int previousDone;

        public SprintChangeContext(
                String phase,
                int currentTotalTasks,
                int previousTotalTasks,
                int currentDone,
                int previousDone) {
            this.phase = phase == null ? "unknown" : phase;
            this.currentTotalTasks = Math.max(0, currentTotalTasks);
            this.previousTotalTasks = Math.max(0, previousTotalTasks);
            this.currentDone = Math.max(0, currentDone);
            this.previousDone = Math.max(0, previousDone);
        }

        public static SprintChangeContext fromLiveMaps(
                String phase, Map<String, Object> currentLive, Map<String, Object> previousLive) {
            return new SprintChangeContext(
                phase,
                intMetric(currentLive, "totalTasks"),
                intMetric(previousLive, "totalTasks"),
                intMetric(currentLive, "totalCompleted"),
                intMetric(previousLive, "totalCompleted"));
        }

        public boolean isSprintStillOpen() {
            return "in_progress".equalsIgnoreCase(phase) || "not_started".equalsIgnoreCase(phase);
        }

        /** Tasks not yet Done while the sprint is still running. */
        public int pendingTasks() {
            return Math.max(0, currentTotalTasks - currentDone);
        }

        /** Open sprint with assigned work still outside Done. */
        public boolean hasPendingWork() {
            return isSprintStillOpen() && currentTotalTasks > 0 && pendingTasks() > 0;
        }

        /** True when this sprint has materially fewer assigned tasks than the immediate prior sprint. */
        public boolean isSmallerAssignmentScope() {
            return previousTotalTasks > 0
                && currentTotalTasks > 0
                && currentTotalTasks < previousTotalTasks * 0.85;
        }

        /**
         * Lower completion KPI is explained by smaller scope or similar done-share, not weak execution.
         */
        public boolean completionDeclineIsScopeNotPerformance(int deltaCompletionRate) {
            if (!isSmallerAssignmentScope()) {
                return false;
            }
            if (deltaCompletionRate >= -8) {
                return true;
            }
            if (previousTotalTasks > 0 && currentTotalTasks > 0) {
                double prevShare = (double) previousDone / previousTotalTasks;
                double curShare = (double) currentDone / currentTotalTasks;
                return Math.abs(curShare - prevShare) < 0.12;
            }
            return false;
        }
    }

    public static String buildStructuredTeamChangeSummary(
            String previousLabel,
            String currentLabel,
            int prevCompletion,
            int prevOnTime,
            int prevParticipation,
            int prevWorkload,
            int prevProductivity,
            int curCompletion,
            int curOnTime,
            int curParticipation,
            int curWorkload,
            int curProductivity,
            int deltaCompletion,
            int deltaOnTime,
            int deltaParticipation,
            int deltaWorkload,
            int deltaProductivity,
            String teamWorkloadNote,
            SprintChangeContext ctx) {
        String prev = previousLabel == null || previousLabel.isBlank() ? "the previous sprint" : previousLabel;
        String cur = currentLabel == null || currentLabel.isBlank() ? "this sprint" : currentLabel;
        StringBuilder b = new StringBuilder();
        b.append(openingLineForSprintChange(prev, cur, ctx));
        b.append(explainCompletionAndOnTimeShift(deltaCompletion, deltaOnTime, ctx, true, prev));
        b.append(explainParticipationShift(deltaParticipation, ctx, true));
        b.append(explainWorkloadShift(deltaWorkload));
        b.append(explainProductivityShift(deltaProductivity, deltaCompletion, deltaOnTime, ctx, true, prev));
        if (teamWorkloadNote != null && !teamWorkloadNote.isBlank()) {
            b.append(' ').append(teamWorkloadNote.trim());
            if (!teamWorkloadNote.endsWith(".")) {
                b.append('.');
            }
        } else if (deltaWorkload < -5) {
            b.append(
                " Open Team to see which assignees are carrying disproportionate in-flight work and rebalance before the next sprint.");
        }
        return b.toString().replaceAll("\\s{2,}", " ").trim();
    }

    /**
     * Team evolution across every prior sprint (oldest → newest) plus how/why vs the latest prior.
     */
    public static String buildHistoricalTeamChangeSummary(
            List<String> priorLabelsOldestFirst,
            String currentLabel,
            List<int[]> priorMetricsOldestFirst,
            int curCr,
            int curOtd,
            int curTp,
            int curWb,
            int curPs,
            int dCr,
            int dOtd,
            int dTp,
            int dWb,
            int dPs,
            String teamWorkloadNote,
            SprintChangeContext ctx) {
        if (priorLabelsOldestFirst == null
            || priorLabelsOldestFirst.isEmpty()
            || priorMetricsOldestFirst == null
            || priorMetricsOldestFirst.isEmpty()) {
            return "";
        }
        if (priorLabelsOldestFirst.size() == 1) {
            int[] p = priorMetricsOldestFirst.get(0);
            return buildStructuredTeamChangeSummary(
                priorLabelsOldestFirst.get(0),
                currentLabel,
                p[0],
                p[1],
                p[2],
                p[3],
                p[4],
                curCr,
                curOtd,
                curTp,
                curWb,
                curPs,
                dCr,
                dOtd,
                dTp,
                dWb,
                dPs,
                teamWorkloadNote,
                ctx);
        }
        String cur = currentLabel == null || currentLabel.isBlank() ? "this sprint" : currentLabel;
        String lastPriorLabel = priorLabelsOldestFirst.get(priorLabelsOldestFirst.size() - 1);
        String priorRef = immediatePriorRef(lastPriorLabel);
        String priorList = joinSprintLabelsReadable(priorLabelsOldestFirst);
        StringBuilder b = new StringBuilder();
        if (ctx != null && ctx.isSprintStillOpen()) {
            b.append(String.format(
                Locale.ROOT,
                "%s is still in progress. The notes below compare every earlier sprint (%s) with the live snapshot—not a final verdict. ",
                cur,
                priorList));
        } else {
            b.append(String.format(
                Locale.ROOT,
                "Compared with every earlier sprint (%s), the team's performance and work patterns evolved before %s. ",
                priorList,
                cur));
        }
        b.append(summarizePriorTrajectory("Completion throughput", priorMetricsOldestFirst, 0, curCr, dCr, ctx, true, priorRef));
        b.append(summarizePriorTrajectory("On-time execution on finished work", priorMetricsOldestFirst, 1, curOtd, dOtd, ctx, true, priorRef));
        b.append(summarizePriorTrajectory("Team participation", priorMetricsOldestFirst, 2, curTp, dTp, ctx, true, priorRef));
        b.append(summarizePriorTrajectory("Workload balance", priorMetricsOldestFirst, 3, curWb, dWb, ctx, true, priorRef));
        b.append(String.format(
            Locale.ROOT,
            ctx != null && ctx.isSprintStillOpen() ? " For %s, " : " Entering %s, ",
            cur));
        if (ctx != null && ctx.isSmallerAssignmentScope()) {
            b.append(String.format(
                Locale.ROOT,
                "this sprint has fewer assigned tasks than %s, so raw Done counts alone can look smaller without meaning the team under-delivered on the work that was planned. ",
                priorRef));
        }
        b.append(explainCompletionAndOnTimeShift(dCr, dOtd, ctx, true, priorRef));
        b.append(explainParticipationShift(dTp, ctx, true));
        b.append(explainWorkloadShift(dWb));
        b.append(explainProductivityShift(dPs, dCr, dOtd, ctx, true, priorRef));
        if (teamWorkloadNote != null && !teamWorkloadNote.isBlank()) {
            b.append(' ').append(teamWorkloadNote.trim());
            if (!teamWorkloadNote.endsWith(".")) {
                b.append('.');
            }
        }
        return b.toString().replaceAll("\\s{2,}", " ").trim();
    }

    private static String openingLineForSprintChange(
            String previousLabel, String currentLabel, SprintChangeContext ctx) {
        if (ctx != null && ctx.isSprintStillOpen()) {
            return String.format(
                Locale.ROOT,
                "%s is still in progress. Compared with %s, the live snapshot (not a final scorecard) shows how performance and work are shaping up. ",
                currentLabel,
                previousLabel);
        }
        return String.format(
            Locale.ROOT,
            "Compared with %s, %s shows how the team's performance and day-to-day work have changed. ",
            previousLabel,
            currentLabel);
    }

    private static boolean isOpenSprint(SprintChangeContext ctx) {
        return ctx != null && ctx.isSprintStillOpen();
    }

    private static boolean textAlreadyEstablishesOpenSprint(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String t = text.toLowerCase(Locale.ROOT);
        return t.contains("still in progress")
            || t.contains("live snapshot")
            || t.contains("not a final");
    }

    private static String immediatePriorRef(String label) {
        if (label == null || label.isBlank()) {
            return "the preceding sprint";
        }
        return label.trim();
    }

    /** metricIndex: 0=completion, 1=onTime, 2=participation, 3=workload */
    private static String summarizePriorTrajectory(
            String label,
            List<int[]> priorMetrics,
            int metricIndex,
            int currentValue,
            int deltaVsLastPrior,
            SprintChangeContext ctx,
            boolean openContextEstablished,
            String immediatePriorLabel) {
        String priorRef = immediatePriorRef(immediatePriorLabel);
        if (priorMetrics == null || priorMetrics.isEmpty() || priorMetrics.size() == 1) {
            return "";
        }
        int first = priorMetrics.get(0)[metricIndex];
        int last = priorMetrics.get(priorMetrics.size() - 1)[metricIndex];
        boolean open = isOpenSprint(ctx);
        boolean quietOpen = open && openContextEstablished;
        boolean scopeCompletion = metricIndex == 0
            && ctx != null
            && ctx.completionDeclineIsScopeNotPerformance(deltaVsLastPrior);

        String phrase;
        if (scopeCompletion) {
            phrase = label
                + " across earlier sprints should be read against assignment scope; this sprint planned fewer tasks than "
                + priorRef
                + " while delivery on assigned work is in a similar band. ";
        } else if (currentValue > last && last > first) {
            phrase = quietOpen
                ? label + " trended upward across earlier sprints and is higher than " + priorRef + ". "
                : open
                    ? label + " trended upward across earlier sprints and looks stronger now. "
                    : label + " trended upward across earlier sprints and strengthened again in this sprint. ";
        } else if (currentValue < last && last < first) {
            phrase = quietOpen
                ? label + " was softer across earlier sprints and is lower than " + priorRef + ". "
                : open
                    ? label + " was softer across earlier sprints and is lower now. "
                    : label + " weakened across earlier sprints and is lower in this sprint. ";
        } else if (currentValue > last && last <= first) {
            phrase = quietOpen
                ? label + " was mixed across earlier sprints and is higher than " + priorRef + ". "
                : open
                    ? label + " was mixed across earlier sprints and looks improved now. "
                    : label + " was mixed across earlier sprints but improved entering this sprint. ";
        } else if (currentValue < last && last >= first) {
            phrase = quietOpen
                ? label + " improved across earlier sprints but is lower than " + priorRef + ". "
                : open
                    ? label + " improved across earlier sprints but is lower now. "
                    : label + " improved across earlier sprints but is lower in this sprint. ";
        } else {
            phrase = label + " stayed uneven across earlier sprints and remains mixed. ";
        }
        return capitalizeFirst(phrase);
    }

    private static String explainCompletionAndOnTimeShift(
            int deltaCompletion,
            int deltaOnTime,
            SprintChangeContext ctx,
            boolean openContextEstablished,
            String immediatePriorLabel) {
        boolean open = isOpenSprint(ctx);
        boolean quietOpen = open && openContextEstablished;
        String priorRef = immediatePriorRef(immediatePriorLabel);
        if (ctx != null && ctx.completionDeclineIsScopeNotPerformance(deltaCompletion)) {
            return String.format(
                Locale.ROOT,
                "Completion on assigned work is in a similar range to %s despite fewer planned tasks, so the team is not necessarily under-performing—scope was smaller, not execution alone. ",
                priorRef);
        }
        if (deltaCompletion < -5 && deltaOnTime >= 0) {
            if (open) {
                return String.format(
                    Locale.ROOT,
                    "Completion on assigned work trails %s at close, often because work is still in progress or review while finished items have largely stayed on schedule. ",
                    priorRef);
            }
            return String.format(
                Locale.ROOT,
                "Completion on assigned work is lower than in %s while finished items largely stayed on schedule, which points to throughput still in flight rather than missed dates on what was delivered. ",
                priorRef);
        }
        if (deltaCompletion > 5 && deltaOnTime > 0) {
            return "More assigned work has reached Done while on-time habits on finished items improved"
                + (open && !quietOpen ? " while the sprint remains open" : "")
                + ", suggesting stronger follow-through. ";
        }
        if (deltaCompletion > 5) {
            return "More assigned work has reached Done"
                + (open && !quietOpen ? " with the sprint still open" : "")
                + ", indicating stronger conversion of planned tasks to completion. ";
        }
        if (deltaCompletion < -5 && deltaOnTime < -5) {
            return "Both completion on assigned work and on-time execution on finished items look weaker, which may point to overload, blockers, or estimates that need adjustment"
                + (open && !quietOpen ? " as the sprint continues" : "")
                + ". ";
        }
        if (deltaCompletion < -5) {
            if (open) {
                return String.format(
                    Locale.ROOT,
                    "Completion on assigned work is lower than at the close of %s; open work may still finish before the sprint ends. ",
                    priorRef);
            }
            return String.format(
                Locale.ROOT,
                "Completion on assigned work eased versus %s while the team may still have been busy on in-flight tasks. ",
                priorRef);
        }
        if (deltaOnTime > 5) {
            return "On-time execution on finished work strengthened"
                + (open ? " on finished items" : "")
                + ". ";
        }
        if (deltaOnTime < -5) {
            return "On-time execution on finished work looks weaker"
                + (open && !quietOpen ? " while the sprint remains open" : "")
                + ", often when blockers, uneven load, or optimistic estimates delay closure. ";
        }
        return quietOpen
            ? String.format(
                Locale.ROOT,
                "Completion pace and on-time habits on finished work look broadly in line with %s. ",
                priorRef)
            : open
                ? String.format(
                    Locale.ROOT,
                    "Completion and on-time patterns on finished work look broadly in line with %s while the sprint remains open. ",
                    priorRef)
                : String.format(
                    Locale.ROOT,
                    "Completion pace and on-time habits on finished work stayed broadly in line with %s. ",
                    priorRef);
    }

    private static String explainParticipationShift(
            int deltaParticipation, SprintChangeContext ctx, boolean openContextEstablished) {
        boolean open = isOpenSprint(ctx);
        boolean quietOpen = open && openContextEstablished;
        if (deltaParticipation > 5) {
            return "More developers actively contributed, which spreads ownership"
                + (open && !quietOpen ? " in the current sprint" : "")
                + ". ";
        }
        if (deltaParticipation < -5) {
            return (open
                    ? "Fewer developers show tracked participation"
                    : "Fewer developers logged meaningful participation")
                + ", so outcomes may depend on a narrower core group"
                + (open ? " unless more assignments activate later" : "")
                + ". ";
        }
        return "";
    }

    private static String explainWorkloadShift(int deltaWorkload) {
        if (deltaWorkload < -8) {
            return "Workload became noticeably uneven, concentrating delivery risk on whoever is carrying the heaviest queue. ";
        }
        if (deltaWorkload < -5) {
            return "Work was shared less evenly than before, which can slow the whole sprint when one person owns most in-flight tasks. ";
        }
        if (deltaWorkload > 5) {
            return "Load sharing improved, so assignments and hours are spread more sustainably across the roster. ";
        }
        return "";
    }

    private static String explainProductivityShift(
            int deltaProductivity,
            int deltaCompletion,
            int deltaOnTime,
            SprintChangeContext ctx,
            boolean openContextEstablished,
            String immediatePriorLabel) {
        boolean open = isOpenSprint(ctx);
        boolean quietOpen = open && openContextEstablished;
        String priorRef = immediatePriorRef(immediatePriorLabel);
        if (deltaProductivity > 5) {
            return "Overall productivity looks stronger"
                + (open && !quietOpen ? " in the current sprint" : "")
                + ", consistent with healthier completion and delivery habits. ";
        }
        if (deltaProductivity < -5) {
            if (ctx != null && ctx.hasPendingWork()) {
                return String.format(
                    Locale.ROOT,
                    "%d pending task%s still open, so the productivity score is provisional vs a closed sprint. ",
                    ctx.pendingTasks(),
                    ctx.pendingTasks() == 1 ? "" : "s");
            }
            if (ctx != null && ctx.completionDeclineIsScopeNotPerformance(deltaCompletion)) {
                return "Productivity eased partly because this sprint has fewer assigned tasks; judge delivery on completion of planned work, not raw Done counts alone"
                    + (open && !quietOpen ? " while the sprint remains open" : "")
                    + ". ";
            }
            if (deltaCompletion < 0 && deltaOnTime >= 0) {
                return "Overall productivity slipped, mainly on completion of assigned work, not because finished items broadly missed dates. ";
            }
            return String.format(
                Locale.ROOT,
                "Overall productivity slipped%s, reflecting slower throughput or heavier in-flight work relative to %s. ",
                open && !quietOpen ? " while the sprint remains open" : "",
                priorRef);
        }
        return "";
    }

    /**
     * Adds 1–2 causal sentences when Gemini named the previous sprint but omitted drivers (people, blockers, bottlenecks).
     */
    public static String appendCausalInsightIfThin(
            String text,
            int deltaCompletion,
            int deltaOnTime,
            int deltaParticipation,
            int deltaWorkload,
            int deltaProductivity,
            String teamWorkloadNote,
            SprintChangeContext ctx) {
        if (text == null || text.isBlank() || !lacksHowAndWhyInsight(text)) {
            return text;
        }
        boolean established = textAlreadyEstablishesOpenSprint(text);
        String supplement = explainCompletionAndOnTimeShift(deltaCompletion, deltaOnTime, ctx, established, null)
            + explainParticipationShift(deltaParticipation, ctx, established)
            + explainWorkloadShift(deltaWorkload)
            + explainProductivityShift(deltaProductivity, deltaCompletion, deltaOnTime, ctx, established, null);
        if (teamWorkloadNote != null && !teamWorkloadNote.isBlank()) {
            supplement = supplement + " " + teamWorkloadNote.trim();
        }
        supplement = supplement.trim();
        if (supplement.isEmpty()) {
            return text;
        }
        String base = text.trim();
        if (!base.endsWith(".")) {
            base = base + '.';
        }
        return base + " " + supplement;
    }

    /**
     * Team-focused fallback when Gemini omitted sprintChangeSummary (KPI deltas as context only).
     */
    public static String buildFallbackTeamEvolutionSummary(
            String previousLabel,
            String currentLabel,
            int deltaCompletion,
            int deltaOnTime,
            int deltaParticipation,
            int deltaWorkload,
            int deltaProductivity,
            String teamWorkloadNote) {
        String prev = previousLabel == null || previousLabel.isBlank() ? "the previous sprint" : previousLabel;
        String cur = currentLabel == null || currentLabel.isBlank() ? "this sprint" : currentLabel;
        StringBuilder b = new StringBuilder();
        b.append(String.format(
            Locale.ROOT,
            "From %s to %s, the team's delivery rhythm shifted: %s and %s, with %s. ",
            prev,
            cur,
            qualitativeMovementPhrase("completion throughput", deltaCompletion),
            qualitativeMovementPhrase("on-time execution", deltaOnTime),
            qualitativeMovementPhrase("overall productivity", deltaProductivity)));
        b.append(capitalizeFirst(qualitativeMovementPhrase("engagement (participation)", deltaParticipation)));
        b.append(" and ");
        b.append(qualitativeMovementPhrase("how evenly work was shared", deltaWorkload));
        b.append('.');
        if (teamWorkloadNote != null && !teamWorkloadNote.isBlank()) {
            b.append(' ').append(teamWorkloadNote.trim());
            if (!teamWorkloadNote.endsWith(".")) {
                b.append('.');
            }
        }
        return b.toString();
    }

    /** @deprecated use {@link #buildFallbackTeamEvolutionSummary} */
    public static String buildFallbackSprintChangeSummary(
            String previousLabel,
            String currentLabel,
            int deltaCompletion,
            int deltaOnTime,
            int deltaParticipation,
            int deltaWorkload,
            int deltaProductivity) {
        return buildFallbackTeamEvolutionSummary(
            previousLabel,
            currentLabel,
            deltaCompletion,
            deltaOnTime,
            deltaParticipation,
            deltaWorkload,
            deltaProductivity,
            "");
    }

    public static boolean isMechanicalExecutiveTrends(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        if (MECHANICAL_EXECUTIVE_TRENDS.matcher(text).find()) {
            return true;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        int semicolons = text.length() - text.replace(";", "").length();
        return semicolons >= 2
            && lower.contains("improved")
            && (lower.contains("declined") || lower.contains("held steady"));
    }

    public static boolean hasInventedTrendPercentDrop(String text) {
        return text != null && !text.isBlank() && INVENTED_LARGE_PERCENT_DROP.matcher(text).find();
    }

    /** True when prose overuses soften/softer/softened (reads mechanical). */
    public static boolean isOverlongExecutiveTrends(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        return text.trim().length() > EXECUTIVE_TRENDS_MAX_CHARS
            || countTrendSentences(text) > EXECUTIVE_TRENDS_MAX_SENTENCES
            || countTrendWords(text) > EXECUTIVE_TRENDS_MAX_WORDS;
    }

    private static int countTrendWords(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        return text.trim().split("\\s+").length;
    }

    /** Keeps at most two sentences for executiveSummary.trends. */
    public static String condenseExecutiveTrends(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String normalized = text.trim().replaceAll("\\s{2,}", " ");
        String[] parts = normalized.split("(?<=[.!?])\\s+");
        List<String> kept = new ArrayList<>();
        for (String part : parts) {
            String s = part == null ? "" : part.trim();
            if (s.isEmpty()) {
                continue;
            }
            if (!s.matches(".*[.!?]$")) {
                s = s + '.';
            }
            kept.add(s);
            if (kept.size() >= EXECUTIVE_TRENDS_MAX_SENTENCES) {
                break;
            }
        }
        if (kept.isEmpty()) {
            return truncateTrendsToCharLimit(normalized);
        }
        return truncateTrendsToCharLimit(String.join(" ", kept));
    }

    private static String truncateTrendsToCharLimit(String text) {
        if (text == null || text.length() <= EXECUTIVE_TRENDS_MAX_CHARS) {
            return text == null ? "" : text.trim();
        }
        String cut = text.substring(0, EXECUTIVE_TRENDS_MAX_CHARS).trim();
        int lastStop = Math.max(cut.lastIndexOf('.'), Math.max(cut.lastIndexOf('!'), cut.lastIndexOf('?')));
        if (lastStop >= 40) {
            return cut.substring(0, lastStop + 1).trim();
        }
        return cut + ".";
    }

    private static int countTrendSentences(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        String[] parts = text.trim().split("(?<=[.!?])\\s+");
        int n = 0;
        for (String part : parts) {
            if (part != null && !part.trim().isEmpty()) {
                n++;
            }
        }
        return Math.max(1, n);
    }

    public static boolean hasRepetitiveSoftTrendLanguage(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        Matcher m = REPETITIVE_SOFT_WORD.matcher(text);
        int count = 0;
        while (m.find()) {
            count++;
            if (count >= 2) {
                return true;
            }
        }
        return false;
    }

    /**
     * Keeps Gemini narrative when acceptable; otherwise builds 1–2 natural sentences from live deltas.
     */
    public static String refineExecutiveTrends(
            String geminiTrends,
            String immediatePreviousLabel,
            int deltaProductivity,
            int deltaCompletion,
            int deltaOnTime,
            int deltaParticipation,
            int deltaWorkload,
            SprintChangeContext ctx) {
        String trimmed = normalizePercentagePointsLabel(geminiTrends == null ? "" : geminiTrends.trim()).trim();
        if (!trimmed.isEmpty()
            && !isMechanicalExecutiveTrends(trimmed)
            && !hasInventedTrendPercentDrop(trimmed)
            && !hasRepetitiveSoftTrendLanguage(trimmed)
            && !isOverlongExecutiveTrends(trimmed)) {
            return condenseExecutiveTrends(
                ensureOpenSprintProductivityFraming(trimmed, ctx, deltaProductivity, immediatePreviousLabel));
        }
        return condenseExecutiveTrends(
            buildExecutiveTrendsNarrative(
                immediatePreviousLabel,
                deltaProductivity,
                deltaCompletion,
                deltaOnTime,
                deltaParticipation,
                deltaWorkload,
                ctx));
    }

    /**
     * One direct line when the sprint is open and tasks are still pending.
     */
    public static String buildOpenSprintTrendLine(
            String immediatePreviousLabel, SprintChangeContext ctx, boolean scoreBelowPrior) {
        if (ctx == null || !ctx.hasPendingWork()) {
            return "";
        }
        String prev = immediatePreviousLabel == null || immediatePreviousLabel.isBlank()
            ? "the previous sprint"
            : immediatePreviousLabel;
        int pending = ctx.pendingTasks();
        if (scoreBelowPrior) {
            return String.format(
                Locale.ROOT,
                "Compared with the previous sprint, score is lower because %d %s still open (sprint not finished).",
                pending,
                pending == 1 ? "task is" : "tasks are");
        }
        return String.format(
            Locale.ROOT,
            "Compared with the previous sprint, %d open %s; score updates as work finishes.",
            pending,
            pending == 1 ? "task" : "tasks");
    }

    /**
     * Replaces vague Gemini lines with a single open-sprint explanation when needed.
     */
    public static String ensureOpenSprintProductivityFraming(
            String trends,
            SprintChangeContext ctx,
            int deltaProductivity,
            String immediatePreviousLabel) {
        if (ctx == null || !ctx.hasPendingWork() || !ctx.isSprintStillOpen()) {
            return trends == null ? "" : trends.trim();
        }
        if (trends != null && OPEN_SPRINT_PENDING_ALREADY.matcher(trends).find()) {
            return condenseExecutiveTrends(trends.trim());
        }
        String lower = trends == null ? "" : trends.toLowerCase(Locale.ROOT);
        boolean scoreBelowPrior = deltaProductivity < -5
            || lower.contains("slip")
            || lower.contains("lower")
            || lower.contains("declin")
            || lower.contains("weaker")
            || lower.contains("trail")
            || lower.contains("down");
        if (scoreBelowPrior || trends == null || trends.isBlank()) {
            String line = buildOpenSprintTrendLine(immediatePreviousLabel, ctx, scoreBelowPrior);
            if (!line.isBlank()) {
                return condenseExecutiveTrends(line);
            }
        }
        return trends == null ? "" : condenseExecutiveTrends(trends.trim());
    }

    /** @deprecated appended second sentence; use {@link #buildOpenSprintTrendLine} */
    public static String openSprintPendingProductivityCaveat(SprintChangeContext ctx) {
        return "";
    }

    /**
     * Fallback trends: short narrative (like Gemini examples), aligned to live KPI deltas.
     */
    public static String buildExecutiveTrendsNarrative(
            String immediatePreviousLabel,
            int deltaProductivity,
            int deltaCompletion,
            int deltaOnTime,
            int deltaParticipation,
            int deltaWorkload,
            SprintChangeContext ctx) {
        String prev = immediatePreviousLabel == null || immediatePreviousLabel.isBlank()
            ? "the previous sprint"
            : immediatePreviousLabel;
        boolean open = ctx != null && ctx.isSprintStillOpen();

        boolean omitCompletionClause = ctx != null
            && ctx.isSmallerAssignmentScope()
            && deltaCompletion < 0
            && ctx.completionDeclineIsScopeNotPerformance(deltaCompletion);
        boolean productivityDown = deltaProductivity <= -5;
        boolean completionDown = !omitCompletionClause && deltaCompletion <= -5;

        if (open && ctx != null && ctx.hasPendingWork() && productivityDown) {
            return condenseExecutiveTrends(buildOpenSprintTrendLine(prev, ctx, true));
        }

        List<String> clauses = new ArrayList<>();
        if (productivityDown && completionDown) {
            clauses.add("productivity and completion slipped");
        } else {
            addTrendClauseIfSignificant(clauses, "productivity", deltaProductivity);
            if (!omitCompletionClause) {
                addTrendClauseIfSignificant(clauses, "completion", deltaCompletion);
            }
        }
        addTrendClauseIfSignificant(clauses, "on-time delivery", deltaOnTime);
        addTrendClauseIfSignificant(clauses, "team participation", deltaParticipation);
        addTrendClauseIfSignificant(clauses, "workload balance", deltaWorkload);

        if (clauses.size() > 2) {
            clauses = new ArrayList<>(clauses.subList(0, 2));
        }

        StringBuilder out = new StringBuilder();
        if (clauses.isEmpty()) {
            out.append(String.format(Locale.ROOT, "Compared with %s, metrics are steady.", prev));
            return condenseExecutiveTrends(out.toString());
        }

        String movement = joinTrendClausesNaturally(clauses);
        out.append(String.format(Locale.ROOT, "Compared with %s, %s.", prev, movement));

        return condenseExecutiveTrends(out.toString());
    }

    /** @deprecated use {@link #refineExecutiveTrends} or {@link #buildExecutiveTrendsNarrative} */
    public static String buildExecutiveTrendsSummary(
            String immediatePreviousLabel,
            int deltaProductivity,
            int deltaCompletion,
            int deltaOnTime,
            int deltaParticipation,
            int deltaWorkload,
            SprintChangeContext ctx) {
        return buildExecutiveTrendsNarrative(
            immediatePreviousLabel,
            deltaProductivity,
            deltaCompletion,
            deltaOnTime,
            deltaParticipation,
            deltaWorkload,
            ctx);
    }

    private static void addTrendClauseIfSignificant(List<String> clauses, String label, int deltaPoints) {
        if (Math.abs(deltaPoints) < 5) {
            return;
        }
        String phrase = trendMovementPhrase(label, deltaPoints);
        if (phrase != null && !phrase.isEmpty()) {
            clauses.add(phrase);
        }
    }

    private static String trendMovementPhrase(String label, int deltaPoints) {
        if (label == null || label.isBlank()) {
            return "";
        }
        String key = label.trim().toLowerCase(Locale.ROOT);
        if (deltaPoints > 0) {
            switch (key) {
                case "productivity":
                    return "productivity strengthened";
                case "completion":
                    return "completion picked up";
                case "on-time delivery":
                    return "on-time delivery improved";
                case "team participation":
                    return "participation broadened";
                case "workload balance":
                    return "workload balance improved";
                default:
                    return label + " improved";
            }
        }
        if (deltaPoints < 0) {
            switch (key) {
                case "productivity":
                    return "productivity slipped";
                case "completion":
                    return "completion slowed";
                case "on-time delivery":
                    return "on-time delivery eased";
                case "team participation":
                    return "participation thinned";
                case "workload balance":
                    return "workload balance weakened";
                default:
                    return label + " eased";
            }
        }
        return "";
    }

    private static String joinTrendClausesNaturally(List<String> clauses) {
        if (clauses.isEmpty()) {
            return "";
        }
        if (clauses.size() == 1) {
            return clauses.get(0);
        }
        return clauses.get(0) + ", " + clauses.get(1);
    }

    public static String joinSprintLabelsReadable(List<String> labels) {
        if (labels == null || labels.isEmpty()) {
            return "";
        }
        if (labels.size() == 1) {
            return labels.get(0);
        }
        if (labels.size() == 2) {
            return labels.get(0) + " and " + labels.get(1);
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < labels.size() - 1; i++) {
            if (i > 0) {
                sb.append(", ");
            }
            sb.append(labels.get(i));
        }
        sb.append(", and ").append(labels.get(labels.size() - 1));
        return sb.toString();
    }

    private static String capitalizeFirst(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }
        return Character.toUpperCase(text.charAt(0)) + text.substring(1);
    }
}
