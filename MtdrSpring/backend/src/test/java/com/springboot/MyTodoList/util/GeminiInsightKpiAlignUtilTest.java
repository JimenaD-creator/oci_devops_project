package com.springboot.MyTodoList.util;

import org.junit.jupiter.api.Test;

import java.util.List;
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
