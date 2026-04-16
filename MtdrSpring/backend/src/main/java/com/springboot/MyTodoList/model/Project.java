package com.springboot.MyTodoList.model;

import jakarta.persistence.*;

@Entity
@Table(name = "project")
public class Project {
    
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "project_seq")
    @SequenceGenerator(name = "project_seq", sequenceName = "PROJECT_SEQ", allocationSize = 1)
    private Long id;
    
    private String name;
    
    @ManyToOne
    @JoinColumn(name = "assigned_team")
    private Team assignedTeam;
    
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public Team getAssignedTeam() {
        return assignedTeam;
    }
    
    public void setAssignedTeam(Team assignedTeam) {
        this.assignedTeam = assignedTeam;
    }
}