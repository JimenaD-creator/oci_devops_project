package com.springboot.MyTodoList.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.repository.SprintRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SprintServiceTest {

    @Mock
    private SprintRepository sprintRepository;

    @InjectMocks
    private SprintService sprintService;

    @Test
    void findAll_returnsRepositoryResult() {
        Sprint sprint = new Sprint();
        sprint.setId(1L);
        when(sprintRepository.findAll()).thenReturn(List.of(sprint));

        List<Sprint> result = sprintService.findAll();

        assertEquals(1, result.size());
        assertEquals(1L, result.get(0).getId());
        verify(sprintRepository).findAll();
    }

    @Test
    void findById_whenPresent_returnsSprint() {
        Sprint sprint = new Sprint();
        sprint.setId(5L);
        when(sprintRepository.findById(5L)).thenReturn(Optional.of(sprint));

        assertEquals(5L, sprintService.findById(5L).getId());
    }

    @Test
    void findById_whenMissing_returnsNull() {
        when(sprintRepository.findById(99L)).thenReturn(Optional.empty());

        assertNull(sprintService.findById(99L));
    }
}
