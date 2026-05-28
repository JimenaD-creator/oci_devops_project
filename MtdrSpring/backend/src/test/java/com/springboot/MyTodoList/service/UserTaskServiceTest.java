package com.springboot.MyTodoList.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.model.UserTaskId;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.ToDoItemRepository;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserTaskServiceTest {

    @Mock
    private UserTaskRepository userTaskRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private ToDoItemRepository toDoItemRepository;

    @Mock
    private TaskAssignmentSyncService taskAssignmentSyncService;

    @InjectMocks
    private UserTaskService userTaskService;

    @Test
    void findSprintIdsWithAssignmentsForUser_nullUserId_returnsEmpty() {
        assertTrue(userTaskService.findSprintIdsWithAssignmentsForUser(null).isEmpty());
    }

    @Test
    void findSprintIdsWithAssignmentsForUser_deduplicatesSprintIds() {
        when(userTaskRepository.findDistinctSprintIdsByUserId(1L)).thenReturn(List.of(3L, 3L, 5L));

        List<Long> sprintIds = userTaskService.findSprintIdsWithAssignmentsForUser(1L);

        assertEquals(List.of(3L, 5L), sprintIds);
    }

    @Test
    void findDistinctAssigneesBySprintId_nullSprintId_returnsEmpty() {
        assertTrue(userTaskService.findDistinctAssigneesBySprintId(null).isEmpty());
    }

    @Test
    void findDistinctAssigneesBySprintId_deduplicatesAndSortsByName() {
        User alice = user(1L, "Alice");
        User bob = user(2L, "Bob");
        UserTask ut1 = new UserTask(alice, task(100L));
        UserTask ut2 = new UserTask(alice, task(101L));
        UserTask ut3 = new UserTask(bob, task(102L));

        when(userTaskRepository.findByTask_AssignedSprint_Id(7L)).thenReturn(List.of(ut3, ut1, ut2));

        List<User> assignees = userTaskService.findDistinctAssigneesBySprintId(7L);

        assertEquals(2, assignees.size());
        assertEquals("Alice", assignees.get(0).getName());
        assertEquals("Bob", assignees.get(1).getName());
    }

    @Test
    void loadUserSprintTaskListIndex_nullIds_returnsEmpty() {
        UserTaskService.UserSprintTaskListIndex index =
                userTaskService.loadUserSprintTaskListIndex(null, 1L);

        assertTrue(index.assignedTaskIds.isEmpty());
        assertTrue(index.myCompletedAssignmentTaskIds.isEmpty());
    }

    @Test
    void loadUserSprintTaskListIndex_collectsAssignedAndCompleted() {
        User user = user(1L, "Dev");
        UserTask done = assignment(user, 10L);
        done.setStatus("DONE");
        UserTask todo = assignment(user, 11L);
        todo.setStatus("TODO");

        when(userTaskRepository.findByUser_IdAndTask_AssignedSprint_Id(1L, 5L))
                .thenReturn(List.of(done, todo));

        UserTaskService.UserSprintTaskListIndex index =
                userTaskService.loadUserSprintTaskListIndex(1L, 5L);

        assertEquals(2, index.assignedTaskIds.size());
        assertTrue(index.myCompletedAssignmentTaskIds.contains(10L));
        assertFalse(index.myCompletedAssignmentTaskIds.contains(11L));
    }

    @Test
    void findTaskIdsForUserInSprint_returnsAssignedIds() {
        User user = user(1L, "Dev");
        UserTask ut = assignment(user, 42L);
        when(userTaskRepository.findByUser_IdAndTask_AssignedSprint_Id(1L, 9L)).thenReturn(List.of(ut));

        assertTrue(userTaskService.findTaskIdsForUserInSprint(1L, 9L).contains(42L));
    }

    @Test
    void findUserTasksForUserInSprint_nullIds_returnsEmpty() {
        assertTrue(userTaskService.findUserTasksForUserInSprint(null, 1L).isEmpty());
    }

    @Test
    void findByUserId_null_returnsEmpty() {
        assertTrue(userTaskService.findByUserId(null).isEmpty());
    }

    @Test
    void findByUserIdAndSprintId_delegatesToRepository() {
        UserTask row = assignment(user(1L, "Dev"), 3L);
        when(userTaskRepository.findByUser_IdAndTask_AssignedSprint_Id(1L, 8L)).thenReturn(List.of(row));

        assertEquals(1, userTaskService.findByUserIdAndSprintId(1L, 8L).size());
    }

    @Test
    void updateAssignmentStatus_invalidArgs_returnsFalse() {
        assertFalse(userTaskService.updateAssignmentStatus(null, 1L, "DONE"));
        assertFalse(userTaskService.updateAssignmentStatus(1L, 1L, "  "));
        verify(userTaskRepository, never()).saveAndFlush(any());
    }

    @Test
    void updateAssignmentStatus_noAssignment_returnsFalse() {
        when(userTaskRepository.findByUser_IdAndTask_Id(1L, 20L)).thenReturn(Optional.empty());

        assertFalse(userTaskService.updateAssignmentStatus(1L, 20L, "done"));
    }

    @Test
    void updateAssignmentStatus_success_syncsTaskAndTodoItem() {
        UserTask ut = assignment(user(1L, "Dev"), 20L);
        when(userTaskRepository.findByUser_IdAndTask_Id(1L, 20L)).thenReturn(Optional.of(ut));
        when(userTaskRepository.saveAndFlush(any(UserTask.class))).thenAnswer(inv -> inv.getArgument(0));

        Task synced = new Task();
        synced.setId(20L);
        synced.setStatus("DONE");
        when(taskAssignmentSyncService.syncTaskStatusFromAssignments(20L)).thenReturn(synced);

        assertTrue(userTaskService.updateAssignmentStatus(1L, 20L, "done"));

        assertEquals("DONE", ut.getStatus());
        verify(toDoItemRepository).updateStatusOnly(20, "DONE");
        verify(taskAssignmentSyncService).syncTaskStatusFromAssignments(20L);
    }

    @Test
    void isUserAssignedToTask_whenNoRows_returnsTrue() {
        when(userTaskRepository.findByTask_Id(99L)).thenReturn(List.of());

        assertTrue(userTaskService.isUserAssignedToTask(1L, 99L));
    }

    @Test
    void isUserAssignedToTask_whenUserIsAssignee_returnsTrue() {
        UserTask ut = assignment(user(2L, "Bob"), 5L);
        when(userTaskRepository.findByTask_Id(5L)).thenReturn(List.of(ut));

        assertTrue(userTaskService.isUserAssignedToTask(2L, 5L));
        assertFalse(userTaskService.isUserAssignedToTask(3L, 5L));
    }

    @Test
    void getAssignmentStatus_returnsStatusWhenPresent() {
        UserTask ut = assignment(user(1L, "Dev"), 7L);
        ut.setStatus("IN_PROGRESS");
        when(userTaskRepository.findById(new UserTaskId(1L, 7L))).thenReturn(Optional.of(ut));

        assertEquals(Optional.of("IN_PROGRESS"), userTaskService.getAssignmentStatus(1L, 7L));
        assertTrue(userTaskService.getAssignmentStatus(null, 7L).isEmpty());
    }

    @Test
    void isMyAssignmentCompleted_whenDone_returnsTrue() {
        UserTask ut = assignment(user(1L, "Dev"), 12L);
        ut.setStatus("COMPLETED");
        when(userTaskRepository.findById(new UserTaskId(1L, 12L))).thenReturn(Optional.of(ut));

        assertTrue(userTaskService.isMyAssignmentCompleted(1L, 12L));
    }

    @Test
    void isMyAssignmentCompleted_whenTodo_returnsFalse() {
        UserTask ut = assignment(user(1L, "Dev"), 12L);
        ut.setStatus("TODO");
        when(userTaskRepository.findById(new UserTaskId(1L, 12L))).thenReturn(Optional.of(ut));

        assertFalse(userTaskService.isMyAssignmentCompleted(1L, 12L));
    }

    @Test
    void reopenMyAssignment_resetsStatusAndClearsBlock() {
        UserTask mine = assignment(user(4L, "Dev"), 30L);
        mine.setStatus("DONE");
        mine.setIsBlocked(true);
        mine.setBlockedReason("waiting");
        when(userTaskRepository.findByTask_Id(30L)).thenReturn(List.of(mine));
        when(userTaskRepository.save(any(UserTask.class))).thenAnswer(inv -> inv.getArgument(0));

        assertTrue(userTaskService.reopenMyAssignment(4L, 30L));

        assertEquals("TODO", mine.getStatus());
        assertEquals(false, mine.getIsBlocked());
        assertEquals(null, mine.getBlockedReason());
        verify(taskAssignmentSyncService).syncTaskStatusFromAssignments(30L);
    }

    @Test
    void reopenMyAssignment_whenNotAssignee_returnsFalse() {
        UserTask other = assignment(user(9L, "Other"), 31L);
        when(userTaskRepository.findByTask_Id(31L)).thenReturn(List.of(other));

        assertFalse(userTaskService.reopenMyAssignment(4L, 31L));
        verify(userTaskRepository, never()).save(any());
    }

    @Test
    void saveWorkedHours_addsToExistingTotal() {
        UserTask existing = assignment(user(2L, "Dev"), 50L);
        existing.setWorkedHours(3L);
        when(userTaskRepository.findByTask_Id(50L)).thenReturn(List.of(existing));
        when(userTaskRepository.findById(new UserTaskId(2L, 50L))).thenReturn(Optional.of(existing));
        when(userTaskRepository.save(any(UserTask.class))).thenAnswer(inv -> inv.getArgument(0));

        UserTask saved = userTaskService.saveWorkedHours(2L, 50L, 2);

        assertEquals(5L, saved.getWorkedHours());
        assertEquals("COMPLETED", saved.getStatus());
        assertEquals(false, saved.getIsBlocked());
        verify(taskAssignmentSyncService).syncTaskStatusFromAssignments(50L);
    }

    @Test
    void saveWorkedHours_createsRowWhenMissing() {
        User user = user(3L, "New");
        Task task = task(60L);
        when(userTaskRepository.findByTask_Id(60L)).thenReturn(List.of());
        when(userTaskRepository.findById(new UserTaskId(3L, 60L))).thenReturn(Optional.empty());
        when(userRepository.findById(3L)).thenReturn(Optional.of(user));
        when(taskRepository.findById(60L)).thenReturn(Optional.of(task));
        when(userTaskRepository.save(any(UserTask.class))).thenAnswer(inv -> inv.getArgument(0));

        UserTask saved = userTaskService.saveWorkedHours(3L, 60L, 4);

        assertEquals(4L, saved.getWorkedHours());
        verify(userRepository).findById(3L);
        verify(taskRepository).findById(60L);
    }

    @Test
    void saveWorkedHours_unknownUser_throws() {
        when(userTaskRepository.findByTask_Id(61L)).thenReturn(List.of());
        when(userTaskRepository.findById(new UserTaskId(99L, 61L))).thenReturn(Optional.empty());
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> userTaskService.saveWorkedHours(99L, 61L, 1));
    }

    @Test
    void getWorkedHours_whenPresent_returnsValue() {
        UserTask ut = assignment(user(1L, "Dev"), 70L);
        ut.setWorkedHours(8L);
        when(userTaskRepository.findById(new UserTaskId(1L, 70L))).thenReturn(Optional.of(ut));

        assertEquals(8, userTaskService.getWorkedHours(1L, 70L));
    }

    @Test
    void getWorkedHours_whenMissing_returnsZero() {
        when(userTaskRepository.findById(new UserTaskId(1L, 71L))).thenReturn(Optional.empty());

        assertEquals(0, userTaskService.getWorkedHours(1L, 71L));
    }

    @Test
    void saveBlockedReason_updatesExistingAssignment() {
        UserTask existing = assignment(user(5L, "Dev"), 80L);
        when(userTaskRepository.findByTask_Id(80L)).thenReturn(List.of(existing));
        when(userTaskRepository.findById(new UserTaskId(5L, 80L))).thenReturn(Optional.of(existing));
        when(userTaskRepository.save(any(UserTask.class))).thenAnswer(inv -> inv.getArgument(0));

        UserTask saved = userTaskService.saveBlockedReason(5L, 80L, "API down");

        assertEquals("BLOCKED", saved.getStatus());
        assertEquals(true, saved.getIsBlocked());
        assertEquals("API down", saved.getBlockedReason());
        verify(taskAssignmentSyncService).syncTaskStatusFromAssignments(80L);
    }

    @Test
    void saveBlockedReason_multiAssignee_usesTelegramHintUser() {
        User hint = user(6L, "Hint");
        User other = user(7L, "Other");
        UserTask hintRow = assignment(hint, 81L);
        UserTask otherRow = assignment(other, 81L);
        when(userTaskRepository.findByTask_Id(81L)).thenReturn(List.of(hintRow, otherRow));
        when(userTaskRepository.findById(new UserTaskId(6L, 81L))).thenReturn(Optional.of(hintRow));
        when(userTaskRepository.save(any(UserTask.class))).thenAnswer(inv -> inv.getArgument(0));

        userTaskService.saveBlockedReason(6L, 81L, "blocked");

        ArgumentCaptor<UserTask> captor = ArgumentCaptor.forClass(UserTask.class);
        verify(userTaskRepository).save(captor.capture());
        assertEquals(6L, captor.getValue().getId().getUserId());
    }

    @Test
    void resolveBlockedReport_clearsFlag_keepsReason_andMovesToInProgress() {
        UserTask existing = assignment(user(5L, "Dev"), 82L);
        existing.setIsBlocked(true);
        existing.setBlockedReason("Waiting on credentials");
        existing.setStatus("BLOCKED");
        when(userTaskRepository.findById(new UserTaskId(5L, 82L))).thenReturn(Optional.of(existing));
        when(userTaskRepository.save(any(UserTask.class))).thenAnswer(inv -> inv.getArgument(0));

        UserTask saved = userTaskService.resolveBlockedReport(5L, 82L);

        assertEquals(false, saved.getIsBlocked());
        assertEquals("Waiting on credentials", saved.getBlockedReason());
        assertEquals("IN_PROGRESS", saved.getStatus());
        verify(taskAssignmentSyncService).syncTaskStatusFromAssignments(82L);
    }

    @Test
    void resolveBlockedReport_whenAlreadyUnblocked_isIdempotent() {
        UserTask existing = assignment(user(5L, "Dev"), 83L);
        existing.setIsBlocked(false);
        existing.setBlockedReason("Old reason");
        existing.setStatus("IN_PROGRESS");
        when(userTaskRepository.findById(new UserTaskId(5L, 83L))).thenReturn(Optional.of(existing));

        UserTask saved = userTaskService.resolveBlockedReport(5L, 83L);

        assertEquals(existing, saved);
        verify(userTaskRepository, never()).save(any(UserTask.class));
        verify(taskAssignmentSyncService, never()).syncTaskStatusFromAssignments(any());
    }

    private static User user(long id, String name) {
        User user = new User();
        user.setId(id);
        user.setName(name);
        return user;
    }

    private static Task task(long id) {
        Task task = new Task();
        task.setId(id);
        return task;
    }

    private static UserTask assignment(User user, long taskId) {
        return new UserTask(user, task(taskId));
    }
}
