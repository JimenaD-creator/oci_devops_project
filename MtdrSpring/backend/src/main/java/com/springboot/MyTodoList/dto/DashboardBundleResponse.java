package com.springboot.MyTodoList.dto;

import java.util.List;

public class DashboardBundleResponse {
    private Long projectId;
    private List<DashboardSprintDto> sprints;
    private List<DashboardTaskDto> tasks;
    private List<DashboardUserTaskDto> userTasks;
    private List<TeamRosterDto> developers;

    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public List<DashboardSprintDto> getSprints() {
        return sprints;
    }

    public void setSprints(List<DashboardSprintDto> sprints) {
        this.sprints = sprints;
    }

    public List<DashboardTaskDto> getTasks() {
        return tasks;
    }

    public void setTasks(List<DashboardTaskDto> tasks) {
        this.tasks = tasks;
    }

    public List<DashboardUserTaskDto> getUserTasks() {
        return userTasks;
    }

    public void setUserTasks(List<DashboardUserTaskDto> userTasks) {
        this.userTasks = userTasks;
    }

    public List<TeamRosterDto> getDevelopers() {
        return developers;
    }

    public void setDevelopers(List<TeamRosterDto> developers) {
        this.developers = developers;
    }
}
