package com.springboot.MyTodoList.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "USER_SPRINT")
public class UserSprint {
    
    @EmbeddedId
    private UserSprintId id;
    
    @ManyToOne
    @MapsId("userId")
    @JoinColumn(name = "USER_ID")
    private User user;
    
    @ManyToOne
    @MapsId("sprintId")
    @JoinColumn(name = "SPRINT_ID")
    private Sprint sprint;
    
    @Column(name = "CONTRIBUTION_SCORE")
    private BigDecimal contributionScore;
    
    public UserSprint() {}
    
    public UserSprint(User user, Sprint sprint) {
        this.user = user;
        this.sprint = sprint;
        this.id = new UserSprintId(user.getId().intValue(), sprint.getId());
    }
    
    public UserSprintId getId() {
        return id;
    }
    
    public void setId(UserSprintId id) {
        this.id = id;
    }
    
    public User getUser() {
        return user;
    }
    
    public void setUser(User user) {
        this.user = user;
    }
    
    public Sprint getSprint() {
        return sprint;
    }
    
    public void setSprint(Sprint sprint) {
        this.sprint = sprint;
    }
    
    public BigDecimal getContributionScore() {
        return contributionScore;
    }
    
    public void setContributionScore(BigDecimal contributionScore) {
        this.contributionScore = contributionScore;
    }
}
