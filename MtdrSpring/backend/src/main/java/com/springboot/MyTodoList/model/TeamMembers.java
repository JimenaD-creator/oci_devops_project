package com.springboot.MyTodoList.model;

import jakarta.persistence.*;

@Entity
@Table(name = "TEAM_MEMBERS")
public class TeamMembers {
    
    @EmbeddedId
    private TeamMembersId id;
    
    @ManyToOne
    @MapsId("teamId")
    @JoinColumn(name = "TEAM_ID")
    private Team team;
    
    @ManyToOne
    @MapsId("userId")
    @JoinColumn(name = "USER_ID")
    private User user;
    
    @Column(name = "ROLE", length = 50)
    private String role;
    
    public TeamMembers() {}
    
    public TeamMembers(Team team, User user, String role) {
        this.team = team;
        this.user = user;
        this.role = role;
        this.id = new TeamMembersId(team.getId(), user.getID());
    }
    
    public TeamMembersId getId() {
        return id;
    }
    
    public void setId(TeamMembersId id) {
        this.id = id;
    }
    
    public Team getTeam() {
        return team;
    }
    
    public void setTeam(Team team) {
        this.team = team;
    }
    
    public User getUser() {
        return user;
    }
    
    public void setUser(User user) {
        this.user = user;
    }
    
    public String getRole() {
        return role;
    }
    
    public void setRole(String role) {
        this.role = role;
    }
}
