package com.springboot.MyTodoList.dto;

import com.springboot.MyTodoList.model.User;

/** Lightweight team member for dashboards (profile picture at most once per person). */
public class TeamRosterDto {
    private Long id;
    private String name;
    private String email;
    private String phoneNumber;
    private String type;
    private String profilePicture;

    public TeamRosterDto() {}

    public static TeamRosterDto fromUser(User user) {
        return fromUser(user, true);
    }

    /** {@code includeProfilePicture=false} keeps dashboard bundle JSON small (no base64 CLOBs). */
    public static TeamRosterDto fromUser(User user, boolean includeProfilePicture) {
        if (user == null) {
            return null;
        }
        TeamRosterDto dto = new TeamRosterDto();
        dto.id = user.getId();
        dto.name = user.getName();
        dto.email = user.getEmail();
        dto.phoneNumber = user.getPhoneNumber();
        dto.type = user.getType();
        if (includeProfilePicture) {
            dto.profilePicture = user.getProfilePicture();
        }
        return dto;
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

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getProfilePicture() {
        return profilePicture;
    }

    public void setProfilePicture(String profilePicture) {
        this.profilePicture = profilePicture;
    }
}
