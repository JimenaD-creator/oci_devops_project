package com.springboot.MyTodoList.controller;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.springboot.MyTodoList.repository.KpiRepository;
import com.springboot.MyTodoList.service.KpiService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = KpiController.class)
@AutoConfigureMockMvc(addFilters = false)
class KpiControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private KpiRepository kpiRepository;

    @MockBean
    private KpiService kpiService;

    @Test
    void getCompletionRate_whenFound_returnsOk() throws Exception {
        when(kpiRepository.getCompletionRate(1L)).thenReturn(Map.of("COMPLETION_RATE", 80));

        mockMvc.perform(get("/api/kpi/sprint/1/completion-rate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.COMPLETION_RATE").value(80));
    }

    @Test
    void getCompletionRate_whenEmpty_returnsNotFound() throws Exception {
        when(kpiRepository.getCompletionRate(2L)).thenReturn(Map.of());

        mockMvc.perform(get("/api/kpi/sprint/2/completion-rate")).andExpect(status().isNotFound());
    }

    @Test
    void getAllKpis_returnsAggregatedMap() throws Exception {
        when(kpiRepository.getCompletionRate(3L)).thenReturn(Map.of("COMPLETION_RATE", 50));
        when(kpiRepository.getOnTimeDelivery(3L)).thenReturn(Map.of("ON_TIME_DELIVERY", 60));
        when(kpiRepository.getContributionScore(3L)).thenReturn(List.of(Map.of("dev", "A")));
        when(kpiRepository.getWorkloadBalance(3L)).thenReturn(Map.of("WORKLOAD_BALANCE", 70));
when(kpiRepository.getEfficiencyScore(3L)).thenReturn(Map.of("EFFICIENCY_SCORE", 90));

        mockMvc.perform(get("/api/kpi/sprint/3/all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completionRate.COMPLETION_RATE").value(50));
    }

    @Test
    void getOnTimeDelivery_whenFound_returnsOk() throws Exception {
        when(kpiRepository.getOnTimeDelivery(4L)).thenReturn(Map.of("ON_TIME_DELIVERY", 55));

        mockMvc.perform(get("/api/kpi/sprint/4/on-time-delivery"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ON_TIME_DELIVERY").value(55));
    }

    @Test
    void getContributionScore_whenEmpty_returnsNotFound() throws Exception {
        when(kpiRepository.getContributionScore(6L)).thenReturn(List.of());

        mockMvc.perform(get("/api/kpi/sprint/6/contribution-score")).andExpect(status().isNotFound());
    }

    @Test
    void getOnTimeDelivery_whenEmpty_returnsNotFound() throws Exception {
        when(kpiRepository.getOnTimeDelivery(7L)).thenReturn(Map.of());

        mockMvc.perform(get("/api/kpi/sprint/7/on-time-delivery")).andExpect(status().isNotFound());
    }

    @Test
    void getWorkloadBalance_whenFound_returnsOk() throws Exception {
        when(kpiRepository.getWorkloadBalance(8L)).thenReturn(Map.of("WORKLOAD_BALANCE", 72));

        mockMvc.perform(get("/api/kpi/sprint/8/workload-balance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.WORKLOAD_BALANCE").value(72));
    }

    @Test
    void getWorkloadBalance_whenEmpty_returnsNotFound() throws Exception {
        when(kpiRepository.getWorkloadBalance(9L)).thenReturn(Map.of());

        mockMvc.perform(get("/api/kpi/sprint/9/workload-balance")).andExpect(status().isNotFound());
    }

 @Test
void getEfficiencyScore_whenFound_returnsOk() throws Exception {
    when(kpiRepository.getEfficiencyScore(10L)).thenReturn(Map.of("EFFICIENCY_SCORE", 88));

    mockMvc.perform(get("/api/kpi/sprint/10/efficiency-score"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.EFFICIENCY_SCORE").value(88));
}

@Test
void getEfficiencyScore_whenEmpty_returnsNotFound() throws Exception {
    when(kpiRepository.getEfficiencyScore(11L)).thenReturn(Map.of());

    mockMvc.perform(get("/api/kpi/sprint/11/efficiency-score")).andExpect(status().isNotFound());
}


    @Test
    void getContributionScore_whenFound_returnsList() throws Exception {
        when(kpiRepository.getContributionScore(12L))
                .thenReturn(List.of(Map.of("developerName", "Alice", "score", 90)));

        mockMvc.perform(get("/api/kpi/sprint/12/contribution-score"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].developerName").value("Alice"));
    }

    @Test
    void calculateKpis_delegatesToService() throws Exception {
        mockMvc.perform(post("/api/kpi/sprint/5/calculate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("KPIs calculated for sprint 5"));

        verify(kpiService).calculateAndSaveKpisForSprint(5L);
    }
}
