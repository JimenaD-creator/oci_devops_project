package com.springboot.MyTodoList.model;

import jakarta.persistence.*;

@Entity
@Table(name = "USER_TASK")
public class UserTask {
    
    @EmbeddedId
    private UserTaskId id;
    
    @ManyToOne
    @MapsId("userId")
    @JoinColumn(name = "USER_ID")
    private User user;
    
    @ManyToOne
    @MapsId("taskId")
    @JoinColumn(name = "TASK_ID")
    private Task task;
    
    @Column(name = "WORKED_HOURS")
    private Long workedHours;
    
    @Column(name = "STATUS", length = 50)
    private String status;
    
    public UserTask() {}
    
    public UserTask(User user, Task task) {
        this.user = user;
        this.task = task;
        this.id = new UserTaskId(user.getID(), task.getId());
    }
    
    public UserTaskId getId() {
        return id;
    }
    
    public void setId(UserTaskId id) {
        this.id = id;
    }
    
    public User getUser() {
        return user;
    }
    
    public void setUser(User user) {
        this.user = user;
    }
    
    public Task getTask() {
        return task;
    }
    
    public void setTask(Task task) {
        this.task = task;
    }
    
    public Long getWorkedHours() {
        return workedHours;
    }
    
    public void setWorkedHours(Long workedHours) {
        this.workedHours = workedHours;
    }
    
    public String getStatus() {
        return status;
    }
    
    public void setStatus(String status) {
        this.status = status;
    }
}
