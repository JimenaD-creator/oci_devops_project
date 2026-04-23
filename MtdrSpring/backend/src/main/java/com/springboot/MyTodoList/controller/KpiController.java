package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.repository.KpiRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/kpi")
public class KpiController {
    
    @Autowired
    private KpiRepository kpiRepository;
    
    /**
     * Get completion rate for a sprint
     * Endpoint: GET /api/kpi/sprint/{sprintId}/completion-rate
     * 
     * This KPI shows what percentage of tasks are completed in the sprint
     * Returns JSON with completion_rate (0-1 scale)
     */
    @GetMapping("/sprint/{sprintId}/completion-rate")
    public ResponseEntity<Map<String, Object>> getCompletionRate(@PathVariable Long sprintId) {
        try {
            Map<String, Object> result = kpiRepository.getCompletionRate(sprintId);
            if (result != null && !result.isEmpty()) {
                return ResponseEntity.ok(result);
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }
    
    /**
     * Get on-time delivery rate for a sprint
     * Endpoint: GET /api/kpi/sprint/{sprintId}/on-time-delivery
     * 
     * This KPI shows what percentage of completed tasks were delivered on time
     * Returns JSON with on_time_delivery (0-1 scale)
     */
    @GetMapping("/sprint/{sprintId}/on-time-delivery")
    public ResponseEntity<Map<String, Object>> getOnTimeDelivery(@PathVariable Long sprintId) {
        try {
            Map<String, Object> result = kpiRepository.getOnTimeDelivery(sprintId);
            if (result != null && !result.isEmpty()) {
                return ResponseEntity.ok(result);
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }
    
    /**
     * Get contribution score for a sprint
     * Endpoint: GET /api/kpi/sprint/{sprintId}/contribution-score
     * 
     * This KPI shows how much each team member contributed to the sprint
     * Returns JSON with each user's contribution_score (0-1 scale)
     */
    @GetMapping("/sprint/{sprintId}/contribution-score")
    public ResponseEntity<Map<String, Object>> getContributionScore(@PathVariable Long sprintId) {
        try {
            Map<String, Object> result = kpiRepository.getContributionScore(sprintId);
            if (result != null && !result.isEmpty()) {
                return ResponseEntity.ok(result);
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }
    
    /**
     * Get workload balance for a sprint
     * Endpoint: GET /api/kpi/sprint/{sprintId}/workload-balance
     * 
     * This KPI shows if tasks are evenly distributed among team members
     * 1.0 = perfectly balanced, 0.0 = highly unbalanced
     * Returns JSON with workload_balance (0-1 scale)
     */
    @GetMapping("/sprint/{sprintId}/workload-balance")
    public ResponseEntity<Map<String, Object>> getWorkloadBalance(@PathVariable Long sprintId) {
        try {
            Map<String, Object> result = kpiRepository.getWorkloadBalance(sprintId);
            if (result != null && !result.isEmpty()) {
                return ResponseEntity.ok(result);
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }
    
    /**
     * Get team participation rate for a sprint
     * Endpoint: GET /api/kpi/sprint/{sprintId}/team-participation
     * 
     * This KPI shows what percentage of expected hours were actually worked
     * Formula: total_worked_hours / total_expected_hours
     * Returns JSON with team_participation (0-1 scale)
     */
    @GetMapping("/sprint/{sprintId}/team-participation")
    public ResponseEntity<Map<String, Object>> getTeamParticipation(@PathVariable Long sprintId) {
        try {
            Map<String, Object> result = kpiRepository.getTeamParticipation(sprintId);
            if (result != null && !result.isEmpty()) {
                return ResponseEntity.ok(result);
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }
    
    /**
     * Get all KPIs for a sprint in one call
     * Endpoint: GET /api/kpi/sprint/{sprintId}/all
     * 
     * Convenience endpoint that returns all KPI metrics for a sprint at once
     * Useful for dashboards
     */
    @GetMapping("/sprint/{sprintId}/all")
    public ResponseEntity<Map<String, Map<String, Object>>> getAllKpis(@PathVariable Long sprintId) {
        try {
            Map<String, Map<String, Object>> allKpis = new java.util.HashMap<>();
            allKpis.put("completionRate", kpiRepository.getCompletionRate(sprintId));
            allKpis.put("onTimeDelivery", kpiRepository.getOnTimeDelivery(sprintId));
            allKpis.put("contributionScore", kpiRepository.getContributionScore(sprintId));
            allKpis.put("workloadBalance", kpiRepository.getWorkloadBalance(sprintId));
            allKpis.put("teamParticipation", kpiRepository.getTeamParticipation(sprintId));
            
            if (!allKpis.isEmpty()) {
                return ResponseEntity.ok(allKpis);
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }
}
