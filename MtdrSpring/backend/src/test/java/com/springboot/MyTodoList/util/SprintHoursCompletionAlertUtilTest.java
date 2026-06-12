package com.springboot.MyTodoList.util;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SprintHoursCompletionAlertUtilTest {

    @Test
    void buildAlert_moreHoursPerCompletedTask_warningWhenSprintEnded() {
        var current = new SprintHoursCompletionAlertUtil.DeliverySnapshot(10, 50.0);
        var previous = new SprintHoursCompletionAlertUtil.DeliverySnapshot(10, 32.0);

        Map<String, Object> alert = SprintHoursCompletionAlertUtil.buildAlert(
                        current, previous, "Sprint 2", true, false)
                .orElseThrow();

        assertEquals("warning", alert.get("severity"));
        assertEquals("sprintComparison", alert.get("kpi"));
        assertEquals(SprintHoursCompletionAlertUtil.ALERT_SOURCE, alert.get("alertSource"));
        assertNull(alert.get("value"));
        assertTrue(alert.get("message").toString().contains("more hours per completed task"));
        assertTrue(alert.get("message").toString().contains("Sprint 2"));
    }

    @Test
    void buildAlert_moreHoursPerCompletedTask_infoWhenSprintInProgress() {
        var current = new SprintHoursCompletionAlertUtil.DeliverySnapshot(8, 40.0);
        var previous = new SprintHoursCompletionAlertUtil.DeliverySnapshot(8, 24.0);

        Map<String, Object> alert = SprintHoursCompletionAlertUtil.buildAlert(
                        current, previous, "Sprint 1", false, false)
                .orElseThrow();

        assertEquals("info", alert.get("severity"));
    }

    @Test
    void buildAlert_fewerHoursSimilarCompletion_info() {
        var current = new SprintHoursCompletionAlertUtil.DeliverySnapshot(12, 24.0);
        var previous = new SprintHoursCompletionAlertUtil.DeliverySnapshot(12, 40.0);

        Map<String, Object> alert = SprintHoursCompletionAlertUtil.buildAlert(
                        current, previous, "Sprint 2", true, false)
                .orElseThrow();

        assertEquals("info", alert.get("severity"));
        assertTrue(alert.get("message").toString().contains("fewer hours per completed task"));
    }

    @Test
    void buildAlert_fewerHoursMuchLowerCompletion_warning() {
        var current = new SprintHoursCompletionAlertUtil.DeliverySnapshot(5, 5.0);
        var previous = new SprintHoursCompletionAlertUtil.DeliverySnapshot(15, 30.0);

        Map<String, Object> alert = SprintHoursCompletionAlertUtil.buildAlert(
                        current, previous, "Sprint 2", true, false)
                .orElseThrow();

        assertEquals("warning", alert.get("severity"));
        assertTrue(alert.get("message").toString().contains("completed tasks dropped"));
    }

    @Test
    void buildAlert_showsPriorBaselineWhenCurrentHasNoCompletions() {
        var current = new SprintHoursCompletionAlertUtil.DeliverySnapshot(0, 10.0);
        var previous = new SprintHoursCompletionAlertUtil.DeliverySnapshot(5, 20.0);

        Map<String, Object> alert = SprintHoursCompletionAlertUtil.buildAlert(
                        current, previous, "Sprint 1", true, false)
                .orElseThrow();

        assertTrue(alert.get("message").toString().contains("No completed tasks yet this sprint"));
        assertTrue(alert.get("message").toString().contains("Sprint 1"));
    }

    @Test
    void buildAlert_emptyWhenNeitherSprintHasCompletions() {
        var current = new SprintHoursCompletionAlertUtil.DeliverySnapshot(0, 0.0);
        var previous = new SprintHoursCompletionAlertUtil.DeliverySnapshot(0, 0.0);

        assertTrue(SprintHoursCompletionAlertUtil.buildAlert(
                        current, previous, "Sprint 1", true, false)
                .isEmpty());
    }

    @Test
    void buildAlert_showsComparisonDuringEarlySnapshot() {
        var current = new SprintHoursCompletionAlertUtil.DeliverySnapshot(5, 20.0);
        var previous = new SprintHoursCompletionAlertUtil.DeliverySnapshot(5, 10.0);

        Map<String, Object> alert = SprintHoursCompletionAlertUtil.buildAlert(
                        current, previous, "Sprint 1", false, true)
                .orElseThrow();

        assertEquals("info", alert.get("severity"));
        assertTrue(alert.get("message").toString().contains("Early sprint snapshot"));
        assertTrue(alert.get("message").toString().contains("more hours per completed task"));
    }

    @Test
    void buildAlert_stableComparisonWhenRatesAreSimilar() {
        var current = new SprintHoursCompletionAlertUtil.DeliverySnapshot(10, 40.0);
        var previous = new SprintHoursCompletionAlertUtil.DeliverySnapshot(10, 38.0);

        Map<String, Object> alert = SprintHoursCompletionAlertUtil.buildAlert(
                        current, previous, "Sprint 2", true, false)
                .orElseThrow();

        assertEquals("info", alert.get("severity"));
        assertTrue(alert.get("message").toString().contains("Compared with Sprint 2"));
        assertTrue(alert.get("message").toString().contains("h per completed task"));
        assertTrue(alert.get("message").toString().contains("5%"));
    }

    @Test
    void formatHoursPerTaskRateChange_describesDirection() {
        assertTrue(SprintHoursCompletionAlertUtil.formatHoursPerTaskRateChange(0.12).contains("increased 12%"));
        assertTrue(SprintHoursCompletionAlertUtil.formatHoursPerTaskRateChange(-0.18).contains("decreased 18%"));
        assertTrue(SprintHoursCompletionAlertUtil.formatHoursPerTaskRateChange(0.02).contains("similar"));
    }

    @Test
    void deliverySnapshot_fromLiveKpis_readsTotals() {
        var snap = SprintHoursCompletionAlertUtil.DeliverySnapshot.fromLiveKpis(
                Map.of("totalCompleted", 7, "totalWorkedHours", 14.5));

        assertEquals(7, snap.getCompletedTasks());
        assertEquals(14.5, snap.getWorkedHours(), 0.001);
    }

    @Test
    void alertsAlreadyContainHoursVsPrevious_detectsSource() {
        ArrayNode alerts = JsonNodeFactory.instance.arrayNode();
        ObjectNode existing = JsonNodeFactory.instance.objectNode();
        existing.put("alertSource", SprintHoursCompletionAlertUtil.ALERT_SOURCE);
        alerts.add(existing);

        assertTrue(SprintHoursCompletionAlertUtil.alertsAlreadyContainHoursVsPrevious(alerts));
    }

    @Test
    void removeHoursVsPreviousAlerts_dropsOnlyInjectedRows() {
        ArrayNode alerts = JsonNodeFactory.instance.arrayNode();
        ObjectNode injected = JsonNodeFactory.instance.objectNode();
        injected.put("alertSource", SprintHoursCompletionAlertUtil.ALERT_SOURCE);
        alerts.add(injected);
        ObjectNode other = JsonNodeFactory.instance.objectNode();
        other.put("kpi", "completionRate");
        alerts.add(other);

        SprintHoursCompletionAlertUtil.removeHoursVsPreviousAlerts(alerts);

        assertEquals(1, alerts.size());
        assertEquals("completionRate", alerts.get(0).get("kpi").asText());
    }

    @Test
    void completionCountsSimilar_withinTolerance() {
        assertTrue(SprintHoursCompletionAlertUtil.completionCountsSimilar(10, 11));
        assertFalse(SprintHoursCompletionAlertUtil.completionCountsSimilar(8, 12));
    }
}
