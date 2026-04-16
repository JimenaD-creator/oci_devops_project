package com.springboot.MyTodoList.dto;

public class UserDetailDTO {
    private Long id;
    private String name;
    private String role;
    private Long teamId;
    private String teamName;
    private String managedTeamName;
    private String projectName;

    public UserDetailDTO(Long id, String name, String role, Long teamId, String teamName, String managedTeamName, String projectName) {
        this.id = id;
        this.name = name;
        this.role = role;
        this.teamId = teamId;
        this.teamName = teamName;
        this.managedTeamName = managedTeamName;
        this.projectName = projectName;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getRole() { return role; }
    public Long getTeamId() { return teamId; }
    public String getTeamName() { return teamName; }
    public String getManagedTeamName() { return managedTeamName; }
    public String getProjectName() { return projectName; }
}