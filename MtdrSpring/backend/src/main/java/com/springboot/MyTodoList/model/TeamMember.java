package com.springboot.MyTodoList.model;

import jakarta.persistence.*;

@Entity
@Table(name = "team_members")
public class TeamMember {
    
    @EmbeddedId
    private TeamMembersId id;
    
    @ManyToOne
    @MapsId("userId")
    @JoinColumn(name = "user_id")
    private User user;
    
    @ManyToOne
    @MapsId("teamId")
    @JoinColumn(name = "team_id")
    private Team team;
    
    private String role;
    
    public TeamMembersId getId() {
        return id;
    }
    
    public void setId(TeamMembersId id) {
        this.id = id;
    }
    
    public User getUser() {
        return user;
    }
    
    public void setUser(User user) {
        this.user = user;
    }
    
    public Team getTeam() {
        return team;
    }
    
    public void setTeam(Team team) {
        this.team = team;
    }
    
    public String getRole() {
        return role;
    }
    
    public void setRole(String role) {
        this.role = role;
    }
}