package com.springboot.MyTodoList.dto;

import com.springboot.MyTodoList.model.Sprint;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public class DashboardSprintDto {
    private Long id;
    private IdRefDto assignedProject;
    private LocalDateTime startDate;
    private LocalDateTime dueDate;
    private BigDecimal completionRate;
    private BigDecimal onTimeDelivery;
    private BigDecimal efficiencyScore;
    private BigDecimal workloadBalance;
    private String goal;

    public static DashboardSprintDto from(Sprint sprint, Long projectId) {
        DashboardSprintDto dto = new DashboardSprintDto();
        dto.id = sprint.getId();
        Long pid = projectId;
        if (pid == null && sprint.getAssignedProject() != null) {
            pid = sprint.getAssignedProject().getId();
        }
        if (pid != null) {
            dto.assignedProject = new IdRefDto(pid);
        }
        dto.startDate = sprint.getStartDate();
        dto.dueDate = sprint.getDueDate();
        dto.completionRate = sprint.getCompletionRate();
        dto.onTimeDelivery = sprint.getOnTimeDelivery();
        dto.efficiencyScore = sprint.getEfficiencyScore();
        dto.workloadBalance = sprint.getWorkloadBalance();
        dto.goal = sprint.getGoal();
        return dto;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public IdRefDto getAssignedProject() {
        return assignedProject;
    }

    public void setAssignedProject(IdRefDto assignedProject) {
        this.assignedProject = assignedProject;
    }

    public LocalDateTime getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDateTime startDate) {
        this.startDate = startDate;
    }

    public LocalDateTime getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDateTime dueDate) {
        this.dueDate = dueDate;
    }

    public BigDecimal getCompletionRate() {
        return completionRate;
    }

    public void setCompletionRate(BigDecimal completionRate) {
        this.completionRate = completionRate;
    }

    public BigDecimal getOnTimeDelivery() {
        return onTimeDelivery;
    }

    public void setOnTimeDelivery(BigDecimal onTimeDelivery) {
        this.onTimeDelivery = onTimeDelivery;
    }

    public BigDecimal getEfficiencyScore() {
        return efficiencyScore;
    }

    public void setEfficiencyScore(BigDecimal efficiencyScore) {
        this.efficiencyScore = efficiencyScore;
    }

    public BigDecimal getWorkloadBalance() {
        return workloadBalance;
    }

    public void setWorkloadBalance(BigDecimal workloadBalance) {
        this.workloadBalance = workloadBalance;
    }

    public String getGoal() {
        return goal;
    }

    public void setGoal(String goal) {
        this.goal = goal;
    }
}
