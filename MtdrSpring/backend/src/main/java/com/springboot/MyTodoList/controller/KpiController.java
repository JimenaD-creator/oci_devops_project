package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.repository.KpiRepository;
import com.springboot.MyTodoList.service.KpiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/kpi")
public class KpiController {

    @Autowired
    private KpiRepository kpiRepository;

    @Autowired
    private KpiService kpiService;

    @GetMapping("/sprint/{sprintId}/completion-rate")
    public ResponseEntity<Map<String, Object>> getCompletionRate(@PathVariable Long sprintId) {
        try {
            Map<String, Object> result = kpiRepository.getCompletionRate(sprintId);
            if (result != null && !result.isEmpty()) return ResponseEntity.ok(result);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/sprint/{sprintId}/on-time-delivery")
    public ResponseEntity<Map<String, Object>> getOnTimeDelivery(@PathVariable Long sprintId) {
        try {
            Map<String, Object> result = kpiRepository.getOnTimeDelivery(sprintId);
            if (result != null && !result.isEmpty()) return ResponseEntity.ok(result);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/sprint/{sprintId}/contribution-score")
    public ResponseEntity<List<Map<String, Object>>> getContributionScore(@PathVariable Long sprintId) {
        try {
            List<Map<String, Object>> result = kpiRepository.getContributionScore(sprintId);
            if (result != null && !result.isEmpty()) return ResponseEntity.ok(result);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/sprint/{sprintId}/workload-balance")
    public ResponseEntity<Map<String, Object>> getWorkloadBalance(@PathVariable Long sprintId) {
        try {
            Map<String, Object> result = kpiRepository.getWorkloadBalance(sprintId);
            if (result != null && !result.isEmpty()) return ResponseEntity.ok(result);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/sprint/{sprintId}/team-participation")
    public ResponseEntity<Map<String, Object>> getTeamParticipation(@PathVariable Long sprintId) {
        try {
            Map<String, Object> result = kpiRepository.getTeamParticipation(sprintId);
            if (result != null && !result.isEmpty()) return ResponseEntity.ok(result);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/sprint/{sprintId}/all")
    public ResponseEntity<Map<String, Object>> getAllKpis(@PathVariable Long sprintId) {
        try {
            Map<String, Object> allKpis = new java.util.HashMap<>();
            allKpis.put("completionRate", kpiRepository.getCompletionRate(sprintId));
            allKpis.put("onTimeDelivery", kpiRepository.getOnTimeDelivery(sprintId));
            allKpis.put("contributionScore", kpiRepository.getContributionScore(sprintId));
            allKpis.put("workloadBalance", kpiRepository.getWorkloadBalance(sprintId));
            allKpis.put("teamParticipation", kpiRepository.getTeamParticipation(sprintId));
            return ResponseEntity.ok(allKpis);
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @PostMapping("/sprint/{sprintId}/calculate")
    public ResponseEntity<Map<String, String>> calculateKpis(@PathVariable Long sprintId) {
        try {
            kpiService.calculateAndSaveKpisForSprint(sprintId);
            return ResponseEntity.ok(Map.of("message", "KPIs calculated for sprint " + sprintId));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}