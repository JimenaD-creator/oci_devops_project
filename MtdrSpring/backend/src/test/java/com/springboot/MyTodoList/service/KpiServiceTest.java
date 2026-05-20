package com.springboot.MyTodoList.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.repository.KpiRepository;
import com.springboot.MyTodoList.repository.SprintRepository;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class KpiServiceTest {

    @Mock
    private KpiRepository kpiRepository;

    @Mock
    private SprintRepository sprintRepository;

    @InjectMocks
    private KpiService kpiService;

    @Test
    void calculateAndSaveKpisForSprint_whenSprintMissing_doesNotSave() {
        when(sprintRepository.findById(99L)).thenReturn(Optional.empty());

        kpiService.calculateAndSaveKpisForSprint(99L);

        verify(sprintRepository).findById(99L);
    }

    @Test
    void calculateAndSaveKpisForSprint_persistsMetrics() {
        Sprint sprint = new Sprint();
        sprint.setId(1L);

        when(sprintRepository.findById(1L)).thenReturn(Optional.of(sprint));
        when(kpiRepository.getCompletionRate(1L)).thenReturn(Map.of("COMPLETION_RATE", 75.5));
        when(kpiRepository.getOnTimeDelivery(1L)).thenReturn(Map.of("ON_TIME_DELIVERY", 80));
        when(kpiRepository.getTeamParticipation(1L)).thenReturn(Map.of("TEAM_PARTICIPATION", 90));
        when(kpiRepository.getWorkloadBalance(1L)).thenReturn(Map.of("WORKLOAD_BALANCE", 65));
        when(sprintRepository.save(any(Sprint.class))).thenAnswer(inv -> inv.getArgument(0));

        kpiService.calculateAndSaveKpisForSprint(1L);

        assertNotNull(sprint.getCompletionRate());
        assertEquals(0, BigDecimal.valueOf(75.5).compareTo(sprint.getCompletionRate()));
        verify(sprintRepository).save(sprint);
    }

    @Test
    void calculateAndSaveKpisForSprint_onRepositoryError_setsZero() {
        Sprint sprint = new Sprint();
        sprint.setId(2L);

        when(sprintRepository.findById(2L)).thenReturn(Optional.of(sprint));
        when(kpiRepository.getCompletionRate(2L)).thenThrow(new RuntimeException("db"));
        when(kpiRepository.getOnTimeDelivery(2L)).thenReturn(Map.of());
        when(kpiRepository.getTeamParticipation(2L)).thenReturn(Map.of());
        when(kpiRepository.getWorkloadBalance(2L)).thenReturn(Map.of());
        when(sprintRepository.save(any(Sprint.class))).thenAnswer(inv -> inv.getArgument(0));

        kpiService.calculateAndSaveKpisForSprint(2L);

        assertEquals(0, sprint.getCompletionRate().compareTo(BigDecimal.ZERO));
    }
}
