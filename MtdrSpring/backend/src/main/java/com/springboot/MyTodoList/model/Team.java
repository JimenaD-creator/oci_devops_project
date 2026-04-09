package com.springboot.MyTodoList.model;

import jakarta.persistence.*;

@Entity
@Table(name = "TEAM")
public class Team {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "NAME", nullable = false, length = 100)
    private String name;
    
    @ManyToOne
    @JoinColumn(name = "ASSIGNED_MANAGER", nullable = false)
    private User assignedManager;
    
    public Team() {}
    
    public Team(String name, User assignedManager) {
        this.name = name;
        this.assignedManager = assignedManager;
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
    
    public User getAssignedManager() {
        return assignedManager;
    }
    
    public void setAssignedManager(User assignedManager) {
        this.assignedManager = assignedManager;
    }
}
