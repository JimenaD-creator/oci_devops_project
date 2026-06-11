package com.springboot.MyTodoList.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GeminiInsightKpiAlignUtilTest {

    @Test
    void onTimeDeclinedThreeConsecutiveSprints_detectsStrictDecrease() {
        assertTrue(GeminiInsightKpiAlignUtil.onTimeDeclinedThreeConsecutiveSprints(List.of(90, 70, 50)));
        assertFalse(GeminiInsightKpiAlignUtil.onTimeDeclinedThreeConsecutiveSprints(List.of(50, 70, 100)));
        assertFalse(GeminiInsightKpiAlignUtil.onTimeDeclinedThreeConsecutiveSprints(List.of(100, 100, 100)));
    }

    @Test
    void removeContradictoryOnTimeDeclineSentences_stripsFalseDeclineAt100() {
        String in = "On-Time Delivery has declined for three consecutive sprints, currently at 100%. "
            + "Focus on the remaining tasks.";
        String out = GeminiInsightKpiAlignUtil.removeContradictoryOnTimeDeclineSentences(
            in, List.of(80, 90, 100));
        assertFalse(out.toLowerCase().contains("declined"));
        assertTrue(out.contains("100%") || out.contains("remaining"));
    }

    @Test
    void alignAllLiveKpisInProse_replacesStaleOnTimePercent() {
        Map<String, Object> live = Map.of(
            "onTimeDelivery", 83,
            "productivityScore", 78);
        String out = GeminiInsightKpiAlignUtil.alignAllLiveKpisInProse(
            "On-Time Delivery has dropped to 60%; prioritizing tasks is essential.", live);
        assertTrue(out.contains("83%"));
        assertFalse(out.contains("60%"));
    }

    @Test
    void alertContradictsLiveOnTimeTrend_whenHistoryShowsImprovement() {
        String msg = "On-Time Delivery has declined for three consecutive sprints, currently at 100%.";
        assertTrue(GeminiInsightKpiAlignUtil.alertContradictsLiveOnTimeTrend(msg, List.of(60, 80, 100)));
    }

    @Test
    void isWeakTeamChangeSummary_detectsVagueGeminiParagraph() {
        String vague =
            "While the team is meeting deadlines for completed work, the overall throughput has slowed significantly.";
        assertTrue(GeminiInsightKpiAlignUtil.isWeakTeamChangeSummary(vague));
    }

    @Test
    void isWeakTeamChangeSummary_acceptsBriefWorkFocusedParagraph() {
        String good =
            "Sprint 4 is in progress; the goal is to ship the API. Assigned work shows 8 Done and 3 In review, "
                + "with one developer overloaded on open tasks. Compared with Sprint 3, completion is catching up "
                + "while finished items stay on schedule.";
        assertFalse(GeminiInsightKpiAlignUtil.isWeakTeamChangeSummary(good));
    }

    @Test
    void trimToMaxSentences_limitsLength() {
        String in = "One. Two. Three. Four. Five.";
        String out = GeminiInsightKpiAlignUtil.trimToMaxSentences(in, 3);
        assertEquals("One. Two. Three.", out);
    }

    @Test
    void polishSprintChangeSummary_fixesDuplicateTeamAndDanglingAt() {
        Map<String, Object> live = Map.of("completionRate", 72, "efficiencyScore", 65, "workloadBalance", 88);
        String in =
            "Sprint 4 is still in progress; compared with Sprint 3, the team, the team moved completion. "
                + "Completion rates remained stable at, and team participation stayed at.";
        String out = GeminiInsightKpiAlignUtil.polishSprintChangeSummary(in, live);
        assertFalse(out.toLowerCase(Locale.ROOT).contains("the team, the team"));
        assertTrue(out.contains("72%"));
        assertTrue(out.contains("65%"));
    }

    @Test
    void polishSprintChangeSummary_normalizesPercentagePoints() {
        Map<String, Object> live = Map.of(
            "completionRate", 70,
            "onTimeDelivery", 82,
            "efficiencyScore", 60,
            "workloadBalance", 75,
            "productivityScore", 78);
        String in =
            "Compared with Sprint 2, the team improved on-time delivery by 22 percentage points.";
        String out = GeminiInsightKpiAlignUtil.polishSprintChangeSummary(in, live);
        assertTrue(out.contains("%"));
        assertTrue(out.contains("82%"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("percentage points"));
    }

    @Test
    void sanitizeTeamChangeSummary_reframesOpenSprint_keepsKpiMentions() {
        String gemini =
            "From Sprint 3 to Sprint 4, the team moved completion and on-time delivery on completed work. "
                + "Fewer tasks reached Done than in the prior sprint, but finished assignments stayed largely on time. "
                + "Productivity declined, Participation declined, and Workload balance improved. "
                + "The team has Diego Carrillo managing blocked assignments compared with a more balanced prior sprint.";
        GeminiInsightKpiAlignUtil.SprintChangeContext ctx =
            new GeminiInsightKpiAlignUtil.SprintChangeContext("in_progress", 8, 12, 5, 10);
        assertTrue(GeminiInsightKpiAlignUtil.isUnacceptableTeamChangeSummary(gemini, ctx));
        String out = GeminiInsightKpiAlignUtil.polishSprintChangeSummary(
            GeminiInsightKpiAlignUtil.sanitizeTeamChangeSummary(gemini, ctx),
            Map.of(
                "completionRate", 70,
                "onTimeDelivery", 80,
                "efficiencyScore", 55,
                "workloadBalance", 78,
                "productivityScore", 68));
        assertFalse(out.isBlank());
        assertFalse(out.toLowerCase(Locale.ROOT).contains("the team, the team"));
        assertTrue(
            out.toLowerCase(Locale.ROOT).contains("productivity")
                || out.toLowerCase(Locale.ROOT).contains("participation"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("prior sprint"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("from sprint 3 to sprint 4"));
        assertTrue(out.toLowerCase(Locale.ROOT).contains("in progress")
            || out.toLowerCase(Locale.ROOT).contains("so far"));
        assertTrue(out.contains("Diego Carrillo") || out.contains("blocked"));
    }

    @Test
    void buildBriefTeamWorkSummary_mentionsTasksGoalAndWork() {
        GeminiInsightKpiAlignUtil.SprintChangeContext ctx =
            new GeminiInsightKpiAlignUtil.SprintChangeContext("in_progress", 10, 8, 5, 7);
        String out = GeminiInsightKpiAlignUtil.buildBriefTeamWorkSummary(
            "Sprint 3",
            "Sprint 4",
            "Sprint 0, Sprint 1, and Sprint 2",
            2,
            4,
            1,
            8,
            "Deliver the payment API",
            -6,
            3,
            "",
            ctx);
        assertTrue(out.contains("Sprint 4"));
        assertTrue(out.contains("Done"));
        assertTrue(out.contains("payment API"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("prior sprint"));
        assertTrue(out.split("(?<=[.!?])\\s+").length <= 4);
    }

    @Test
    void buildStructuredTeamChangeSummary_includesSprintsAndDeltas() {
        String out = GeminiInsightKpiAlignUtil.buildStructuredTeamChangeSummary(
            "Sprint 3",
            "Sprint 4",
            70,
            85,
            60,
            75,
            72,
            55,
            90,
            65,
            70,
            68,
            -15,
            5,
            5,
            -5,
            -4,
            "",
            null);
        assertTrue(out.contains("Sprint 3"));
        assertTrue(out.contains("Sprint 4"));
        assertFalse(out.matches(".*\\d+\\s*%.*"));
        assertTrue(out.contains("performance"));
    }

    @Test
    void buildHistoricalTeamChangeSummary_smallerScope_avoidsFalseRegression() {
        GeminiInsightKpiAlignUtil.SprintChangeContext ctx =
            new GeminiInsightKpiAlignUtil.SprintChangeContext("in_progress", 5, 10, 4, 8);
        List<String> labels = java.util.Arrays.asList("Sprint 0", "Sprint 1");
        List<int[]> metrics = java.util.Arrays.asList(
            new int[] { 80, 70, 50, 75, 55 },
            new int[] { 82, 75, 55, 70, 60 });
        String out = GeminiInsightKpiAlignUtil.buildHistoricalTeamChangeSummary(
            labels,
            "Sprint 2",
            metrics,
            78,
            80,
            60,
            65,
            62,
            -4,
            5,
            5,
            -5,
            2,
            "",
            ctx);
        assertTrue(out.contains("still in progress"));
        assertTrue(out.toLowerCase(Locale.ROOT).contains("fewer assigned tasks")
            || out.toLowerCase(Locale.ROOT).contains("fewer planned tasks"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("fewer items than in the latest prior sprint"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains(" so far"));
        assertFalse(out.contains("while the sprint remains open"));
        assertFalse(out.contains("with time still remaining"));
        assertFalse(out.contains("in the current sprint"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("prior sprint"));
        assertTrue(out.contains("Sprint 1"));
    }

    @Test
    void buildHistoricalTeamChangeSummary_openSprint_fourPriorSprints_readsNaturally() {
        GeminiInsightKpiAlignUtil.SprintChangeContext ctx =
            new GeminiInsightKpiAlignUtil.SprintChangeContext("in_progress", 8, 12, 5, 10);
        List<String> labels = java.util.Arrays.asList("Sprint 0", "Sprint 1", "Sprint 2", "Sprint 3");
        List<int[]> metrics = java.util.Arrays.asList(
            new int[] { 50, 60, 40, 70, 50 },
            new int[] { 60, 65, 45, 68, 52 },
            new int[] { 70, 72, 50, 72, 58 },
            new int[] { 82, 78, 58, 75, 62 });
        String out = GeminiInsightKpiAlignUtil.buildHistoricalTeamChangeSummary(
            labels,
            "Sprint 4",
            metrics,
            75,
            82,
            52,
            78,
            58,
            -7,
            4,
            -6,
            3,
            -4,
            "",
            ctx);
        assertTrue(out.contains("live snapshot"));
        assertTrue(out.contains("Sprint 0"));
        assertTrue(out.contains("Sprint 3"));
        assertFalse(out.contains("while the sprint remains open"));
        assertFalse(out.contains("with time still remaining"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains(" so far"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("prior sprint"));
    }

    @Test
    void lacksHowAndWhyInsight_detectsDirectionOnlyText() {
        String flat =
            "Compared with Sprint 2, Sprint 3 shows the team improved completion and participation held steady.";
        assertTrue(GeminiInsightKpiAlignUtil.lacksHowAndWhyInsight(flat));
    }

    @Test
    void buildHistoricalTeamChangeSummary_coversMultiplePriorSprints() {
        List<String> labels = java.util.Arrays.asList("Sprint 0", "Sprint 1");
        List<int[]> metrics = java.util.Arrays.asList(
            new int[] { 40, 70, 50, 75, 55 },
            new int[] { 50, 75, 55, 70, 60 });
        String out = GeminiInsightKpiAlignUtil.buildHistoricalTeamChangeSummary(
            labels,
            "Sprint 2",
            metrics,
            60,
            80,
            60,
            65,
            62,
            10,
            5,
            5,
            -5,
            2,
            "",
            null);
        assertTrue(out.contains("Sprint 1"));
        assertTrue(out.contains("Sprint 2"));
        assertTrue(out.contains("Compared with every earlier sprint"));
        assertTrue(out.contains("Sprint 0"));
        assertTrue(out.contains("Sprint 1"));
        assertTrue(out.contains("Entering Sprint 2"));
    }

    @Test
    void isMechanicalExecutiveTrends_detectsSemicolonChecklist() {
        assertTrue(GeminiInsightKpiAlignUtil.isMechanicalExecutiveTrends(
            "Compared with Sprint 4: Productivity declined; completion throughput declined; "
                + "on-time delivery on finished work improved."));
    }

    @Test
    void refineExecutiveTrends_keepsNaturalGeminiText() {
        String gemini =
            "Productivity improved compared with Sprint 3, while on-time delivery held steady.";
        String out = GeminiInsightKpiAlignUtil.refineExecutiveTrends(
            gemini, "Sprint 3", -16, -20, 5, -10, 8, null);
        assertEquals(gemini, out);
    }

    @Test
    void refineExecutiveTrends_replacesMechanicalChecklistWithNarrative() {
        String mechanical =
            "Compared with Sprint 4: Productivity declined; completion throughput declined; "
                + "on-time delivery on finished work improved; team participation declined.";
        String out = GeminiInsightKpiAlignUtil.refineExecutiveTrends(
            mechanical, "Sprint 4", -16, -20, 5, -10, 8, null);
        assertFalse(out.contains(";"));
        assertTrue(out.toLowerCase(Locale.ROOT).contains("compared with sprint 4"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("81%"));
    }

    @Test
    void hasRepetitiveSoftTrendLanguage_detectsOveruse() {
        assertTrue(GeminiInsightKpiAlignUtil.hasRepetitiveSoftTrendLanguage(
            "Productivity softened, while completion softened compared with Sprint 3. "
                + "Softer productivity is tied more to completion pace."));
        assertFalse(GeminiInsightKpiAlignUtil.hasRepetitiveSoftTrendLanguage(
            "Productivity slipped compared with Sprint 3, while on-time delivery held steady."));
    }

    @Test
    void normalizePercentagePointsLabel_keepsGeminiWordingAddsPercentSymbol() {
        String gemini =
            "Productivity improved by 21 percentage points compared to the previous sprint, "
                + "while On-Time Delivery increased by 70 percentage points.";
        String out = GeminiInsightKpiAlignUtil.normalizePercentagePointsLabel(gemini);
        assertTrue(out.contains("21%"));
        assertTrue(out.contains("70%"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("percentage point"));
        assertTrue(out.contains("compared to the previous sprint"));
        assertTrue(out.contains("while On-Time Delivery increased"));
    }

    @Test
    void refineExecutiveTrends_keepsNormalizedPercentagePointTrends() {
        String gemini =
            "Productivity improved by 21 percentage points compared to the previous sprint, "
                + "while On-Time Delivery increased by 70 percentage points.";
        String out = GeminiInsightKpiAlignUtil.refineExecutiveTrends(
            gemini, "Sprint 3", 21, 0, 70, 0, 0, null);
        assertTrue(out.contains("21%"));
        assertTrue(out.contains("70%"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("percentage point"));
        assertTrue(out.contains("compared to the previous sprint"));
    }

    @Test
    void refineExecutiveTrends_replacesRepetitiveSoftGeminiText() {
        String repetitive =
            "So far, productivity softened, while completion softened compared with Sprint 3. "
                + "Softer productivity is tied more to completion pace than to missed dates on finished work.";
        String out = GeminiInsightKpiAlignUtil.refineExecutiveTrends(
            repetitive, "Sprint 3", -12, -15, 4, 0, 2, null);
        assertFalse(GeminiInsightKpiAlignUtil.hasRepetitiveSoftTrendLanguage(out));
        assertTrue(out.toLowerCase(Locale.ROOT).contains("slipped"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("softened"));
    }

    @Test
    void buildExecutiveTrendsNarrative_productivityAndCompletionDown_avoidsSoftRepetition() {
        String out = GeminiInsightKpiAlignUtil.buildExecutiveTrendsNarrative(
            "Sprint 3", -12, -15, 4, 0, 2, null);
        assertFalse(GeminiInsightKpiAlignUtil.hasRepetitiveSoftTrendLanguage(out));
        assertTrue(out.contains("productivity and completion slipped"));
        assertTrue(out.length() <= 180);
    }

    @Test
    void buildExecutiveTrendsNarrative_openSprintWithPending_explainsLiveScore() {
        GeminiInsightKpiAlignUtil.SprintChangeContext ctx =
            new GeminiInsightKpiAlignUtil.SprintChangeContext("in_progress", 32, 28, 12, 24);
        String out = GeminiInsightKpiAlignUtil.buildExecutiveTrendsNarrative(
            "Sprint 3", -14, -18, 2, 0, 1, ctx);
        assertTrue(out.toLowerCase(Locale.ROOT).contains("compared with the previous sprint"));
        assertTrue(out.toLowerCase(Locale.ROOT).contains("still open"));
        assertTrue(out.toLowerCase(Locale.ROOT).contains("not finished"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("provisional"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("trails"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("both slipped"));
        assertTrue(out.length() <= 180);
        assertEquals(1, out.split("(?<=[.!?])\\s+").length);
    }

    @Test
    void ensureOpenSprintProductivityFraming_replacesVagueGeminiWithDirectLine() {
        GeminiInsightKpiAlignUtil.SprintChangeContext ctx =
            new GeminiInsightKpiAlignUtil.SprintChangeContext("in_progress", 20, 18, 6, 16);
        String gemini = "Productivity is lower than Sprint 3 with completion trailing.";
        String out = GeminiInsightKpiAlignUtil.ensureOpenSprintProductivityFraming(
            gemini, ctx, -10, "Sprint 3");
        assertTrue(out.toLowerCase(Locale.ROOT).contains("still open"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("provisional"));
    }

    @Test
    void condenseExecutiveTrends_keepsAtMostTwoSentences() {
        String longText =
            "First sentence about Sprint 3. Second sentence adds detail. Third should be dropped.";
        String out = GeminiInsightKpiAlignUtil.condenseExecutiveTrends(longText);
        assertEquals(2, out.split("(?<=[.!?])\\s+").length);
    }

    @Test
    void refineExecutiveTrends_replacesOverlongGeminiText() {
        String longGemini =
            "Compared with Sprint 3, productivity is lower because many tasks remain in progress or review, "
                + "completion has not caught up yet, and the composite score should be read as a live snapshot "
                + "rather than a final judgment on the team.";
        String out = GeminiInsightKpiAlignUtil.refineExecutiveTrends(
            longGemini, "Sprint 3", -12, -15, 2, 0, 1, null);
        assertTrue(out.length() <= 180);
    }

    @Test
    void buildExecutiveTrendsNarrative_smallerScopeWithImprovedProductivity_usesNaturalPhrasing() {
        GeminiInsightKpiAlignUtil.SprintChangeContext ctx =
            new GeminiInsightKpiAlignUtil.SprintChangeContext("in_progress", 5, 10, 4, 8);
        String out = GeminiInsightKpiAlignUtil.buildExecutiveTrendsNarrative(
            "Sprint 2", 10, 2, 4, 0, 3, ctx);
        assertTrue(out.toLowerCase(Locale.ROOT).contains("compared with sprint 2"));
        assertTrue(out.toLowerCase(Locale.ROOT).contains("productivity strengthened"));
        assertFalse(out.contains(";"));
    }

    @Test
    void fixBrokenMetricPhrases_repairsStrippedPercentages() {
        String broken =
            "From Sprint 3 to Sprint 4, the team moved from to completion and to on-time delivery on completed work.";
        String out = GeminiInsightKpiAlignUtil.fixBrokenMetricPhrases(broken);
        assertFalse(out.toLowerCase(Locale.ROOT).contains("from to"));
    }

    @Test
    void appendCausalInsightIfThin_addsDrivers() {
        String thin =
            "Compared with Sprint 2, Sprint 3 reflects a shift in how the team delivers.";
        String out = GeminiInsightKpiAlignUtil.appendCausalInsightIfThin(
            thin, -10, 2, 0, -8, -5, "", null);
        assertFalse(GeminiInsightKpiAlignUtil.lacksHowAndWhyInsight(out));
        assertTrue(
            out.contains("bottleneck")
                || out.contains("which often means")
                || out.contains("which points to")
                || out.contains("heaviest queue")
                || out.contains("slipped"));
    }

    @Test
    void stripMetricNumbersFromTeamChangeSummary_removesPercentages() {
        String in =
            "Compared with Sprint 3, completion improved by 8 points (70% → 78%) and on-time held at 85%.";
        String out = GeminiInsightKpiAlignUtil.stripMetricNumbersFromTeamChangeSummary(in);
        assertFalse(out.contains("%"));
        assertFalse(out.toLowerCase().contains("8 points"));
        assertTrue(out.contains("Compared with Sprint 3"));
    }

    @Test
    void buildFallbackTeamEvolutionSummary_focusesOnTeamRhythm() {
        String out = GeminiInsightKpiAlignUtil.buildFallbackTeamEvolutionSummary(
            "Sprint 1", "Sprint 2", 5, 10, 0, -3, 8, "Maria appears overloaded this sprint.");
        assertTrue(out.contains("team"));
        assertTrue(out.contains("Sprint 1"));
        assertTrue(out.contains("Maria"));
    }

    @Test
    void alignAllLiveKpisInProse_doesNotSwapProductivityIntoOnTimeClause() {
        Map<String, Object> live = Map.of(
            "productivityScore", 97,
            "onTimeDelivery", 71,
            "completionRate", 80,
            "efficiencyScore", 60,
            "workloadBalance", 75);
        String in =
            "Productivity increased by 6 points compared to the previous sprint, "
                + "driven by a 97% improvement in on-time delivery.";
        String out = GeminiInsightKpiAlignUtil.alignAllLiveKpisInProse(in, live);
        assertTrue(out.toLowerCase(Locale.ROOT).contains("on-time delivery at 71%"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("97% improvement in on-time"));
    }

    @Test
    void alignCompletionRatePercentLabels_fixesOnTimeCitedAsCompletion() {
        String in =
            "The team achieved a 93% completion rate and a strong on-time delivery performance this sprint.";
        String out =
            GeminiInsightKpiAlignUtil.alignCompletionRatePercentLabels(in, 68, 93);
        assertTrue(out.toLowerCase(Locale.ROOT).contains("93% on-time delivery"));
        assertFalse(out.toLowerCase(Locale.ROOT).contains("93% completion rate"));
    }

    @Test
    void fixProductivityPercentMisattributedToOnTime_rewritesMisattributedClause() {
        Map<String, Object> live = Map.of("productivityScore", 97, "onTimeDelivery", 71);
        String in =
            "Productivity increased by 6 points compared to the previous sprint, "
                + "driven by a 97% improvement in on-time delivery.";
        String out = GeminiInsightKpiAlignUtil.fixProductivityPercentMisattributedToOnTime(in, live);
        assertTrue(out.toLowerCase(Locale.ROOT).contains("with on-time delivery at 71%"));
    }

    @Test
    void alignProductivityTrendDeltaInProse_replacesRelativePercentWithPoints() {
        String gemini =
            "Productivity decreased by 24% compared to the previous sprint as work is still in progress.";
        String out = GeminiInsightKpiAlignUtil.alignProductivityTrendDeltaInProse(gemini, -15);
        assertTrue(out.contains("decreased by 15 points"));
        assertFalse(out.contains("24%"));
        assertTrue(out.contains("work is still in progress"));
    }

    @Test
    void productivityForecastTrend_treatsOnePointDropAtPerfectScoreAsStable() {
        assertEquals("stable", GeminiInsightKpiAlignUtil.productivityForecastTrend(100, 99));
        assertEquals("down", GeminiInsightKpiAlignUtil.productivityForecastTrend(100, 97));
    }

    @Test
    void resolveForecastPredictedScore_snapsToLiveWhenWithinStabilityBand() {
        assertEquals(100, GeminiInsightKpiAlignUtil.resolveForecastPredictedScore(100, 99));
        assertEquals(97, GeminiInsightKpiAlignUtil.resolveForecastPredictedScore(100, 97));
    }

    @Test
    void alignProductivityStableLevelInProse_replacesRoundedGeminiScoreWithLive() {
        String gemini =
            "Productivity remained stable at 100 points compared to the previous sprint.";
        String out = GeminiInsightKpiAlignUtil.alignProductivityStableLevelInProse(gemini, 99);
        assertEquals(
            "Productivity remained stable at 99 points compared to the previous sprint.",
            out);
    }

    @Test
    void detectGenerationKpiDrift_flagsProductivityChange() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode snapshot = mapper.readTree(
            "{\"kpis\":{\"completionRate\":100,\"onTimeDelivery\":100,\"efficiencyScore\":80,"
                + "\"workloadBalance\":70,\"productivityScore\":99},"
                + "\"taskStatusBreakdown\":{\"total\":10,\"done\":10,\"toDo\":0,\"inProgress\":0,\"inReview\":0}}");
        Map<String, Object> live = Map.of(
            "completionRate", 100,
            "onTimeDelivery", 100,
            "efficiencyScore", 80,
            "workloadBalance", 70,
            "productivityScore", 97);
        JsonNode liveBreakdown = mapper.readTree(
            "{\"total\":10,\"done\":10,\"toDo\":0,\"inProgress\":0,\"inReview\":0}");
        List<String> changed =
            GeminiInsightKpiAlignUtil.detectGenerationKpiDrift(snapshot, live, liveBreakdown);
        assertTrue(changed.contains("productivityScore"));
    }

    @Test
    void alignProductivityTrendDeltaInProse_replacesWrongPointDeltaWithLivePoints() {
        String gemini = "Productivity decreased by 18 points compared to the previous sprint.";
        String out = GeminiInsightKpiAlignUtil.alignProductivityTrendDeltaInProse(gemini, -13);
        assertTrue(out.contains("decreased by 13 points"));
        assertFalse(out.contains("18 points"));
    }

    @Test
    void reconcileOnTimeDeliveryConcernProse_fixesPrimaryConcernAt100() {
        String in = "On-Time Delivery is the primary concern, having is at 100%. "
            + "Prioritizing the resolution of blocked tasks is essential.";
        String out = GeminiInsightKpiAlignUtil.alignAllLiveKpisInProse(
            in, Map.of("onTimeDelivery", 100, "productivityScore", 72));
        assertFalse(out.toLowerCase().contains("primary concern"));
        assertTrue(out.contains("100%"));
        assertTrue(out.contains("blocked tasks"));
        assertFalse(out.contains("having is at"));
    }
}
