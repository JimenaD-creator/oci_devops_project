package com.springboot.MyTodoList.dto;

public class UserDetailDTO {
    private Long id;
    private String name;
    private String email;
    private String phonenumber;
    private String role;
    private Long teamId;
    private String teamName;
    private String managedTeamName;
    private String projectName;

    // Constructor actualizado con email y phonenumber
    public UserDetailDTO(Long id, String name, String email, String phonenumber, String role, 
                         Long teamId, String teamName, String managedTeamName, String projectName) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.phonenumber = phonenumber;
        this.role = role;
        this.teamId = teamId;
        this.teamName = teamName;
        this.managedTeamName = managedTeamName;
        this.projectName = projectName;
    }

    // Getters y Setters
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

    public String getEmail() { 
        return email; 
    }
    
    public void setEmail(String email) { 
        this.email = email; 
    }

    public String getPhonenumber() { 
        return phonenumber; 
    }
    
    public void setPhonenumber(String phonenumber) { 
        this.phonenumber = phonenumber; 
    }

    public String getRole() { 
        return role; 
    }
    
    public void setRole(String role) { 
        this.role = role; 
    }

    public Long getTeamId() { 
        return teamId; 
    }
    
    public void setTeamId(Long teamId) { 
        this.teamId = teamId; 
    }

    public String getTeamName() { 
        return teamName; 
    }
    
    public void setTeamName(String teamName) { 
        this.teamName = teamName; 
    }

    public String getManagedTeamName() { 
        return managedTeamName; 
    }
    
    public void setManagedTeamName(String managedTeamName) { 
        this.managedTeamName = managedTeamName; 
    }

    public String getProjectName() { 
        return projectName; 
    }
    
    public void setProjectName(String projectName) { 
        this.projectName = projectName; 
    }
}