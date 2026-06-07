package com.springboot.MyTodoList.dto;

import java.util.ArrayList;
import java.util.List;

/** Body for deleting multiple tasks in one request. */
public class TaskBulkDeletePayload {

    private List<Long> taskIds;

    public List<Long> getTaskIds() {
        return taskIds;
    }

    public void setTaskIds(List<Long> taskIds) {
        this.taskIds = taskIds;
    }

    /** Normalized positive distinct ids (preserves order). */
    public List<Long> normalizedTaskIds() {
        if (taskIds == null || taskIds.isEmpty()) {
            return List.of();
        }
        List<Long> out = new ArrayList<>();
        for (Long raw : taskIds) {
            if (raw == null || raw <= 0) {
                continue;
            }
            if (!out.contains(raw)) {
                out.add(raw);
            }
        }
        return out;
    }
}
