package com.springboot.MyTodoList.util;

import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Post-processing for manager chat replies (KPI alignment, internal reference cleanup). */
public final class ManagerChatReplyUtil {

    private static final Pattern PRODUCTIVITY_SCORE_VALUE =
            Pattern.compile(
                    "(productivity\\s+score(?:\\s+[^.!?\\n]{0,80})?\\s*(?:is|:|=|at|of)\\s*)(-?\\d+(?:\\.\\d+)?)\\s*(?:%|points?)?",
                    Pattern.CASE_INSENSITIVE);

    private static final Pattern COMPLETION_RATE_VALUE =
            Pattern.compile(
                    "(completion\\s+rate(?:\\s+[^.!?\\n]{0,60})?\\s*(?:is|:|=|at|of)\\s*)(-?\\d+(?:\\.\\d+)?)\\s*%?",
                    Pattern.CASE_INSENSITIVE);

    private static final Pattern BACKTICK_IDENTIFIER =
            Pattern.compile("`([a-zA-Z][a-zA-Z0-9_]*)`");

    private static final String[] INTERNAL_TOKENS = {
        "developerInsightTimeline",
        "developerPerformanceHistory",
        "aiInsight",
        "sprintAnalysis",
        "kpisAtGeneration",
        "actionableRecommendations",
        "developersAggregatedAllSprints",
        "executiveSummary",
        "developerInsights",
        "blockedAssignments",
        "generationKpiSnapshot",
        "productivityScore",
        "completionRate",
        "onTimeDelivery",
        "workloadBalance",
        "efficiencyScore",
        "assignedHoursEstimate",
        "workedHours"
    };

    private static final Pattern SPRINT_LABEL_MENTION =
            Pattern.compile("(?i)\\bSprint\\s+(\\d+)\\b");

    private ManagerChatReplyUtil() {}

    public static String alignLiveKpiMentions(String text, Map<String, Integer> liveKpis) {
        if (text == null || text.isBlank() || liveKpis == null || liveKpis.isEmpty()) {
            return text;
        }
        String out = text;
        Integer productivity = liveKpis.get("productivityScore");
        if (productivity != null) {
            out = alignProductivityScoreMentions(out, productivity);
        }
        Integer completion = liveKpis.get("completionRate");
        if (completion != null) {
            out = alignCompletionRateMentions(out, completion);
        }
        return out;
    }

    public static String alignProductivityScoreMentions(String text, Integer expectedScore) {
        if (text == null || text.isBlank() || expectedScore == null) {
            return text;
        }
        String display = expectedScore + "%";
        return replaceMetricPattern(PRODUCTIVITY_SCORE_VALUE, text, display);
    }

    public static String alignCompletionRateMentions(String text, Integer expectedRate) {
        if (text == null || text.isBlank() || expectedRate == null) {
            return text;
        }
        return replaceMetricPattern(COMPLETION_RATE_VALUE, text, expectedRate + "%");
    }

    /**
     * Removes parenthetical asides where the model compares stale AI-summary KPIs to live KPIs
     * (e.g. "(noted as 81% in the AI summary, but the live KPI is 67%)").
     */
    public static String stripAiVsLiveKpiAsides(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        String out = text;
        Pattern[] patterns = {
            Pattern.compile(
                "\\s*\\(\\s*noted as [^)]*(?:AI summary|AI notes|AI insight|sprint analysis)[^)]*\\)",
                Pattern.CASE_INSENSITIVE),
            Pattern.compile(
                "\\s*\\(\\s*(?:mencionado|notado) como [^)]*(?:resumen(?:\\s+de)?\\s+IA|IA|AI)[^)]*\\)",
                Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE),
            Pattern.compile(
                "\\s*\\([^)]*(?:AI summary|AI notes|resumen(?:\\s+de)?\\s+IA)[^)]*(?:live KPI|KPI en vivo)[^)]*\\)",
                Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE),
            Pattern.compile(
                ",?\\s*but the live KPI is \\d+(?:\\.\\d+)?\\s*%",
                Pattern.CASE_INSENSITIVE),
            Pattern.compile(
                ",?\\s*pero el KPI en vivo es \\d+(?:\\.\\d+)?\\s*%",
                Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE),
        };
        for (Pattern pattern : patterns) {
            out = pattern.matcher(out).replaceAll("");
        }
        out = out.replaceAll(" {2,}", " ");
        out = out.replaceAll("\\(\\s*\\)", "");
        return out;
    }

    /** Removes JSON field names and backtick-wrapped internal identifiers from user-facing text. */
    public static String stripInternalDataReferences(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        String out = text;
        Matcher backtick = BACKTICK_IDENTIFIER.matcher(out);
        StringBuffer cleaned = new StringBuffer();
        while (backtick.find()) {
            backtick.appendReplacement(cleaned, "");
        }
        backtick.appendTail(cleaned);
        out = cleaned.toString();

        for (String token : INTERNAL_TOKENS) {
            out = out.replaceAll("(?i)\\b" + Pattern.quote(token) + "\\b", "");
        }

        out = out.replaceAll(" {2,}", " ");
        out = out.replaceAll("\\(\\s*\\)", "");
        out = out.replaceAll(":\\s*\\.", ".");
        out = out.replaceAll("\\n{3,}", "\n\n");
        return out.trim();
    }

    /**
     * Final pass for single-sprint manager chat replies: correct opening line, DB-id leaks, and
     * "compared to Sprint N" phrasing.
     */
    public static String enforceSingleSprintReply(
            String text,
            String answerLabel,
            String previousSprintLabel,
            java.util.List<String> validSprintLabels,
            Long answerSprintDbId) {
        if (text == null || text.isBlank() || answerLabel == null || answerLabel.isBlank()) {
            return text;
        }
        String out = text;
        if (answerSprintDbId != null) {
            out = out.replaceAll(
                "(?i)\\bSprint\\s+" + answerSprintDbId + "\\b",
                Matcher.quoteReplacement(answerLabel));
        }
        out = out.replaceFirst(
            "(?i)^\\s*For\\s+Sprint\\s+\\d+",
            "For " + answerLabel);
        out = enforceAnswerSprintLabel(
            out, answerLabel, validSprintLabels, previousSprintLabel, answerSprintDbId);
        if (previousSprintLabel != null && !previousSprintLabel.isBlank()) {
            out = out.replaceAll(
                "(?i)compared to Sprint \\d+",
                "compared to " + previousSprintLabel);
            out = out.replaceAll(
                "(?i)compared with Sprint \\d+",
                "compared with " + previousSprintLabel);
        }
        return out;
    }

    /**
     * Rewrites productivity sprint-over-sprint comparisons to absolute points (not relative %).
     */
    public static String alignProductivityVsPreviousInProse(
            String text,
            int signedDeltaPoints,
            int currentScore,
            String previousSprintLabel) {
        if (text == null || text.isBlank()) {
            return text;
        }
        String prev = previousSprintLabel == null || previousSprintLabel.isBlank()
            ? "the previous sprint"
            : previousSprintLabel;

        if (signedDeltaPoints == 0) {
            return stripSpuriousProductivityDeltaWhenFlat(text, currentScore);
        }

        int abs = Math.abs(signedDeltaPoints);
        String pointsWord = abs == 1 ? "point" : "points";
        String verb = signedDeltaPoints > 0 ? "increase" : "decrease";
        String article = signedDeltaPoints > 0 ? "an" : "a";

        String out = text;

        Pattern parentheticalDeltaPercent = Pattern.compile(
            "(?i)\\(\\s*(a\\s+)?(decrease|increase|decreased|increased|drop|rise|dropped|rose|fell|improved|declined)"
                + "\\s+of\\s+\\d+(?:\\.\\d+)?\\s*%(\\s*(?:from|compared\\s+to)\\s+[^)]+)?\\)");
        Matcher paren = parentheticalDeltaPercent.matcher(out);
        if (paren.find()) {
            String suffix = paren.group(3) != null ? paren.group(3).trim() : " compared to " + prev;
            if (!suffix.toLowerCase(Locale.ROOT).contains("compared")
                    && !suffix.toLowerCase(Locale.ROOT).contains("from")) {
                suffix = " compared to " + prev;
            }
            String fixed = String.format(
                Locale.ROOT,
                "(%s %s of %d %s%s)",
                article,
                verb,
                abs,
                pointsWord,
                suffix);
            out = paren.replaceFirst(Matcher.quoteReplacement(fixed));
        }

        Pattern deltaPercent = Pattern.compile(
            "(?i)((?:which is )?(?:\\(?\\s*)?(?:a\\s+)?"
                + "(?:decrease|increase|decreased|increased|drop|rise|dropped|rose|fell|improved|declined)"
                + "\\s+of\\s+)\\d+(?:\\.\\d+)?\\s*%");
        out = deltaPercent.matcher(out).replaceAll("$1" + abs + " " + pointsWord);

        Pattern productivityBullet = Pattern.compile(
            "(?i)([•\\-*]?\\s*Productivity:?\\s*)The productivity score is \\d+(?:\\.\\d+)?%?,? which is (?:a )?"
                + "(?:decrease|increase|decreased|increased|drop|rise|dropped|rose|fell|improved|declined) of \\d+(?:\\.\\d+)?\\s*(?:%|points?)"
                + "(?: compared to [^.\\n]+)?");
        Matcher bullet = productivityBullet.matcher(out);
        if (bullet.find()) {
            String fixed = String.format(
                Locale.ROOT,
                "The productivity score is %d%%, which is %s %s of %d %s compared to %s",
                currentScore,
                article,
                verb,
                abs,
                pointsWord,
                prev);
            out = bullet.replaceFirst(Matcher.quoteReplacement(bullet.group(1) + fixed));
        }

        return out;
    }

    /** When delta is 0, remove parentheticals that claim a large % drop/increase (model copied the score). */
    private static String stripSpuriousProductivityDeltaWhenFlat(String text, int currentScore) {
        if (text == null || text.isBlank() || currentScore <= 0) {
            return text;
        }
        Pattern parentheticalDeltaPercent = Pattern.compile(
            "(?i)\\s*\\(\\s*(?:a\\s+)?(?:decrease|increase|decreased|increased|drop|rise|dropped|rose|fell|improved|declined)"
                + "\\s+of\\s+" + currentScore + "(?:\\.0)?\\s*%\\s*(?:from|compared\\s+to)\\s+[^)]+\\)");
        return parentheticalDeltaPercent.matcher(text).replaceAll("");
    }

    /** Single post-processing pass for manager chat replies. */
    public static String polishManagerChatReply(
            String reply,
            Map<String, Integer> liveKpis,
            int productivityDelta,
            String answerLabel,
            String previousLabel,
            java.util.List<String> validLabels,
            Long answerSprintDbId) {
        if (reply == null) {
            return null;
        }
        String out = clampPercentagesToRange(reply);
        out = alignLiveKpiMentions(out, liveKpis);
        out = stripAiVsLiveKpiAsides(out);
        Integer currentScore = liveKpis != null ? liveKpis.get("productivityScore") : null;
        int score = currentScore != null ? currentScore : 0;
        if (productivityDelta != 0) {
            out = alignProductivityVsPreviousInProse(out, productivityDelta, score, previousLabel);
            out = GeminiInsightKpiAlignUtil.alignProductivityTrendDeltaInProse(out, productivityDelta);
        }
        out = stripInternalDataReferences(out);
        if (answerLabel != null && answerSprintDbId != null) {
            out = enforceSingleSprintReply(out, answerLabel, previousLabel, validLabels, answerSprintDbId);
            out = forceInsightsOpeningLine(out, answerLabel);
        }
        return out;
    }

    /** Ensures the reply opens with the correct sequential sprint label (never a database id). */
    private static String forceInsightsOpeningLine(String text, String answerLabel) {
        if (text == null || text.isBlank() || answerLabel == null || answerLabel.isBlank()) {
            return text;
        }
        String fixed = text.replaceFirst(
            "(?is)^\\s*For\\s+Sprint\\s+\\d+\\s*,\\s*here are the key insights[^\\n]*",
            "For " + answerLabel + ", here are the key insights and alerts");
        if (fixed.equals(text)) {
            fixed = text.replaceFirst("(?i)^\\s*For\\s+Sprint\\s+\\d+", "For " + answerLabel);
        }
        return fixed;
    }

    /**
     * Fixes replies that use a database id or invalid sprint number (e.g. "Sprint 5" when the project only has 4).
     */
    public static String enforceAnswerSprintLabel(
            String text, String expectedLabel, java.util.List<String> validSprintLabels) {
        return enforceAnswerSprintLabel(text, expectedLabel, validSprintLabels, null, null);
    }

    public static String enforceAnswerSprintLabel(
            String text,
            String expectedLabel,
            java.util.List<String> validSprintLabels,
            String previousSprintLabel,
            Long answerSprintDbId) {
        if (text == null || text.isBlank() || expectedLabel == null || expectedLabel.isBlank()) {
            return text;
        }
        Set<Integer> validNumbers = sprintNumbersFromLabels(validSprintLabels);
        int expectedNumber = sprintNumberFromLabel(expectedLabel);
        int previousNumber = sprintNumberFromLabel(previousSprintLabel);

        Matcher matcher = SPRINT_LABEL_MENTION.matcher(text);
        StringBuffer out = new StringBuffer();
        while (matcher.find()) {
            int mentioned = Integer.parseInt(matcher.group(1));
            String replacement = resolveSprintMentionReplacement(
                text,
                matcher.start(),
                mentioned,
                expectedLabel,
                previousSprintLabel,
                expectedNumber,
                previousNumber,
                validNumbers,
                answerSprintDbId);
            matcher.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    private static String resolveSprintMentionReplacement(
            String text,
            int matchStart,
            int mentioned,
            String expectedLabel,
            String previousSprintLabel,
            int expectedNumber,
            int previousNumber,
            Set<Integer> validNumbers,
            Long answerSprintDbId) {
        boolean comparedTo = isComparedToContext(text, matchStart);
        if (comparedTo && previousSprintLabel != null && !previousSprintLabel.isBlank()) {
            if (mentioned != previousNumber) {
                return previousSprintLabel;
            }
            return "Sprint " + mentioned;
        }
        if (answerSprintDbId != null && mentioned == answerSprintDbId.intValue() && mentioned != expectedNumber) {
            return expectedLabel;
        }
        if (!validNumbers.contains(mentioned)) {
            return expectedLabel;
        }
        if (mentioned != expectedNumber) {
            return expectedLabel;
        }
        return "Sprint " + mentioned;
    }

    private static boolean isComparedToContext(String text, int matchStart) {
        int from = Math.max(0, matchStart - 48);
        String before = text.substring(from, matchStart).toLowerCase(Locale.ROOT);
        return before.contains("compared to")
                || before.contains("compared with")
                || before.contains("versus sprint")
                || before.contains("vs sprint");
    }

    private static Set<Integer> sprintNumbersFromLabels(java.util.List<String> labels) {
        Set<Integer> numbers = new HashSet<>();
        if (labels == null) {
            return numbers;
        }
        for (String label : labels) {
            int n = sprintNumberFromLabel(label);
            if (n > 0) {
                numbers.add(n);
            }
        }
        return numbers;
    }

    private static int sprintNumberFromLabel(String label) {
        if (label == null || label.isBlank()) {
            return -1;
        }
        Matcher m = SPRINT_LABEL_MENTION.matcher(label.trim());
        if (m.find()) {
            return Integer.parseInt(m.group(1));
        }
        return -1;
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

    private static String replaceMetricPattern(Pattern pattern, String text, String replacementSuffix) {
        Matcher matcher = pattern.matcher(text);
        StringBuffer out = new StringBuffer();
        while (matcher.find()) {
            String prefix = matcher.group(1);
            matcher.appendReplacement(out, Matcher.quoteReplacement(prefix + replacementSuffix));
        }
        matcher.appendTail(out);
        return out.toString();
    }
}
