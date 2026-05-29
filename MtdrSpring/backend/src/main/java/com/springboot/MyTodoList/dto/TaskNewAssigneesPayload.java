package com.springboot.MyTodoList.dto;

import java.util.ArrayList;
import java.util.List;

/** Body for notifying developers newly assigned on an existing task. */
public class TaskNewAssigneesPayload {

    private List<Long> newAssigneeUserIds;

    public List<Long> getNewAssigneeUserIds() {
        return newAssigneeUserIds;
    }

    public void setNewAssigneeUserIds(List<Long> newAssigneeUserIds) {
        this.newAssigneeUserIds = newAssigneeUserIds;
    }

    /** Normalized positive distinct ids (preserves order). */
    public List<Long> normalizedNewAssigneeUserIds() {
        if (newAssigneeUserIds == null || newAssigneeUserIds.isEmpty()) {
            return List.of();
        }
        List<Long> out = new ArrayList<>();
        for (Long raw : newAssigneeUserIds) {
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
