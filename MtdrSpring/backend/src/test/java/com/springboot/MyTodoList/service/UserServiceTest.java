package com.springboot.MyTodoList.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.springboot.MyTodoList.model.User;
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
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @Mock
    private TeamRepository teamRepository;

    @InjectMocks
    private UserService userService;

    @Test
    void authenticateByIdentifierAndPassword_successWithEmail() {
        User user = sampleUser(1L, "alice@test.com", "555", "secret", "DEVELOPER");
        when(userRepository.findByEmailIgnoreCase("alice@test.com")).thenReturn(Optional.of(user));

        Optional<User> result = userService.authenticateByIdentifierAndPassword("alice@test.com", "secret");

        assertTrue(result.isPresent());
        assertEquals(1L, result.get().getId());
    }

    @Test
    void authenticateByIdentifierAndPassword_wrongPassword_returnsEmpty() {
        User user = sampleUser(2L, "bob@test.com", null, "secret", "MANAGER");
        when(userRepository.findByEmailIgnoreCase("bob@test.com")).thenReturn(Optional.of(user));

        assertTrue(userService.authenticateByIdentifierAndPassword("bob@test.com", "wrong").isEmpty());
    }

    @Test
    void authenticateByIdentifierAndPassword_blankIdentifier_returnsEmpty() {
        assertTrue(userService.authenticateByIdentifierAndPassword("  ", "secret").isEmpty());
        verify(userRepository, never()).findByEmailIgnoreCase(any());
    }

    @Test
    void authenticateByIdentifierAndPassword_fallsBackToPhone() {
        User user = sampleUser(3L, null, "5551234", "pw", "DEVELOPER");
        when(userRepository.findByEmailIgnoreCase("5551234")).thenReturn(Optional.empty());
        when(userRepository.findByPhonenumber("5551234")).thenReturn(Optional.of(user));

        assertTrue(userService.authenticateByIdentifierAndPassword("5551234", "pw").isPresent());
    }

    @Test
    void verifyUserCredentials_matchesEmailAndPassword() {
        User user = sampleUser(4L, "dev@test.com", "111", "pass", "DEVELOPER");
        when(userRepository.findById(4L)).thenReturn(Optional.of(user));

        assertTrue(userService.verifyUserCredentials(4L, "dev@test.com", "pass"));
        assertFalse(userService.verifyUserCredentials(4L, "dev@test.com", "bad"));
        assertFalse(userService.verifyUserCredentials(4L, "other@test.com", "pass"));
    }

    @Test
    void verifyCredentialsByPhoneOrEmailAndPassword_returnsUserId() {
        User user = sampleUser(5L, "x@test.com", null, "ok", "MANAGER");
        when(userRepository.findByEmailIgnoreCase("x@test.com")).thenReturn(Optional.of(user));

        Optional<Long> id = userService.verifyCredentialsByPhoneOrEmailAndPassword("x@test.com", "ok");

        assertTrue(id.isPresent());
        assertEquals(5L, id.get());
    }

    @Test
    void saveUser_normalizesAllowedRole() {
        User toSave = new User();
        toSave.setName("New Dev");
        toSave.setType("developer");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User saved = userService.saveUser(toSave);

        assertEquals("DEVELOPER", saved.getType());
        verify(userRepository).save(toSave);
    }

    @Test
    void saveUser_invalidRole_throws() {
        User toSave = new User();
        toSave.setType("ADMIN");

        assertThrows(RuntimeException.class, () -> userService.saveUser(toSave));
    }

    @Test
    void getUserById_delegatesToRepository() {
        User user = sampleUser(6L, "a@b.com", null, "p", "DEVELOPER");
        when(userRepository.findById(6L)).thenReturn(Optional.of(user));

        assertTrue(userService.getUserById(6L).isPresent());
        assertEquals("a@b.com", userService.getUserById(6L).get().getEmail());
    }

    @Test
    void deleteUser_clearsMembershipsAndDeletesUser() {
        when(teamRepository.findByManagerId(7L)).thenReturn(Optional.empty());

        userService.deleteUser(7L);

        verify(teamMemberRepository).deleteByUserId(7L);
        verify(userRepository).deleteById(7L);
    }

    @Test
    void updateUser_whenFound_appliesFields() {
        User existing = sampleUser(8L, "old@test.com", "99", "oldpw", "DEVELOPER");
        when(userRepository.findById(8L)).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User patch = new User();
        patch.setName("Updated");
        patch.setEmail("new@test.com");
        patch.setPhoneNumber("00");
        patch.setUserPassword("newpw");
        patch.setType("manager");

        User updated = userService.updateUser(8L, patch);

        assertEquals("Updated", updated.getName());
        assertEquals("new@test.com", updated.getEmail());
        assertEquals("MANAGER", updated.getType());
    }

    @Test
    void updateUser_whenMissing_throws() {
        when(userRepository.findById(404L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> userService.updateUser(404L, new User()));
    }

    private static User sampleUser(Long id, String email, String phone, String password, String type) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setPhoneNumber(phone);
        user.setUserPassword(password);
        user.setType(type);
        user.setName("User " + id);
        return user;
    }
}
