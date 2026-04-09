package com.springboot.MyTodoList.model;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class TeamMembersId implements Serializable {
    
    private Long teamId;
    private Integer userId;
    
    public TeamMembersId() {}
    
    public TeamMembersId(Long teamId, Integer userId) {
        this.teamId = teamId;
        this.userId = userId;
    }
    
    public Long getTeamId() {
        return teamId;
    }
    
    public void setTeamId(Long teamId) {
        this.teamId = teamId;
    }
    
    public Integer getUserId() {
        return userId;
    }
    
    public void setUserId(Integer userId) {
        this.userId = userId;
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        TeamMembersId that = (TeamMembersId) o;
        return Objects.equals(teamId, that.teamId) &&
               Objects.equals(userId, that.userId);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(teamId, userId);
    }
}
