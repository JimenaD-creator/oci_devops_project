package com.springboot.MyTodoList.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.Team;
import com.springboot.MyTodoList.model.TeamMember;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.repository.ProjectRepository;
import com.springboot.MyTodoList.repository.TeamMemberRepository;
import com.springboot.MyTodoList.repository.TeamRepository;
import com.springboot.MyTodoList.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock
    private ProjectRepository projectRepo;

    @Mock
    private TeamRepository teamRepo;

    @Mock
    private TeamMemberRepository teamMemberRepo;

    @Mock
    private UserRepository userRepo;

    @InjectMocks
    private AdminService adminService;

    @Test
    void createProject_success() {
        Team team = new Team();
        team.setId(1L);
        Project input = new Project();
        input.setAssignedTeam(new Team());
        input.getAssignedTeam().setId(1L);

        when(teamRepo.findById(1L)).thenReturn(Optional.of(team));
        when(projectRepo.existsByAssignedTeamId(1L)).thenReturn(false);
        when(projectRepo.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));

        Project saved = adminService.createProject(input);

        assertEquals(team, saved.getAssignedTeam());
    }

    @Test
    void createProject_teamAlreadyHasProject_throws() {
        Project input = new Project();
        input.setAssignedTeam(new Team());
        input.getAssignedTeam().setId(2L);

        when(teamRepo.findById(2L)).thenReturn(Optional.of(new Team()));
        when(projectRepo.existsByAssignedTeamId(2L)).thenReturn(true);

        assertThrows(RuntimeException.class, () -> adminService.createProject(input));
    }

    @Test
    void createProject_teamNotFound_throws() {
        Project input = new Project();
        input.setAssignedTeam(new Team());
        input.getAssignedTeam().setId(99L);

        when(teamRepo.findById(99L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> adminService.createProject(input));
    }

    @Test
    void createTeam_success() {
        User manager = new User();
        manager.setId(5L);
        manager.setName("Mgr");

        Team input = new Team();
        input.setName("Team A");
        input.setManager(new User());
        input.getManager().setId(5L);

        when(userRepo.findById(5L)).thenReturn(Optional.of(manager));
        when(teamRepo.existsByManagerId(5L)).thenReturn(false);
        when(teamRepo.save(any(Team.class))).thenAnswer(inv -> inv.getArgument(0));

        Team saved = adminService.createTeam(input);

        assertEquals(manager, saved.getManager());
        assertEquals("Team A", saved.getName());
    }

    @Test
    void createTeam_managerNotFound_throws() {
        Team input = new Team();
        input.setManager(new User());
        input.getManager().setId(404L);

        when(userRepo.findById(404L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> adminService.createTeam(input));
    }

    @Test
    void createTeam_managerAlreadyHasTeam_throws() {
        User manager = new User();
        manager.setId(6L);
        Team input = new Team();
        input.setManager(new User());
        input.getManager().setId(6L);

        when(userRepo.findById(6L)).thenReturn(Optional.of(manager));
        when(teamRepo.existsByManagerId(6L)).thenReturn(true);

        assertThrows(RuntimeException.class, () -> adminService.createTeam(input));
    }

    @Test
    void addMemberToTeam_normalizesRole() {
        User user = new User();
        user.setId(3L);
        Team team = new Team();
        team.setId(4L);

        when(userRepo.findById(3L)).thenReturn(Optional.of(user));
        when(teamRepo.findById(4L)).thenReturn(Optional.of(team));
        when(teamMemberRepo.save(any(TeamMember.class))).thenAnswer(inv -> inv.getArgument(0));

        TeamMember member = adminService.addMemberToTeam(3L, 4L, "developer");

        assertEquals("DEVELOPER", member.getRole());
    }

    @Test
    void addMemberToTeam_userNotFound_throws() {
        when(userRepo.findById(8L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> adminService.addMemberToTeam(8L, 4L, "developer"));
    }

    @Test
    void addMemberToTeam_teamNotFound_throws() {
        User user = new User();
        user.setId(9L);
        when(userRepo.findById(9L)).thenReturn(Optional.of(user));
        when(teamRepo.findById(404L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> adminService.addMemberToTeam(9L, 404L, "manager"));
    }
}
