package com.springboot.MyTodoList.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "SPRINT")
public class Sprint {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne
    @JoinColumn(name = "ASSIGNED_PROJECT", nullable = false)
    private Project assignedProject;
    
    @Column(name = "START_DATE")
    private LocalDateTime startDate;
    
    @Column(name = "DUE_DATE")
    private LocalDateTime dueDate;
    
    @Column(name = "COMPLETION_RATE")
    private BigDecimal completionRate;
    
    @Column(name = "ON_TIME_DELIVERY")
    private BigDecimal onTimeDelivery;
    
    @Column(name = "TEAM_PARTICIPATION")
    private BigDecimal teamParticipation;
    
    @Column(name = "WORKLOAD_BALANCE")
    private BigDecimal workloadBalance;

    /** Sprint goal / objective (optional). */
    @Column(name = "GOAL", length = 2000)
    private String goal;
    
    public Sprint() {}
    
    public Sprint(Project assignedProject, LocalDateTime startDate, LocalDateTime dueDate) {
        this.assignedProject = assignedProject;
        this.startDate = startDate;
        this.dueDate = dueDate;
    }
    
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public Project getAssignedProject() {
        return assignedProject;
    }
    
    public void setAssignedProject(Project assignedProject) {
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
    
    public BigDecimal getTeamParticipation() {
        return teamParticipation;
    }
    
    public void setTeamParticipation(BigDecimal teamParticipation) {
        this.teamParticipation = teamParticipation;
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
