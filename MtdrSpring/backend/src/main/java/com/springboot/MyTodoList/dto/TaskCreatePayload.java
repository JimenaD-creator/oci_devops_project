package com.springboot.MyTodoList.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.springboot.MyTodoList.model.Task;
import java.util.ArrayList;
import java.util.List;

/**
 * Flat JSON body: task fields + {@code assigneeUserIds} (not part of {@link Task} entity).
 */
public class TaskCreatePayload {

    @JsonUnwrapped
    private Task task;

    private List<Long> assigneeUserIds;

    public Task getTask() {
        return task;
    }

    public void setTask(Task task) {
        this.task = task;
    }

    public List<Long> getAssigneeUserIds() {
        return assigneeUserIds;
    }

    /** Accepts JSON numbers as Integer or Long (Jackson). */
    public void setAssigneeUserIds(List<?> raw) {
        if (raw == null) {
            this.assigneeUserIds = null;
            return;
        }
        List<Long> out = new ArrayList<>();
        for (Object o : raw) {
            if (o instanceof Number) {
                long v = ((Number) o).longValue();
                if (v > 0) {
                    out.add(v);
                }
            }
        }
        this.assigneeUserIds = out;
    }
}
