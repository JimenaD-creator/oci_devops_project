package com.springboot.MyTodoList.model;

import jakarta.persistence.*;

@Entity
@Table(name = "PROJECT")
public class Project {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "NAME", nullable = false, length = 100)
    private String name;
    
    @ManyToOne
    @JoinColumn(name = "ASSIGNED_TEAM", nullable = false)
    private Team assignedTeam;
    
    public Project() {}
    
    public Project(String name, Team assignedTeam) {
        this.name = name;
        this.assignedTeam = assignedTeam;
    }
    
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
