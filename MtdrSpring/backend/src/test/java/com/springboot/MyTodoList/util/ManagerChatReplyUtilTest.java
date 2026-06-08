package com.springboot.MyTodoList.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class ManagerChatReplyUtilTest {

    @Test
    void stripAiVsLiveKpiAsides_removesSummaryDiscrepancyParenthetical() {
        String input =
            "Alert: The completion rate is currently 67% (noted as 81% in the AI summary, but the live KPI is 67%). "
                + "This requires attention.";
        String out = ManagerChatReplyUtil.stripAiVsLiveKpiAsides(input);
        assertEquals(
            "Alert: The completion rate is currently 67%. This requires attention.",
            out);
    }

    @Test
    void alignProductivityScore_keepsSprintNumber_notScore() {
        String input = "The productivity score for Sprint 4 is 68.";
        String out = ManagerChatReplyUtil.alignProductivityScoreMentions(input, 72);
        assertEquals("The productivity score for Sprint 4 is 72%.", out);
    }

    @Test
    void alignProductivityScore_withoutSprintLabel() {
        String input = "The productivity score is 68";
        String out = ManagerChatReplyUtil.alignProductivityScoreMentions(input, 72);
        assertEquals("The productivity score is 72%", out);
    }

    @Test
    void alignProductivityScore_handlesOfPattern() {
        String input = "With a completion rate of 67% and a productivity score of 81";
        String out = ManagerChatReplyUtil.alignProductivityScoreMentions(input, 99);
        assertEquals("With a completion rate of 67% and a productivity score of 99%", out);
    }

    @Test
    void alignProductivityScore_doesNotTouchUnrelatedNumbers() {
        String input = "Sprint 4 has 12 tasks.";
        String out = ManagerChatReplyUtil.alignProductivityScoreMentions(input, 72);
        assertEquals(input, out);
    }

    @Test
    void alignProductivityVsPreviousInProse_fixesParentheticalFromSprint() {
        String input =
            "However, the current sprint shows a productivity score of 83% "
                + "(a decrease of 83% from Sprint 3).";
        String out = ManagerChatReplyUtil.alignProductivityVsPreviousInProse(input, -13, 83, "Sprint 3");
        org.junit.jupiter.api.Assertions.assertTrue(out.contains("decrease of 13 points"));
        org.junit.jupiter.api.Assertions.assertFalse(out.contains("decrease of 83%"));
        org.junit.jupiter.api.Assertions.assertTrue(out.contains("from Sprint 3"));
    }

    @Test
    void polishManagerChatReply_fixesExactUserReport() {
        String input =
            "For Sprint 5, here are the key insights and alerts:\n"
                + "Key Insights\n"
                + "•Productivity: The productivity score is 87, which is a decrease of 87% compared to Sprint 4.";
        java.util.Map<String, Integer> live = java.util.Map.of("productivityScore", 87);
        String out = ManagerChatReplyUtil.polishManagerChatReply(
            input,
            live,
            -13,
            "Sprint 4",
            "Sprint 3",
            java.util.List.of("Sprint 0", "Sprint 1", "Sprint 2", "Sprint 3", "Sprint 4"),
            4L);
        assertFalse(out.contains("Sprint 5"));
        assertFalse(out.contains("87% compared"));
        org.junit.jupiter.api.Assertions.assertTrue(out.contains("For Sprint 4"));
        org.junit.jupiter.api.Assertions.assertTrue(out.contains("decrease of 13 points"));
        org.junit.jupiter.api.Assertions.assertTrue(out.contains("compared to Sprint 3"));
    }

    @Test
    void enforceSingleSprintReply_fixesDbIdLeakAndComparedTo() {
        String input =
            "For Sprint 5, here are the key insights:\n"
                + "Productivity decreased by 13 points compared to Sprint 5.";
        String out = ManagerChatReplyUtil.enforceSingleSprintReply(
            input,
            "Sprint 4",
            "Sprint 3",
            java.util.List.of("Sprint 0", "Sprint 1", "Sprint 2", "Sprint 3", "Sprint 4"),
            4L);
        assertEquals(
            "For Sprint 4, here are the key insights:\n"
                + "Productivity decreased by 13 points compared to Sprint 3.",
            out);
    }

    @Test
    void enforceAnswerSprintLabel_replacesInvalidSprintNumber() {
        String input = "For Sprint 5, here are the key insights and alerts:";
        String out = ManagerChatReplyUtil.enforceAnswerSprintLabel(
                input, "Sprint 3", java.util.List.of("Sprint 0", "Sprint 1", "Sprint 2", "Sprint 3", "Sprint 4"));
        assertEquals("For Sprint 3, here are the key insights and alerts:", out);
    }

    @Test
    void enforceAnswerSprintLabel_replacesWrongValidSprintInSingleScope() {
        String input = "For Sprint 1, the team completed all tasks.";
        String out = ManagerChatReplyUtil.enforceAnswerSprintLabel(
                input, "Sprint 3", java.util.List.of("Sprint 0", "Sprint 1", "Sprint 2", "Sprint 3"));
        assertEquals("For Sprint 3, the team completed all tasks.", out);
    }

    @Test
    void stripInternalDataReferences_removesBackticksAndCamelCase() {
        String input = "Review trends: The `developerInsightTimeline` shows consistency.";
        String out = ManagerChatReplyUtil.stripInternalDataReferences(input);
        assertFalse(out.contains("developerInsightTimeline"));
        assertFalse(out.contains("`"));
    }
}
