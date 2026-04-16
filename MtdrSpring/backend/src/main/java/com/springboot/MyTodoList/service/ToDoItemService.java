package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.ToDoItem;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.ToDoItemRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class ToDoItemService {

    @Autowired
    private ToDoItemRepository toDoItemRepository;

    @Autowired
    private UserTaskRepository userTaskRepository;

    @Autowired
    private TaskAssignmentSyncService taskAssignmentSyncService;

    public List<ToDoItem> findAll() {
        return toDoItemRepository.findAll();
    }

    public List<ToDoItem> findByAssignedSprint(Integer assignedSprint) {
        return toDoItemRepository.findByAssignedSprint(assignedSprint);
    }

    public ResponseEntity<ToDoItem> getItemById(int id) {
        return toDoItemRepository.findById(id)
                .map(item -> new ResponseEntity<>(item, HttpStatus.OK))
                .orElse(new ResponseEntity<>(HttpStatus.NOT_FOUND));
    }

    public ToDoItem getToDoItemById(int id) {
        return toDoItemRepository.findById(id).orElse(null);
    }

    public ToDoItem addToDoItem(ToDoItem toDoItem) {
        // --- VALIDACIONES PARA EVITAR ORA-01400 (RESTRICCIONES NOT NULL) ---

        // 1. Fecha de Inicio (START_DATE)
        if (toDoItem.getStartDate() == null) {
            toDoItem.setStartDate(OffsetDateTime.now());
        }

        // 2. Fecha de Vencimiento (DUE_DATE) - Por defecto 7 días después
        if (toDoItem.getDueDate() == null) {
            toDoItem.setDueDate(OffsetDateTime.now().plusDays(7));
        }

        // 3. Sprint Asignado (ASSIGNED_SPRINT) - ID por defecto 1
        if (toDoItem.getAssignedSprint() == null) {
            toDoItem.setAssignedSprint(1);
        }

        // 4. Fecha de creación (CREATED_AT)
        if (toDoItem.getCreation_ts() == null) {
            toDoItem.setCreation_ts(OffsetDateTime.now());
        }

        // 5. Estado (STATUS)
        if (toDoItem.getStatus() == null) {
            toDoItem.setStatus("PENDING");
        }

        // 6. Prioridad (PRIORITY)
        if (toDoItem.getPriority() == null) {
            toDoItem.setPriority("NORMAL");
        }

        // 7. Título (TITLE) - Si el Bot no lo manda, usamos parte de la descripción
        if (toDoItem.getTitle() == null) {
            String desc = toDoItem.getDescription() != null ? toDoItem.getDescription() : "Nueva Tarea";
            toDoItem.setTitle(desc.length() > 25 ? desc.substring(0, 25) : desc);
        }

        return toDoItemRepository.save(toDoItem);
    }

    public boolean deleteToDoItem(int id) {
        try {
            if (toDoItemRepository.existsById(id)) {
                toDoItemRepository.deleteById(id);
                return true;
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    public ToDoItem updateToDoItem(int id, ToDoItem td) {
        Optional<ToDoItem> toDoItemData = toDoItemRepository.findById(id);

        if (toDoItemData.isPresent()) {
            ToDoItem toDoItem = toDoItemData.get();
            boolean wasDone = toDoItem.isDone();

            toDoItem.setDescription(td.getDescription());
            toDoItem.setTitle(td.getTitle());
            toDoItem.setPriority(td.getPriority());
            
            // Actualizar Sprint si se proporciona
            if (td.getAssignedSprint() != null) {
                toDoItem.setAssignedSprint(td.getAssignedSprint());
            }
            
            // Lógica de cambio de estado y fecha de finalización
            if (td.isDone() && !toDoItem.isDone()) {
                toDoItem.setCompletedAt(OffsetDateTime.now());
                toDoItem.setStatus("DONE");
            } else if (!td.isDone()) {
                toDoItem.setCompletedAt(null);
                toDoItem.setStatus("PENDING");
            }
            
            if (td.getCreation_ts() != null) {
                toDoItem.setCreation_ts(td.getCreation_ts());
            }

            ToDoItem saved = toDoItemRepository.save(toDoItem);
            syncUserTasksWithTelegramTaskState(id, td.isDone() && !wasDone, !td.isDone() && wasDone);
            return saved;
        }
        return null;
    }

    /**
     * Telegram updates only the TASK row (ToDoItem). Keep USER_TASK assignment status aligned: when the task is
     * completed or reopened from the bot, update assignee rows accordingly. WORKED_HOURS is never set here (that
     * remains for explicit logging via the API/UI).
     */
    private void syncUserTasksWithTelegramTaskState(int taskIdInt, boolean justMarkedDone, boolean justReopened) {
        if (!justMarkedDone && !justReopened) {
            return;
        }
        long taskId = taskIdInt;
        List<UserTask> uts = userTaskRepository.findByTask_Id(taskId);
        if (uts.isEmpty()) {
            return;
        }

        if (justMarkedDone) {
            for (UserTask ut : uts) {
                ut.setStatus("COMPLETED");
                userTaskRepository.save(ut);
            }
        } else if (justReopened) {
            for (UserTask ut : uts) {
                ut.setStatus("TODO");
                userTaskRepository.save(ut);
            }
        }
        taskAssignmentSyncService.syncTaskStatusFromAssignments(taskId);
    }
}