package com.springboot.MyTodoList.model;

import jakarta.persistence.*;

@Entity
@Table(name = "TEAM", schema = "MANAGER")
public class Team {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "NAME", nullable = false, length = 100)
    private String name;
    
    @OneToOne
    @JoinColumn(name = "ASSIGNED_MANAGER", referencedColumnName = "ID", unique = true)
    private User manager;

    public Team() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public User getManager() { return manager; }
    public void setManager(User manager) { this.manager = manager; }
}