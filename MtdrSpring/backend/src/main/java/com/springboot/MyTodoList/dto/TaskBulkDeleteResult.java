package com.springboot.MyTodoList.dto;

/** Response for bulk task deletion. */
public class TaskBulkDeleteResult {

    private int deletedCount;
    private int requestedCount;

    public TaskBulkDeleteResult() {}

    public TaskBulkDeleteResult(int deletedCount, int requestedCount) {
        this.deletedCount = deletedCount;
        this.requestedCount = requestedCount;
    }

    public int getDeletedCount() {
        return deletedCount;
    }

    public void setDeletedCount(int deletedCount) {
        this.deletedCount = deletedCount;
    }

    public int getRequestedCount() {
        return requestedCount;
    }

    public void setRequestedCount(int requestedCount) {
        this.requestedCount = requestedCount;
    }
}
