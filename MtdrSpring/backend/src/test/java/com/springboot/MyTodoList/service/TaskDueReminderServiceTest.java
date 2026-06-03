package com.springboot.MyTodoList.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class TaskDueReminderServiceTest {

    @Mock
    private UserTaskRepository userTaskRepository;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private TaskDueReminderService taskDueReminderService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(taskDueReminderService, "enabled", true);
        ReflectionTestUtils.setField(taskDueReminderService, "hoursBeforeDue", 72);
    }

    @Test
    void processDueReminders_sendsOncePerAssigneeTask() {
        LocalDateTime due = LocalDateTime.now().plusHours(24);
        UserTask ut = openAssignment(7L, 42L, "dev@test.com", "Fix API", due);

        when(userTaskRepository.findAssignmentsDueBefore(any(LocalDateTime.class)))
                .thenReturn(List.of(ut));

        int first = taskDueReminderService.processDueReminders();
        int second = taskDueReminderService.processDueReminders();

        assertEquals(1, first);
        assertEquals(0, second);
        verify(emailService)
                .sendTaskDueReminderEmail(
                        eq("dev@test.com"),
                        eq("Dev"),
                        eq("Fix API"),
                        any(String.class),
                        any(),
                        any(),
                        any(String.class));
    }

    @Test
    void processDueReminders_skipsCompletedAssignment() {
        UserTask ut = openAssignment(7L, 42L, "dev@test.com", "Done task", LocalDateTime.now().plusHours(12));
        ut.setStatus("DONE");

        when(userTaskRepository.findAssignmentsDueBefore(any(LocalDateTime.class)))
                .thenReturn(List.of(ut));

        assertEquals(0, taskDueReminderService.processDueReminders());
        verify(emailService, never()).sendTaskDueReminderEmail(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void processDueReminders_sendsForOverdueOpenAssignment() {
        UserTask ut = openAssignment(7L, 42L, "dev@test.com", "Still open", LocalDateTime.now().minusDays(1));

        when(userTaskRepository.findAssignmentsDueBefore(any(LocalDateTime.class)))
                .thenReturn(List.of(ut));

        assertEquals(1, taskDueReminderService.processDueReminders());
        verify(emailService)
                .sendTaskDueReminderEmail(
                        eq("dev@test.com"),
                        eq("Dev"),
                        eq("Still open"),
                        any(String.class),
                        any(),
                        any(),
                        any(String.class));
    }

    @Test
    void processDueReminders_skipsWhenTaskMarkedDoneEvenIfUserTaskOpen() {
        UserTask ut = openAssignment(7L, 42L, "dev@test.com", "Late finish", LocalDateTime.now().minusDays(1));
        ut.getTask().setStatus("DONE");
        ut.setStatus("IN_PROGRESS");

        when(userTaskRepository.findAssignmentsDueBefore(any(LocalDateTime.class)))
                .thenReturn(List.of(ut));

        assertEquals(0, taskDueReminderService.processDueReminders());
        verify(emailService, never()).sendTaskDueReminderEmail(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void isAssignmentClosedForReminders_trueWhenCompletedAfterDueDate() {
        UserTask ut = openAssignment(7L, 42L, "dev@test.com", "Late", LocalDateTime.now().minusDays(2));
        ut.setStatus("COMPLETED");
        assertTrue(TaskDueReminderService.isAssignmentClosedForReminders(ut));
    }

    private static UserTask openAssignment(
            Long userId, Long taskId, String email, String title, LocalDateTime due) {
        User user = new User();
        user.setId(userId);
        user.setName("Dev");
        user.setEmail(email);

        Sprint sprint = new Sprint();
        sprint.setId(1L);

        Task task = new Task();
        task.setId(taskId);
        task.setTitle(title);
        task.setDueDate(due);
        task.setAssignedSprint(sprint);

        UserTask ut = new UserTask(user, task);
        ut.setStatus("IN_PROGRESS");
        return ut;
    }
}
