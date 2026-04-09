package com.springboot.MyTodoList.model;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class UserSprintId implements Serializable {
    
    private Integer userId;
    private Long sprintId;
    
    public UserSprintId() {}
    
    public UserSprintId(Integer userId, Long sprintId) {
        this.userId = userId;
        this.sprintId = sprintId;
    }
    
    public Integer getUserId() {
        return userId;
    }
    
    public void setUserId(Integer userId) {
        this.userId = userId;
    }
    
    public Long getSprintId() {
        return sprintId;
    }
    
    public void setSprintId(Long sprintId) {
        this.sprintId = sprintId;
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        UserSprintId that = (UserSprintId) o;
        return Objects.equals(userId, that.userId) &&
               Objects.equals(sprintId, that.sprintId);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(userId, sprintId);
    }
}
