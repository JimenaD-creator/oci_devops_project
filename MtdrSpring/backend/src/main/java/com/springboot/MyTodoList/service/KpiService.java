package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.repository.KpiRepository;
import com.springboot.MyTodoList.repository.SprintRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;

@Service
public class KpiService {

    @Autowired
    private KpiRepository kpiRepository;

    @Autowired
    private SprintRepository sprintRepository;

    private BigDecimal extractBigDecimal(Map<String, Object> map, String key) {
        if (map == null || !map.containsKey(key) || map.get(key) == null) return null;
        Object value = map.get(key);
        if (value instanceof BigDecimal) return (BigDecimal) value;
        if (value instanceof Double)     return BigDecimal.valueOf((Double) value);
        if (value instanceof Number)     return new BigDecimal(value.toString());
        return null;
    }

    @Transactional
    public void calculateAndSaveKpisForSprint(Long sprintId) {
        Sprint sprint = sprintRepository.findById(sprintId).orElse(null);
        if (sprint == null) {
            System.err.println("[KpiService] Sprint not found: " + sprintId);
            return;
        }

        try {
            Map<String, Object> result = kpiRepository.getCompletionRate(sprintId);
            System.out.println("[KpiService] completionRate raw: " + result);
            BigDecimal val = extractBigDecimal(result, "COMPLETION_RATE");
            sprint.setCompletionRate(val != null ? val : BigDecimal.ZERO);
        } catch (Exception e) {
            System.err.println("[KpiService] completionRate failed: " + e.getMessage());
            sprint.setCompletionRate(BigDecimal.ZERO);
        }

        try {
            Map<String, Object> result = kpiRepository.getOnTimeDelivery(sprintId);
            System.out.println("[KpiService] onTimeDelivery raw: " + result);
            BigDecimal val = extractBigDecimal(result, "ON_TIME_DELIVERY");
            sprint.setOnTimeDelivery(val != null ? val : BigDecimal.ZERO);
        } catch (Exception e) {
            System.err.println("[KpiService] onTimeDelivery failed: " + e.getMessage());
            sprint.setOnTimeDelivery(BigDecimal.ZERO);
        }

        try {
            Map<String, Object> result = kpiRepository.getTeamParticipation(sprintId);
            System.out.println("[KpiService] teamParticipation raw: " + result);
            BigDecimal val = extractBigDecimal(result, "TEAM_PARTICIPATION");
            sprint.setTeamParticipation(val != null ? val : BigDecimal.ZERO);
        } catch (Exception e) {
            System.err.println("[KpiService] teamParticipation failed: " + e.getMessage());
            sprint.setTeamParticipation(BigDecimal.ZERO);
        }

        try {
            Map<String, Object> result = kpiRepository.getWorkloadBalance(sprintId);
            System.out.println("[KpiService] workloadBalance raw: " + result);
            BigDecimal val = extractBigDecimal(result, "WORKLOAD_BALANCE");
            sprint.setWorkloadBalance(val != null ? val : BigDecimal.ZERO);
        } catch (Exception e) {
            System.err.println("[KpiService] workloadBalance failed: " + e.getMessage());
            sprint.setWorkloadBalance(BigDecimal.ZERO);
        }

        sprintRepository.save(sprint);
        System.out.println("[KpiService] Saved KPIs for sprint " + sprintId +
            " → CR=" + sprint.getCompletionRate() +
            " OT=" + sprint.getOnTimeDelivery() +
            " TP=" + sprint.getTeamParticipation() +
            " WB=" + sprint.getWorkloadBalance());
    }

    @Scheduled(cron = "0 0 2 * * *")
    public void calculateAllSprintsKpis() {
        for (Sprint sprint : sprintRepository.findAll()) {
            calculateAndSaveKpisForSprint(sprint.getId());
        }
    }
}