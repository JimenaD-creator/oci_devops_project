package com.springboot.MyTodoList.config;

import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Calendar-day comparisons for on-time KPIs (due dates from the date picker vs
 * {@code USER_TASK.completedAt} recorded on the server clock).
 */
@Component
public class DisplayTimezone {

    private static volatile ZoneId zone = ZoneId.of("America/Mexico_City");

    @Value("${app.display.timezone:America/Mexico_City}")
    public void setZone(String zoneId) {
        if (zoneId != null && !zoneId.isBlank()) {
            zone = ZoneId.of(zoneId.trim());
        }
    }

    public static ZoneId get() {
        return zone;
    }
}
