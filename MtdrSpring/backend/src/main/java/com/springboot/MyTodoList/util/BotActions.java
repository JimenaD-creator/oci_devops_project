package com.springboot.MyTodoList.util;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.ReplyKeyboardMarkup;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.buttons.KeyboardRow;
import org.telegram.telegrambots.meta.generics.TelegramClient;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.TeamMember;
import com.springboot.MyTodoList.model.ToDoItem;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.TeamMembersRepository;
import com.springboot.MyTodoList.repository.TeamRepository;
import com.springboot.MyTodoList.service.DeepSeekService;
import com.springboot.MyTodoList.service.GeminiService;
import com.springboot.MyTodoList.service.PendingTelegramAssignmentNoticeService;
import com.springboot.MyTodoList.service.PendingTelegramAssignmentNoticeService.PendingAssignmentNotice;
import com.springboot.MyTodoList.service.ProjectLookupService;
import com.springboot.MyTodoList.service.SprintService;
import com.springboot.MyTodoList.service.TelegramUserMappingService;
import com.springboot.MyTodoList.service.ToDoItemService;
import com.springboot.MyTodoList.service.UserService;
import com.springboot.MyTodoList.service.UserTaskService;

public class BotActions {

    private static final Logger logger = LoggerFactory.getLogger(BotActions.class);
    private static final int TELEGRAM_BUTTON_MAX = 62;
    /** Task title column (left, ~50% width with status on the right). */
    private static final int TELEGRAM_TASK_BUTTON_MAX = 52;
    /** Status column (right, narrow). */
    private static final int TELEGRAM_STATUS_BUTTON_MAX = 24;
    private static final Pattern USER_PICKER_ID = Pattern.compile("^👤 .+ #(\\d+)$");

    private String requestText;
    private long chatId;
    private TelegramClient telegramClient;
    private boolean exit;

    ToDoItemService todoService;
    DeepSeekService deepSeekService;
    SprintService sprintService;
    BotStateManager stateManager;
    TelegramUserMappingService telegramUserMappingService;
    UserTaskService userTaskService;
    UserService userService;
    GeminiService geminiService;
    ProjectLookupService projectLookupService;
    TeamRepository teamRepository;
    TeamMembersRepository teamMembersRepository;
    PendingTelegramAssignmentNoticeService pendingTelegramAssignmentNoticeService;

    public BotActions(TelegramClient tc, ToDoItemService ts, DeepSeekService ds,
                      BotStateManager sm, TelegramUserMappingService tums, UserTaskService uts, SprintService ss) {
        telegramClient = tc;
        todoService = ts;
        deepSeekService = ds;
        stateManager = sm;
        telegramUserMappingService = tums;
        userTaskService = uts;
        sprintService = ss;
        exit = false;
    }

    public BotActions(TelegramClient tc, ToDoItemService ts, DeepSeekService ds,
                      BotStateManager sm, TelegramUserMappingService tums, UserTaskService uts, SprintService ss, UserService us) {
        telegramClient = tc;
        todoService = ts;
        deepSeekService = ds;
        stateManager = sm;
        telegramUserMappingService = tums;
        userTaskService = uts;
        sprintService = ss;
        userService = us;
        exit = false;
    }

    public BotActions(TelegramClient tc, ToDoItemService ts, DeepSeekService ds,
                      BotStateManager sm, TelegramUserMappingService tums, UserTaskService uts, SprintService ss, UserService us, GeminiService gs) {
        telegramClient = tc;
        todoService = ts;
        deepSeekService = ds;
        stateManager = sm;
        telegramUserMappingService = tums;
        userTaskService = uts;
        sprintService = ss;
        userService = us;
        geminiService = gs;
        exit = false;
    }

    // --- Setters y Getters ---
    public void setRequestText(String cmd) { this.requestText = cmd; }
    public void setChatId(long chId) { this.chatId = chId; }
    public void setTelegramClient(TelegramClient tc) { this.telegramClient = tc; }
    public void setTodoService(ToDoItemService tsvc) { this.todoService = tsvc; }
    public void setDeepSeekService(DeepSeekService dssvc) { this.deepSeekService = dssvc; }
    public void setProjectLookupService(ProjectLookupService pls) { this.projectLookupService = pls; }
    public void setTeamRepository(TeamRepository tr) { this.teamRepository = tr; }
    public void setTeamMembersRepository(TeamMembersRepository tmr) { this.teamMembersRepository = tmr; }

    public void setPendingTelegramAssignmentNoticeService(PendingTelegramAssignmentNoticeService service) {
        this.pendingTelegramAssignmentNoticeService = service;
    }

    public ToDoItemService getTodoService() { return todoService; }
    public DeepSeekService getDeepSeekService() { return deepSeekService; }

    public boolean wasHandled() {
        return exit;
    }

    private static boolean isStartCommand(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        return BotCommands.START_COMMAND.getCommand().equals(text)
                || BotLabels.SHOW_MAIN_SCREEN.getLabel().equals(text);
    }

    /**
     * DB user id for the developer acting in this chat (viewing tasks or picking a status).
     * Must match USER_TASK.USER_ID — never default to user #1.
     */
    private Long resolveEffectiveActingUserId() {
        // VIEWING_SPRINT_TASKS and SELECTING_TASK_STATUS both store the assignee being browsed
        Long selected = stateManager.getViewingSelectedUserId(chatId);
        if (selected != null) {
            return selected;
        }
        Long signedIn = stateManager.getTelegramSignedInUserId(chatId);
        if (signedIn != null) {
            return signedIn;
        }
        if (telegramUserMappingService.isUserRegistered(chatId)) {
            return Long.valueOf(telegramUserMappingService.getUserIdByChatId(chatId));
        }
        return null;
    }

    private static final String DEVELOPER_CANNOT_ADD_TASK_MSG =
            "➕ Only managers can create tasks.\n\nAsk your manager to assign a new task in the web app.";

    private void sendDeveloperCannotAddTaskMessage() {
        BotHelper.sendMessageToTelegram(chatId, DEVELOPER_CANNOT_ADD_TASK_MSG, telegramClient, buildMainMenuKeyboardMarkup());
        exit = true;
    }

    private ReplyKeyboardMarkup buildMainMenuKeyboardMarkup() {
        Long signedInId = stateManager.getTelegramSignedInUserId(chatId);
        boolean isManager = signedInId != null && isUserManager(signedInId);
        List<KeyboardRow> rows = new ArrayList<>();
        rows.add(new KeyboardRow(BotLabels.LIST_ALL_ITEMS.getLabel()));
        if (isManager) {
            rows.add(new KeyboardRow(BotLabels.ADD_NEW_ITEM.getLabel()));
        }
        if (!isManager) {
            rows.add(new KeyboardRow(BotLabels.MY_PERFORMANCE.getLabel()));
        }
        rows.add(new KeyboardRow(BotLabels.SHOW_MAIN_SCREEN.getLabel(), BotLabels.HIDE_MAIN_SCREEN.getLabel()));
        rows.add(new KeyboardRow(BotLabels.LOG_OUT.getLabel()));
        return ReplyKeyboardMarkup.builder()
                .keyboard(rows)
                .resizeKeyboard(true)
                .build();
    }

    private void sendMainMenuKeyboard(String introMessage) {
        BotHelper.sendMessageToTelegram(chatId, introMessage, telegramClient, buildMainMenuKeyboardMarkup());
    }

    private void deliverPendingAssignmentNotices(Long userId) {
        if (pendingTelegramAssignmentNoticeService == null || userId == null) {
            return;
        }
        List<PendingAssignmentNotice> notices = pendingTelegramAssignmentNoticeService.drainForUser(userId);
        List<String> messages = new ArrayList<>();
        for (PendingAssignmentNotice notice : notices) {
            String text = pendingTelegramAssignmentNoticeService.formatTelegramMessage(notice);
            if (text != null && !text.isBlank()) {
                messages.add(text);
            }
        }
        if (messages.isEmpty()) {
            return;
        }
        ReplyKeyboardMarkup menu = buildMainMenuKeyboardMarkup();
        for (int i = 0; i < messages.size(); i++) {
            if (i == messages.size() - 1) {
                BotHelper.sendMessageToTelegram(chatId, messages.get(i), telegramClient, menu);
            } else {
                BotHelper.sendMessageKeepReplyKeyboard(chatId, messages.get(i), telegramClient);
            }
        }
    }

    private void restoreMainMenuForSignedInUser() {
        Long signedIn = stateManager.getTelegramSignedInUserId(chatId);
        String welcomeName = signedIn != null ? resolveUserWelcomeName(signedIn) : null;
        sendMainMenuKeyboard(helloMyTodoBotWithDeveloperName(welcomeName));
    }

    /** After performance summary: restore keyboard only (no welcome message). */
    private void restoreMainMenuAfterPerformance() {
        BotHelper.sendMessageToTelegram(chatId, "📋", telegramClient, buildMainMenuKeyboardMarkup());
    }

    /** Immediate feedback while data is fetched (no reply keyboard). */
    private void sendLoadingMessage(String what) {
        String label = (what == null || what.isBlank()) ? "content" : what.trim();
        BotHelper.sendMessageToTelegram(chatId, "⏳ Loading " + label + "…", telegramClient, null);
    }

    private void performSignOut() {
        stateManager.clearTelegramSignedIn(chatId);
        telegramUserMappingService.unregisterUser(chatId);
        stateManager.clearPendingState(chatId);
        BotHelper.sendMessageToTelegram(chatId, BotMessages.SIGNED_OUT.getMessage(), telegramClient, null);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COMMAND HANDLERS
    // ─────────────────────────────────────────────────────────────────────────

    private void beginSignInFlow() {
        stateManager.setSessionLoginAwaitingIdentifier(chatId);
        BotHelper.sendMessageToTelegram(chatId,
                "Welcome! Sign in with the same phone or email and password provided by your administrator.\n\n"
                        + "Enter your phone number or email:",
                telegramClient, null);
    }

    public void fnStart() {
        if (!isStartCommand(requestText) || exit) {
            return;
        }
        if (stateManager.isTelegramSignedIn(chatId)) {
            Long uid = stateManager.getTelegramSignedInUserId(chatId);
            String nm = resolveUserWelcomeName(uid);
            sendMainMenuKeyboard(helloMyTodoBotWithDeveloperName(nm));
            deliverPendingAssignmentNotices(uid);
        } else {
            beginSignInFlow();
        }
        exit = true;
    }

    public void fnSessionLogin() {
        if (exit || userService == null) return;
        if (stateManager.isSessionLoginAwaitingPassword(chatId)) {
            String password = requestText != null ? requestText.trim() : "";
            if (password.isEmpty()) {
                BotHelper.sendMessageToTelegram(chatId, "Password cannot be empty. Please try again.", telegramClient, null);
                exit = true;
                return;
            }
            String identifier = stateManager.getSessionLoginPendingIdentifier(chatId);
            if (identifier == null || identifier.isBlank()) {
                stateManager.setSessionLoginAwaitingIdentifier(chatId);
                BotHelper.sendMessageToTelegram(chatId, "Session expired. Please enter your phone number or email again:", telegramClient, null);
                exit = true;
                return;
            }
            Optional<Long> userId = userService.verifyCredentialsByPhoneOrEmailAndPassword(identifier, password);
            if (userId.isEmpty()) {
                stateManager.setSessionLoginAwaitingIdentifier(chatId);
                BotHelper.sendMessageToTelegram(chatId, "❌ Invalid credentials. Please enter your phone number or email again:", telegramClient, null);
                exit = true;
                return;
            }
            Long signedUserId = userId.get();
            telegramUserMappingService.registerUser(chatId, signedUserId.intValue());
            stateManager.setTelegramSignedInUser(chatId, signedUserId);
            String welcomeName = resolveUserWelcomeName(signedUserId);
            sendMainMenuKeyboard("✅ Signed in successfully!\n\n" + helloMyTodoBotWithDeveloperName(welcomeName));
            deliverPendingAssignmentNotices(signedUserId);
            exit = true;
            return;
        }
        if (stateManager.isSessionLoginAwaitingIdentifier(chatId)) {
            if (isStartCommand(requestText)) {
                beginSignInFlow();
                exit = true;
                return;
            }
            String identifier = requestText != null ? requestText.trim() : "";
            if (identifier.isEmpty()) {
                BotHelper.sendMessageToTelegram(chatId, "Please enter a valid phone number or email.", telegramClient, null);
                exit = true;
                return;
            }
            stateManager.setSessionLoginAwaitingPassword(chatId, identifier);
            BotHelper.sendMessageToTelegram(chatId, "Enter your password:", telegramClient, null);
            exit = true;
        }
    }

    public void fnDone() {
        if (exit) return;
        if (!stateManager.isTelegramSignedIn(chatId)) {
            BotHelper.sendMessageToTelegram(chatId, "Please sign in with /start first.", telegramClient, null);
            exit = true;
            return;
        }
        if (stateManager.isViewingSprintTasks(chatId) || stateManager.isSelectingTaskStatus(chatId) || exit) return;
        if (!(requestText.indexOf(BotLabels.DONE.getLabel()) != -1) || exit) return;

        String done = requestText.substring(0, requestText.indexOf(BotLabels.DASH.getLabel()));
        Integer id = Integer.valueOf(done);

        try {
            ToDoItem item = todoService.getToDoItemById(id);
            if (item == null) {
                BotHelper.sendMessageToTelegram(chatId, "Task not found.", telegramClient, null);
                exit = true;
                return;
            }
            Long actingUserId = resolveEffectiveActingUserId();
            if (!userTaskService.isUserAssignedToTask(actingUserId, (long) id)) {
                BotHelper.sendMessageToTelegram(chatId,
                        "You are not assigned to this task. You can only mark your own assignment complete.",
                        telegramClient, null);
                exit = true;
                return;
            }
            Long sprintId = item.getAssignedSprint() != null ? item.getAssignedSprint().longValue() : null;
            stateManager.setWaitingForHours(chatId, id, sprintId, actingUserId);
            BotHelper.sendMessageToTelegram(chatId,
                    "How many hours did you work on this task? (e.g. 2 or 1.5)",
                    telegramClient, null);
        } catch (Exception e) {
            logger.error(e.getLocalizedMessage(), e);
        }
        exit = true;
    }

    public void fnUndo() {
        if (exit) return;
        if (!stateManager.isTelegramSignedIn(chatId)) {
            BotHelper.sendMessageToTelegram(chatId, "Please sign in with /start first.", telegramClient, null);
            exit = true;
            return;
        }
        if (stateManager.isViewingSprintTasks(chatId) || stateManager.isSelectingTaskStatus(chatId) || exit) return;
        if (requestText.indexOf(BotLabels.UNDO.getLabel()) == -1 || exit) return;
        try {
            String idStr = requestText.substring(0, requestText.indexOf(BotLabels.DASH.getLabel()));
            int id = Integer.parseInt(idStr);
            ToDoItem item = todoService.getToDoItemById(id);
            if (item == null) { exit = true; return; }
            Long actingUserId = resolveEffectiveActingUserId();
            boolean reopened = userTaskService.reopenMyAssignment(actingUserId, (long) id);
            if (!reopened) {
                item.setDone(false);
                todoService.updateToDoItem(id, item);
            }
            BotHelper.sendMessageToTelegram(chatId, BotMessages.ITEM_UNDONE.getMessage(), telegramClient, null);
        } catch (Exception e) {
            logger.error("fnUndo error: " + e.getMessage());
        }
        exit = true;
    }

    public void fnDelete() {
        if (exit) return;
        if (!stateManager.isTelegramSignedIn(chatId)) {
            BotHelper.sendMessageToTelegram(chatId, "Please sign in with /start first.", telegramClient, null);
            exit = true;
            return;
        }
        if (stateManager.isViewingSprintTasks(chatId) || stateManager.isSelectingTaskStatus(chatId) || exit) return;
        if (requestText.indexOf(BotLabels.DELETE.getLabel()) == -1 || exit) return;
        try {
            String idStr = requestText.substring(0, requestText.indexOf(BotLabels.DASH.getLabel()));
            int id = Integer.parseInt(idStr);
            todoService.deleteToDoItem(id);
            BotHelper.sendMessageToTelegram(chatId, BotMessages.ITEM_DELETED.getMessage(), telegramClient);
        } catch (Exception e) {
            logger.error("fnDelete error: " + e.getMessage());
        }
        exit = true;
    }

    private static String toUserPickerButton(User u) {
        String base = (u.getName() != null && !u.getName().isBlank()) ? u.getName().trim() : ("User " + u.getId());
        String suffix = " #" + u.getId();
        String prefix = "👤 ";
        int maxBase = TELEGRAM_BUTTON_MAX - prefix.length() - suffix.length();
        if (maxBase < 4) maxBase = 4;
        if (base.length() > maxBase) base = base.substring(0, maxBase - 1) + "…";
        return prefix + base + suffix;
    }

    private static Long parseUserPickerSelection(String text) {
        if (text == null) return null;
        Matcher m = USER_PICKER_ID.matcher(text.trim());
        if (!m.matches()) return null;
        return Long.parseLong(m.group(1));
    }

    /** Chronological order for sprint picker (start → due → id). */
    private static List<Sprint> sortSprintsForTelegramMenu(List<Sprint> sprints) {
        if (sprints == null || sprints.size() < 2) {
            return sprints;
        }
        List<Sprint> sorted = new ArrayList<>(sprints);
        sorted.sort(Comparator
                .comparing(Sprint::getStartDate, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(Sprint::getDueDate, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(Sprint::getId, Comparator.nullsLast(Comparator.naturalOrder())));
        return sorted;
    }

    private void sendSelectSprintKeyboard(String optionalNotice) {
        sendLoadingMessage("sprints");
        stateManager.setSelectingSprint(chatId);
        List<Sprint> allSprints = sortSprintsForTelegramMenu(sprintService.findAll());
        List<Sprint> sprintsToShow = allSprints;
        Long signedInId = stateManager.getTelegramSignedInUserId(chatId);
        if (signedInId != null && isUserManager(signedInId)) {
            sprintsToShow = sprintsForManagerScope(signedInId);
        } else if (signedInId != null) {
            List<Long> sprintIdsWithWork = userTaskService.findSprintIdsWithAssignmentsForUser(signedInId);
            Set<Long> idSet = new HashSet<>(sprintIdsWithWork);
            sprintsToShow = allSprints.stream()
                    .filter(s -> idSet.contains(s.getId()))
                    .collect(Collectors.toList());
        }
        if (sprintsToShow.isEmpty()) {
            ReplyKeyboardMarkup emptyKb = ReplyKeyboardMarkup.builder()
                    .keyboardRow(new KeyboardRow(BotLabels.SHOW_MAIN_SCREEN.getLabel(), BotLabels.LOG_OUT.getLabel()))
                    .resizeKeyboard(true)
                    .selective(true)
                    .build();
            String emptyMsg = signedInId != null && isUserManager(signedInId)
                    ? "📋 No sprints found yet.\n\nCreate sprints in the web app."
                    : "📋 No sprints with tasks assigned to you yet.\n\nAsk your manager to assign tasks in the web app.";
            BotHelper.sendMessageToTelegram(chatId, emptyMsg, telegramClient, emptyKb);
            stateManager.clearPendingState(chatId);
            exit = true;
            return;
        }
        List<KeyboardRow> keyboard = new ArrayList<>();
        boolean signedInIsManager = signedInId != null && isUserManager(signedInId);
        if (signedInIsManager) {
            keyboard.add(new KeyboardRow(BotLabels.SHOW_MAIN_SCREEN.getLabel(), BotLabels.ADD_NEW_ITEM.getLabel()));
        } else {
            keyboard.add(new KeyboardRow(BotLabels.SHOW_MAIN_SCREEN.getLabel()));
        }
        keyboard.add(new KeyboardRow(BotLabels.LOG_OUT.getLabel()));
        for (Sprint sprint : sprintsToShow) {
            KeyboardRow currentRow = new KeyboardRow();
            currentRow.add("Sprint " + sprint.getId());
            keyboard.add(currentRow);
        }
        ReplyKeyboardMarkup keyboardMarkup = ReplyKeyboardMarkup.builder()
                .keyboard(keyboard)
                .resizeKeyboard(true)
                .selective(true)
                .build();
        String msg = (optionalNotice != null && !optionalNotice.isBlank())
                ? optionalNotice + "\n\n📋 Choose a sprint:"
                : "📋 *Select a Sprint to view tasks:*";
        BotHelper.sendMessageToTelegram(chatId, msg, telegramClient, keyboardMarkup);
    }

    private List<Sprint> sprintsForManagerScope(Long managerId) {
        if (projectLookupService != null && managerId != null) {
            Optional<Project> project = projectLookupService.findPrimaryProjectForManager(managerId);
            if (project.isPresent()) {
                List<Sprint> projectSprints = sprintService.findByProjectIdOrderByStartDateAsc(project.get().getId());
                return sortSprintsForTelegramMenu(projectSprints);
            }
        }
        return List.of();
    }

    private List<Sprint> sprintsForManagerAddTask(Long managerId) {
        return sprintsForManagerScope(managerId);
    }

    private List<User> teamMembersForManager(Long managerId) {
        if (teamRepository == null || teamMembersRepository == null || managerId == null) {
            return List.of();
        }
        return teamRepository.findByManagerId(managerId)
                .map(team -> teamMembersRepository.findByTeam_Id(team.getId()).stream()
                        .map(TeamMember::getUser)
                        .filter(Objects::nonNull)
                        .sorted(Comparator.comparing(this::displayNameForUser, String.CASE_INSENSITIVE_ORDER))
                        .collect(Collectors.toList()))
                .orElse(List.of());
    }

    private String displayNameForUser(User u) {
        if (u.getName() != null && !u.getName().isBlank()) {
            return u.getName().trim();
        }
        if (u.getEmail() != null && !u.getEmail().isBlank()) {
            return u.getEmail().trim();
        }
        return "User " + u.getId();
    }

    private void sendSelectSprintForNewTaskKeyboard() {
        sendLoadingMessage("sprints");
        Long managerId = stateManager.getTelegramSignedInUserId(chatId);
        stateManager.setSelectingSprintForNewTask(chatId);
        List<Sprint> sprintsToShow = sprintsForManagerAddTask(managerId);
        if (sprintsToShow.isEmpty()) {
            ReplyKeyboardMarkup emptyKb = ReplyKeyboardMarkup.builder()
                    .keyboardRow(new KeyboardRow(BotLabels.SHOW_MAIN_SCREEN.getLabel(), BotLabels.LOG_OUT.getLabel()))
                    .resizeKeyboard(true)
                    .selective(true)
                    .build();
            BotHelper.sendMessageToTelegram(chatId,
                    "📋 No sprints found for your project.\n\nCreate sprints in the web app first.",
                    telegramClient, emptyKb);
            stateManager.clearPendingState(chatId);
            exit = true;
            return;
        }
        List<KeyboardRow> keyboard = new ArrayList<>();
        keyboard.add(new KeyboardRow(BotLabels.CANCEL_ADD.getLabel()));
        keyboard.add(new KeyboardRow(BotLabels.SHOW_MAIN_SCREEN.getLabel(), BotLabels.LOG_OUT.getLabel()));
        for (Sprint sprint : sprintsToShow) {
            keyboard.add(new KeyboardRow("Sprint " + sprint.getId()));
        }
        ReplyKeyboardMarkup keyboardMarkup = ReplyKeyboardMarkup.builder()
                .keyboard(keyboard)
                .resizeKeyboard(true)
                .selective(true)
                .build();
        BotHelper.sendMessageToTelegram(chatId,
                "➕ *Add new task*\n\n📋 Choose the sprint for this task:",
                telegramClient, keyboardMarkup);
        exit = true;
    }

    private void sendSelectAssigneeForNewTaskKeyboard(Long sprintId) {
        sendLoadingMessage("assignees");
        stateManager.setSelectingAssigneeForNewTask(chatId, sprintId);
        Long managerId = stateManager.getTelegramSignedInUserId(chatId);
        List<User> members = teamMembersForManager(managerId);
        List<KeyboardRow> keyboard = new ArrayList<>();
        keyboard.add(new KeyboardRow("⬅️ Back to Sprints", BotLabels.SKIP_ASSIGNEE.getLabel()));
        keyboard.add(new KeyboardRow(BotLabels.CANCEL_ADD.getLabel()));
        keyboard.add(new KeyboardRow(BotLabels.SHOW_MAIN_SCREEN.getLabel(), BotLabels.LOG_OUT.getLabel()));
        for (User u : members) {
            keyboard.add(new KeyboardRow(toUserPickerButton(u)));
        }
        ReplyKeyboardMarkup keyboardMarkup = ReplyKeyboardMarkup.builder()
                .keyboard(keyboard)
                .resizeKeyboard(true)
                .selective(true)
                .build();
        String assigneeHint = members.isEmpty()
                ? "No team members found — tap *No assignee* or add members in the web app."
                : "Optional: pick a team member to assign, or tap *No assignee*.";
        BotHelper.sendMessageToTelegram(chatId,
                "➕ *Sprint " + sprintId + "*\n\n👥 " + assigneeHint,
                telegramClient, keyboardMarkup);
        exit = true;
    }

    private void promptForNewTaskDescription(Long sprintId, Long assigneeUserId) {
        stateManager.setWaitingForNewTaskDescription(chatId, sprintId, assigneeUserId);
        StringBuilder msg = new StringBuilder("📝 ");
        Sprint sprint = sprintId != null ? sprintService.findById(sprintId) : null;
        if (sprint != null && sprint.getGoal() != null && !sprint.getGoal().isBlank()) {
            String goal = sprint.getGoal().trim();
            if (goal.length() > 60) {
                goal = goal.substring(0, 59) + "…";
            }
            msg.append("Sprint ").append(sprintId).append(" (").append(goal).append(")");
        } else if (sprintId != null) {
            msg.append("Sprint ").append(sprintId);
        }
        if (assigneeUserId != null && userService != null) {
            userService.getUserById(assigneeUserId).ifPresent(u ->
                    msg.append("\n👤 Assignee: ").append(displayNameForUser(u)));
        } else if (sprintId != null) {
            msg.append("\n👤 No assignee selected");
        }
        msg.append("\n\n").append(BotMessages.TYPE_NEW_TODO_ITEM.getMessage());
        BotHelper.sendMessageToTelegram(chatId, msg.toString(), telegramClient, null);
    }

    private ToDoItem createTaskFromBotDescription(String desc, Long sprintId, Long assigneeUserId) {
        ToDoItem newItem = new ToDoItem();
        newItem.setDescription(desc);
        newItem.setCreation_ts(OffsetDateTime.now());
        newItem.setDone(false);
        if (sprintId != null) {
            newItem.setAssignedSprint(Math.toIntExact(sprintId));
            Sprint sprint = sprintService.findById(sprintId);
            if (sprint != null && sprint.getDueDate() != null) {
                newItem.setDueDate(sprint.getDueDate().atZone(ZoneId.systemDefault()).toOffsetDateTime());
            }
        }
        ToDoItem saved = todoService.addToDoItem(newItem);
        if (assigneeUserId != null) {
            userTaskService.assignUserToTaskAsTodo(assigneeUserId, saved.getID());
        }
        return saved;
    }

    private String buildNewTaskConfirmation(Long sprintId, Long assigneeUserId) {
        StringBuilder msg = new StringBuilder("✅ New task added");
        if (sprintId != null) {
            msg.append(" to Sprint ").append(sprintId);
            Sprint sprint = sprintService.findById(sprintId);
            if (sprint != null && sprint.getGoal() != null && !sprint.getGoal().isBlank()) {
                String goal = sprint.getGoal().trim();
                if (goal.length() > 60) {
                    goal = goal.substring(0, 59) + "…";
                }
                msg.append(" (").append(goal).append(")");
            }
        }
        msg.append(".");
        if (assigneeUserId != null && userService != null) {
            userService.getUserById(assigneeUserId).ifPresent(u ->
                    msg.append("\n👤 Assigned to: ").append(displayNameForUser(u)));
        }
        msg.append("\n\n").append(BotMessages.NEW_ITEM_ADDED.getMessage());
        return msg.toString();
    }

    private void cancelAddNewTaskFlow() {
        stateManager.clearPendingState(chatId);
        sendMainMenuKeyboard("Add task cancelled.");
        exit = true;
    }

    private boolean isAllowedSprintForManagerAdd(Long managerId, Long sprintId) {
        if (sprintId == null) {
            return false;
        }
        return sprintsForManagerAddTask(managerId).stream().anyMatch(s -> sprintId.equals(s.getId()));
    }

    private static String keyboardLabelForItem(ToDoItem item) {
        if (item.getTitle() != null && !item.getTitle().trim().isEmpty()) return item.getTitle().trim();
        if (item.getDescription() != null && !item.getDescription().isEmpty()) {
            return RichTextDescriptionUtil.toPlainTextSingleLine(item.getDescription());
        }
        return "Task #" + item.getID();
    }

    private static String formatTaskDescriptionForDisplay(String description) {
        String plain = RichTextDescriptionUtil.toPlainText(description);
        return plain.isEmpty() ? "No description provided" : plain;
    }

    private static String formatTaskStatusForDisplay(String dbStatus) {
        if (dbStatus == null || dbStatus.isBlank()) return "❔ No status set";
        return statusIconOnly(dbStatus) + " " + formatTaskStatusTextOnly(dbStatus);
    }

    /** Single emoji for task list rows (left of title). */
    private static String statusIconOnly(String dbStatus) {
        if (dbStatus == null || dbStatus.isBlank()) return "❔";
        String key = dbStatus.trim().toUpperCase().replace(' ', '_').replace('-', '_');
        if ("TO_DO".equals(key)) key = "TODO";
        if ("TODO".equals(key)) return "📝";
        if ("IN_PROGRESS".equals(key)) return "🔄";
        if ("IN_REVIEW".equals(key)) return "👀";
        if ("DONE".equals(key) || "FINISHED".equals(key) || "COMPLETED".equals(key) || "CLOSED".equals(key)) return "✅";
        if ("BLOCKED".equals(key)) return "🚧";
        if ("PENDING".equals(key)) return "⏳";
        return "📌";
    }

    private static String formatTaskStatusTextOnly(String dbStatus) {
        if (dbStatus == null || dbStatus.isBlank()) return "No status";
        String key = dbStatus.trim().toUpperCase().replace(' ', '_').replace('-', '_');
        if ("TO_DO".equals(key)) key = "TODO";
        if ("TODO".equals(key)) return "To do";
        if ("IN_PROGRESS".equals(key)) return "In progress";
        if ("IN_REVIEW".equals(key)) return "In review";
        if ("DONE".equals(key) || "FINISHED".equals(key) || "COMPLETED".equals(key) || "CLOSED".equals(key)) return "Done";
        if ("BLOCKED".equals(key)) return "Blocked";
        if ("PENDING".equals(key)) return "Pending";
        return dbStatus.trim();
    }

    /** Compact label for the status column on split task rows. */
    private static String formatTaskStatusTextShort(String dbStatus) {
        if (dbStatus == null || dbStatus.isBlank()) return "—";
        String key = dbStatus.trim().toUpperCase().replace(' ', '_').replace('-', '_');
        if ("TO_DO".equals(key)) key = "TODO";
        if ("TODO".equals(key)) return "To do";
        if ("IN_PROGRESS".equals(key)) return "In prog";
        if ("IN_REVIEW".equals(key)) return "Review";
        if ("DONE".equals(key) || "FINISHED".equals(key) || "COMPLETED".equals(key) || "CLOSED".equals(key)) return "Done";
        if ("BLOCKED".equals(key)) return "Blocked";
        if ("PENDING".equals(key)) return "Pending";
        String t = dbStatus.trim();
        return t.length() > 12 ? t.substring(0, 11) + "…" : t;
    }

    private static String formatShortDate(LocalDateTime date) {
        if (date == null) return "";
        return date.format(DateTimeFormatter.ofPattern("MMM d"));
    }

    /** Resolved DB/USER_TASK status key for one assignee (same rules as list labels). */
    private String resolveAssigneeStatusKey(
            ToDoItem item,
            Long assigneeUserId,
            UserTaskService.UserSprintTaskListIndex sprintIndex,
            boolean taskLevelStatusOnly) {
        if (taskLevelStatusOnly) {
            if (item == null || item.getStatus() == null || item.getStatus().isBlank()) {
                return null;
            }
            return item.getStatus();
        }
        if (assigneeUserId != null && item != null && sprintIndex != null) {
            long taskId = item.getID();
            if (sprintIndex.myCompletedAssignmentTaskIds.contains(taskId)) {
                return "DONE";
            }
            String fromIndex = sprintIndex.assignmentStatusByTaskId.get(taskId);
            if (fromIndex != null && !fromIndex.isBlank()) {
                return fromIndex;
            }
            if (sprintIndex.assignedTaskIds.contains(taskId)) {
                return "TODO";
            }
        }
        if (item == null || item.getStatus() == null || item.getStatus().isBlank()) {
            return null;
        }
        return item.getStatus();
    }

    private String statusIconForAssigneeTaskList(
            ToDoItem item,
            Long assigneeUserId,
            UserTaskService.UserSprintTaskListIndex sprintIndex,
            boolean taskLevelStatusOnly) {
        return statusIconOnly(resolveAssigneeStatusKey(item, assigneeUserId, sprintIndex, taskLevelStatusOnly));
    }

    private String statusTextShortForAssigneeTaskList(
            ToDoItem item,
            Long assigneeUserId,
            UserTaskService.UserSprintTaskListIndex sprintIndex,
            boolean taskLevelStatusOnly) {
        return formatTaskStatusTextShort(resolveAssigneeStatusKey(item, assigneeUserId, sprintIndex, taskLevelStatusOnly));
    }

    private static String taskListLabelWithStatusIcon(String statusIcon, String title) {
        String icon = statusIcon != null && !statusIcon.isBlank() ? statusIcon : "❔";
        String name = title != null ? title.trim() : "";
        return icon + " " + name;
    }

    private static String truncateTelegramButton(String text, int maxLen) {
        if (text == null) {
            return "";
        }
        if (text.length() <= maxLen) {
            return text;
        }
        if (maxLen < 2) {
            return text.substring(0, maxLen);
        }
        return text.substring(0, maxLen - 1) + "…";
    }

    private boolean isManagerViewingTeamMemberTasks(Long signedInUserId, Long assigneeUserId) {
        return signedInUserId != null
                && assigneeUserId != null
                && isUserManager(signedInUserId)
                && !signedInUserId.equals(assigneeUserId);
    }

    /**
     * Two columns in one row (50/50): task title (left, tappable) | status (right, reference / hint on tap).
     */
    private KeyboardRow buildTaskListKeyboardRow(
            ToDoItem item,
            Long assigneeUserId,
            UserTaskService.UserSprintTaskListIndex sprintIndex,
            boolean taskLevelStatusOnly) {
        KeyboardRow row = new KeyboardRow();
        String title = keyboardLabelForItem(item);
        String taskBtn = truncateTelegramButton(title != null ? title.trim() : "", TELEGRAM_TASK_BUTTON_MAX);
        String statusBtn = truncateTelegramButton(
                statusIconForAssigneeTaskList(item, assigneeUserId, sprintIndex, taskLevelStatusOnly) + " "
                        + statusTextShortForAssigneeTaskList(item, assigneeUserId, sprintIndex, taskLevelStatusOnly),
                TELEGRAM_STATUS_BUTTON_MAX);
        row.add(taskBtn);
        row.add(statusBtn);
        return row;
    }

    /**
     * @param linkStatusButton when true, tapping the status column opens the same task (detail screen).
     *        When false (manager read-only list), only the task title is tappable.
     */
    private static void registerTaskMenuRow(
            Map<String, Integer> menuLabels,
            KeyboardRow row,
            ToDoItem item,
            boolean linkStatusButton) {
        if (menuLabels == null || row == null || row.isEmpty() || item == null) {
            return;
        }
        menuLabels.put(row.get(0).getText().trim(), item.getID());
        if (linkStatusButton && row.size() > 1) {
            menuLabels.put(row.get(1).getText().trim(), item.getID());
        }
    }

    /** Display name after sign-in (DB name, else email). */
    private String resolveUserWelcomeName(Long userId) {
        if (userService == null || userId == null) return null;
        Optional<User> opt = userService.getUserById(userId);
        if (opt.isEmpty()) return null;
        User u = opt.get();
        if (u.getName() != null && !u.getName().isBlank()) return u.getName().trim();
        if (u.getEmail() != null && !u.getEmail().isBlank()) return u.getEmail().trim();
        return null;
    }

    private boolean isUserManager(Long userId) {
        if (userService == null || userId == null) return false;
        Optional<User> opt = userService.getUserById(userId);
        return opt.map(u -> u.getType() != null && u.getType().equalsIgnoreCase("MANAGER")).orElse(false);
    }

    private boolean isSignedInManagerFullSprintView(Long assigneeUserId) {
        Long signed = stateManager.getTelegramSignedInUserId(chatId);
        return signed != null
                && assigneeUserId != null
                && signed.equals(assigneeUserId)
                && isUserManager(assigneeUserId);
    }

    /** DB user id for the developer acting in this chat (not Telegram chat id). */
    private Long resolveActingAssigneeUserId() {
        return resolveEffectiveActingUserId();
    }

    private static String helloMyTodoBotWithDeveloperName(String developerName) {
        String base = BotMessages.HELLO_MYTODO_BOT.getMessage();
        if (developerName == null || developerName.isBlank()) return base;
        String leadWithNewline = "Hello! I'm MyTodoList Bot!\n";
        if (base.startsWith(leadWithNewline)) {
            String rest = base.substring(leadWithNewline.length());
            return "Hello " + developerName.trim() + "! I'm MyTodoList Bot!\n" + rest;
        }
        return base;
    }

    public void fnListAll() {
        if (!(requestText.equals(BotCommands.TODO_LIST.getCommand())
                || requestText.equals(BotLabels.LIST_ALL_ITEMS.getLabel())
                || requestText.equals(BotLabels.MY_TODO_LIST.getLabel())) || exit)
            return;
        if (!stateManager.isTelegramSignedIn(chatId)) {
            BotHelper.sendMessageToTelegram(chatId, "Please sign in with /start first.", telegramClient, null);
            exit = true;
            return;
        }
        sendSelectSprintKeyboard(null);
        exit = true;
    }

    public void fnSelectSprint() {
        if (!stateManager.isSelectingSprint(chatId) || exit) return;
        if (requestText.startsWith("Sprint ")) {
            try {
                String sprintIdStr = requestText.substring(7);
                Long sprintId = Long.parseLong(sprintIdStr);
                Long signedIn = stateManager.getTelegramSignedInUserId(chatId);
                if (signedIn != null) {
                    if (isUserManager(signedIn)) {
                        stateManager.setSelectingUserInSprint(chatId, sprintId);
                        showUserPickerForSprint(sprintId);
                    } else {
                        stateManager.setViewingSprintTasks(chatId, sprintId, signedIn);
                        showSprintTasksForAssignee(sprintId, signedIn);
                    }
                } else {
                    stateManager.setSelectingUserInSprint(chatId, sprintId);
                    showUserPickerForSprint(sprintId);
                }
                exit = true;
            } catch (NumberFormatException e) {
                BotHelper.sendMessageToTelegram(chatId, "Invalid sprint selection. Please try again.", telegramClient);
                exit = true;
            }
        }
    }

    public void fnSelectSprintForNewTask() {
        if (!stateManager.isSelectingSprintForNewTask(chatId) || exit) {
            return;
        }
        String text = requestText != null ? requestText.trim() : "";
        if (BotLabels.CANCEL_ADD.getLabel().equals(text)) {
            cancelAddNewTaskFlow();
            return;
        }
        if (BotLabels.SHOW_MAIN_SCREEN.getLabel().equals(text) || isStartCommand(text)) {
            stateManager.clearPendingState(chatId);
            exit = true;
            return;
        }
        if (!text.startsWith("Sprint ")) {
            return;
        }
        try {
            Long sprintId = Long.parseLong(text.substring(7));
            Long managerId = stateManager.getTelegramSignedInUserId(chatId);
            if (!isAllowedSprintForManagerAdd(managerId, sprintId)) {
                BotHelper.sendMessageToTelegram(chatId, "Invalid sprint. Please choose from the list.", telegramClient, null);
                exit = true;
                return;
            }
            sendSelectAssigneeForNewTaskKeyboard(sprintId);
        } catch (NumberFormatException e) {
            BotHelper.sendMessageToTelegram(chatId, "Invalid sprint selection. Please try again.", telegramClient, null);
            exit = true;
        }
    }

    public void fnSelectAssigneeForNewTask() {
        if (!stateManager.isSelectingAssigneeForNewTask(chatId) || exit) {
            return;
        }
        String text = requestText != null ? requestText.trim() : "";
        Long sprintId = stateManager.getNewTaskSprintId(chatId);
        if (sprintId == null) {
            sendSelectSprintForNewTaskKeyboard();
            return;
        }
        if (BotLabels.CANCEL_ADD.getLabel().equals(text)) {
            cancelAddNewTaskFlow();
            return;
        }
        if (BotLabels.SHOW_MAIN_SCREEN.getLabel().equals(text) || isStartCommand(text)) {
            stateManager.clearPendingState(chatId);
            exit = true;
            return;
        }
        if ("⬅️ Back to Sprints".equals(text)) {
            sendSelectSprintForNewTaskKeyboard();
            return;
        }
        if (BotLabels.SKIP_ASSIGNEE.getLabel().equals(text)) {
            promptForNewTaskDescription(sprintId, null);
            exit = true;
            return;
        }
        Long picked = parseUserPickerSelection(text);
        if (picked == null) {
            return;
        }
        List<User> allowed = teamMembersForManager(stateManager.getTelegramSignedInUserId(chatId));
        boolean allowedPick = allowed.stream().anyMatch(u -> picked.equals(u.getId()));
        if (!allowedPick && !allowed.isEmpty()) {
            BotHelper.sendMessageToTelegram(chatId, "Please pick a team member from the list.", telegramClient, null);
            exit = true;
            return;
        }
        promptForNewTaskDescription(sprintId, picked);
        exit = true;
    }

    private void showUserPickerForSprint(Long sprintId) {
        sendLoadingMessage("team members");
        List<User> users = userTaskService.findDistinctAssigneesBySprintId(sprintId);
        List<KeyboardRow> keyboard = new ArrayList<>();
        keyboard.add(new KeyboardRow("⬅️ Back to Sprints"));
        if (stateManager.isTelegramSignedIn(chatId)) keyboard.add(new KeyboardRow(BotLabels.LOG_OUT.getLabel()));
        if (users.isEmpty()) {
            sendSelectSprintKeyboard("ℹ️ This sprint has no tasks with assigned users (USER_TASK). Assign team members from the web app.");
            return;
        }
        for (User u : users) keyboard.add(new KeyboardRow(toUserPickerButton(u)));
        ReplyKeyboardMarkup keyboardMarkup = ReplyKeyboardMarkup.builder()
                .keyboard(keyboard).resizeKeyboard(true).selective(true).build();
        Long signedIn = stateManager.getTelegramSignedInUserId(chatId);
        boolean isManager = signedIn != null && isUserManager(signedIn);
        BotHelper.sendMessageToTelegram(chatId,
                isManager
                        ? ("👥 *Sprint " + sprintId + "* — pick a team member to view their assigned tasks:")
                        : ("👥 *Sprint " + sprintId + "* — pick your name to see **only your** assigned tasks:"),
                telegramClient, keyboardMarkup);
    }

    public void fnSelectUserInSprint() {
        if (!stateManager.isSelectingUserInSprint(chatId) || exit) return;
        if (BotLabels.LOG_OUT.getLabel().equals(requestText != null ? requestText.trim() : "")) {
            if (stateManager.isTelegramSignedIn(chatId)) performSignOut();
            else BotHelper.sendMessageToTelegram(chatId, BotMessages.NOT_SIGNED_IN_LOGOUT.getMessage(), telegramClient, null);
            exit = true;
            return;
        }
        if ("⬅️ Back to Sprints".equals(requestText)) {
            sendSelectSprintKeyboard(null);
            exit = true;
            return;
        }
        Long picked = parseUserPickerSelection(requestText);
        if (picked == null) { exit = true; return; }
        Long sprintId = stateManager.getSprintIdInSprintUserFlow(chatId);
        if (sprintId == null) { sendSelectSprintKeyboard(null); exit = true; return; }
        Long signedIn = stateManager.getTelegramSignedInUserId(chatId);
        boolean isManager = signedIn != null && isUserManager(signedIn);
        if (isManager) {
            // Managers are already authenticated: allow navigating team tasks read-only without impersonation
            stateManager.setViewingSprintTasks(chatId, sprintId, picked);
            showSprintTasksForAssignee(sprintId, picked);
        } else {
            stateManager.setVerifyingCredentialsPhoneEmail(chatId, picked, sprintId);
            BotHelper.sendMessageToTelegram(chatId,
                    "🔐 Before accessing tasks, please verify your identity.\n\nPlease enter your phone number or email:",
                    telegramClient, null);
        }
        exit = true;
    }

    private void showSprintTasksForAssignee(Long sprintId, Long assigneeUserId) {
        showSprintTasksForAssignee(sprintId, assigneeUserId, null);
    }

    private void showSprintTasksForAssignee(Long sprintId, Long assigneeUserId, String optionalNotice) {
        if (optionalNotice == null || optionalNotice.isBlank()) {
            sendLoadingMessage("tasks");
        }
        boolean managerFullSprint = isSignedInManagerFullSprintView(assigneeUserId);
        UserTaskService.UserSprintTaskListIndex sprintIndex = null;
        List<ToDoItem> sprintItems = todoService.findByAssignedSprint(Math.toIntExact(sprintId));

        final List<ToDoItem> mine;
        final List<ToDoItem> activeItems;
        final List<ToDoItem> doneItems;
        final Set<Long> myCompletedIds;

        if (managerFullSprint) {
            myCompletedIds = Set.of();
            mine = sprintItems;
            activeItems = mine.stream().filter(item -> !item.isDone()).collect(Collectors.toList());
            doneItems = mine.stream().filter(ToDoItem::isDone).collect(Collectors.toList());
        } else {
            sprintIndex = userTaskService.loadUserSprintTaskListIndex(assigneeUserId, sprintId);
            final Set<Long> allowedTaskIds = sprintIndex.assignedTaskIds;
            myCompletedIds = sprintIndex.myCompletedAssignmentTaskIds;
            mine = sprintItems.stream()
                    .filter(item -> allowedTaskIds.contains((long) item.getID()))
                    .collect(Collectors.toList());
            activeItems = mine.stream()
                    .filter(item -> !item.isDone() && !myCompletedIds.contains((long) item.getID()))
                    .collect(Collectors.toList());
            doneItems = mine.stream()
                    .filter(item -> item.isDone() || myCompletedIds.contains((long) item.getID()))
                    .collect(Collectors.toList());
        }

        final UserTaskService.UserSprintTaskListIndex statusIndex = sprintIndex;
        final boolean taskLevelStatusOnly = managerFullSprint;

        Long signedIn = stateManager.getTelegramSignedInUserId(chatId);
        boolean directSessionSprint = signedIn != null && signedIn.equals(assigneeUserId);
        boolean managerTeamMemberView = isManagerViewingTeamMemberTasks(signedIn, assigneeUserId);

        List<KeyboardRow> keyboard = new ArrayList<>();
        if (directSessionSprint) keyboard.add(new KeyboardRow("⬅️ Back to Sprints"));
        else {
            keyboard.add(new KeyboardRow("⬅️ Back to users"));
            keyboard.add(new KeyboardRow("⬅️ Back to Sprints"));
        }
        if (stateManager.isTelegramSignedIn(chatId)) keyboard.add(new KeyboardRow(BotLabels.LOG_OUT.getLabel()));

        Map<String, Integer> taskMenuLabels = new LinkedHashMap<>();
        for (ToDoItem item : activeItems) {
            KeyboardRow row = buildTaskListKeyboardRow(item, assigneeUserId, statusIndex, taskLevelStatusOnly);
            registerTaskMenuRow(taskMenuLabels, row, item, false);
            keyboard.add(row);
        }
        for (ToDoItem item : doneItems) {
            KeyboardRow row = buildTaskListKeyboardRow(item, assigneeUserId, statusIndex, taskLevelStatusOnly);
            registerTaskMenuRow(taskMenuLabels, row, item, false);
            keyboard.add(row);
        }
        stateManager.setSprintTaskMenuLabels(chatId, taskMenuLabels);

        ReplyKeyboardMarkup keyboardMarkup = ReplyKeyboardMarkup.builder()
                .keyboard(keyboard).resizeKeyboard(true).selective(true).build();

        String message;
        if (mine.isEmpty()) {
            if (managerFullSprint) {
                message = "📋 *No tasks in Sprint " + sprintId + " yet.*\n\n⬅️ Go back to sprints.";
            } else if (managerTeamMemberView) {
                String who = resolveUserWelcomeName(assigneeUserId);
                String display = who != null ? who : ("User " + assigneeUserId);
                message = "📋 *No tasks assigned to " + escapeMarkdown(display)
                        + " in Sprint " + sprintId + "*\n\n⬅️ Go back to users or sprints.";
            } else {
                message = "📋 *You have no assigned tasks in Sprint " + sprintId + "*\n\n⬅️ Go back to "
                        + (directSessionSprint ? "sprints." : "users or sprints.");
            }
        } else if (managerFullSprint) {
            message = "📋 *Sprint " + sprintId + " — all team tasks (manager)*\n\n"
                    + "Tap the *task name* for a read-only summary.";
        } else if (managerTeamMemberView) {
            String who = resolveUserWelcomeName(assigneeUserId);
            String display = who != null ? who : ("User " + assigneeUserId);
            message = "📋 *Sprint " + sprintId + " — " + escapeMarkdown(display) + "'s tasks*\n\n"
                    + "Tap the *task name* for a read-only summary.";
        } else {
            message = "📋 *Your tasks (Sprint " + sprintId + "):*\n\n"
                    + "Tap the *task name* to open details and change status there "
                    + "(use the status buttons on the next screen, not the list).";
        }

        if (optionalNotice != null && !optionalNotice.isBlank()) {
            message = optionalNotice + "\n\n" + message;
        }

        BotHelper.sendMessageToTelegram(chatId, message, telegramClient, keyboardMarkup);
    }

    public void fnViewSprintTasks() {
        if (!stateManager.isViewingSprintTasks(chatId) || exit) return;
        logger.debug("fnViewSprintTasks called with text: {}", requestText);

        if ("⬅️ Back to Sprints".equals(requestText)) {
            sendSelectSprintKeyboard(null);
            exit = true;
            return;
        }
        if (BotLabels.LOG_OUT.getLabel().equals(requestText != null ? requestText.trim() : "")) {
            if (stateManager.isTelegramSignedIn(chatId)) performSignOut();
            else BotHelper.sendMessageToTelegram(chatId, BotMessages.NOT_SIGNED_IN_LOGOUT.getMessage(), telegramClient, null);
            exit = true;
            return;
        }
        if ("⬅️ Back to users".equals(requestText)) {
            Long sprintId = stateManager.getViewingSprintId(chatId);
            Long assigneeUserId = stateManager.getViewingSelectedUserId(chatId);
            Long signedIn = stateManager.getTelegramSignedInUserId(chatId);
            if (signedIn != null && signedIn.equals(assigneeUserId) && sprintId != null) {
                sendSelectSprintKeyboard(null);
            } else if (sprintId != null) {
                stateManager.setSelectingUserInSprint(chatId, sprintId);
                showUserPickerForSprint(sprintId);
            } else {
                sendSelectSprintKeyboard(null);
            }
            exit = true;
            return;
        }

        Long sprintId = stateManager.getViewingSprintId(chatId);
        Long assigneeUserId = stateManager.getViewingSelectedUserId(chatId);
        if (assigneeUserId == null) {
            assigneeUserId = resolveEffectiveActingUserId();
        }
        Long signedInViewer = stateManager.getTelegramSignedInUserId(chatId);
        boolean viewerIsManager = signedInViewer != null && isUserManager(signedInViewer);

        if (sprintId == null || assigneeUserId == null) {
            logger.debug("Missing sprintId or assigneeUserId, returning to sprint selection");
            sendSelectSprintKeyboard(null);
            exit = true;
            return;
        }

        Integer taskId = extractTaskIdFromLabel(requestText);
        logger.debug("Extracted taskId: {} from text: {}", taskId, requestText);
        if (taskId == null) {
            if (looksLikeTaskListStatusColumnTap(requestText)) {
                showSprintTasksForAssignee(
                        sprintId,
                        assigneeUserId,
                        "ℹ️ The status on the right is for reference only.\n"
                                + "Tap the *task name* on the left to open the task and change your status.");
            }
            exit = true;
            return;
        }

        sendLoadingMessage("task");
        ToDoItem task = todoService.getToDoItemById(taskId);
        if (task == null) {
            BotHelper.sendMessageToTelegram(chatId, "Task not found.", telegramClient, null);
            exit = true;
            return;
        }

        // Managers should always view tasks read-only (even when browsing team members)
        if (viewerIsManager || isSignedInManagerFullSprintView(assigneeUserId)) {
            showTaskDetailsReadOnly(task, sprintId, assigneeUserId);
        } else if (userTaskService.isMyAssignmentCompleted(assigneeUserId, (long) taskId)) {
            showTaskDetailsCompletedForAssignee(task, sprintId, assigneeUserId);
        } else {
            showTaskDetailsWithStatusOptions(task, sprintId, assigneeUserId);
        }
        exit = true;
    }

    /** Status column buttons start with a status emoji (not linked to a task). */
    private static boolean looksLikeTaskListStatusColumnTap(String label) {
        if (label == null || label.isBlank()) {
            return false;
        }
        String t = label.trim();
        return t.startsWith("📝")
                || t.startsWith("🔄")
                || t.startsWith("👀")
                || t.startsWith("✅")
                || t.startsWith("🚧")
                || t.startsWith("⏳")
                || t.startsWith("❔")
                || t.startsWith("📌");
    }

    private Integer extractTaskIdFromLabel(String label) {
        if (label == null || label.isEmpty()) {
            return null;
        }
        Integer fromMenu = stateManager.resolveTaskIdFromMenuLabel(chatId, label);
        if (fromMenu != null) {
            logger.debug("Resolved task ID {} from menu label: {}", fromMenu, label);
            return fromMenu;
        }
        try {
            int dashIndex = label.indexOf(" - ");
            if (dashIndex > 0) {
                String idStr = label.substring(0, dashIndex).trim();
                int id = Integer.parseInt(idStr);
                logger.debug("Legacy: extracted task ID {} from label: {}", id, label);
                return id;
            }
            int id = Integer.parseInt(label.trim());
            logger.debug("Legacy: parsed whole string as task ID {} from label: {}", id, label);
            return id;
        } catch (Exception e) {
            logger.debug("Could not resolve task from label: {}", label);
            return null;
        }
    }

    
    /**
     * Assignee already marked their part complete (USER_TASK COMPLETED): read-only summary + reopen.
     */
    private void showTaskDetailsCompletedForAssignee(ToDoItem task, Long sprintId, Long assigneeUserId) {
        List<KeyboardRow> keyboard = new ArrayList<>();
        keyboard.add(new KeyboardRow("↩️ Reopen my part"));
        keyboard.add(new KeyboardRow("⬅️ Back to tasks"));

        ReplyKeyboardMarkup keyboardMarkup = ReplyKeyboardMarkup.builder()
                .keyboard(keyboard)
                .resizeKeyboard(true)
                .selective(true)
                .build();

        Double hours = userTaskService.getWorkedHours(assigneeUserId, (long) task.getID());
        String hoursLabel = WorkedHoursUtil.formatForDisplay(hours != null ? hours : 0.0);
        String taskDescription = formatTaskDescriptionForDisplay(task.getDescription());
        String dueDateLine = TaskDueDateFormatUtil.formatDueDateForTelegram(task.getDueDate());

        String message = String.format(
                "✅ *Task complete*\n\n"
                        + "*Title:* %s\n\n"
                        + "*Description:* %s\n\n"
                        + "*Status:* ✅ Done\n"
                        + "*Hours logged:* %s\n\n"
                        + "*Due date:* %s",
                escapeMarkdown(task.getTitle()),
                escapeMarkdown(taskDescription),
                hoursLabel,
                escapeMarkdown(dueDateLine));

        stateManager.setSelectingTaskStatus(chatId, task.getID(), sprintId, assigneeUserId);
        BotHelper.sendMessageToTelegram(chatId, message, telegramClient, keyboardMarkup);
    }

    /**
     * Show task details with status selection buttons
     */
    private void showTaskDetailsWithStatusOptions(ToDoItem task, Long sprintId, Long assigneeUserId) {
        List<KeyboardRow> keyboard = new ArrayList<>();
        KeyboardRow statusRow1 = new KeyboardRow();
        statusRow1.add("📝 To-do");
        statusRow1.add("🔄 In Process");
        keyboard.add(statusRow1);
        KeyboardRow statusRow2 = new KeyboardRow();
        statusRow2.add("👀 In Review");
        statusRow2.add("✅ Done");
        statusRow2.add("🚧 Blocked");
        keyboard.add(statusRow2);
        keyboard.add(new KeyboardRow("⬅️ Back to tasks"));

        ReplyKeyboardMarkup keyboardMarkup = ReplyKeyboardMarkup.builder()
                .keyboard(keyboard).resizeKeyboard(true).selective(true).build();

        String status = userTaskService.getAssignmentStatus(assigneeUserId, (long) task.getID())
                .map(BotActions::formatTaskStatusForDisplay)
                .orElse(formatTaskStatusForDisplay(task.getStatus()));
        String taskDescription = formatTaskDescriptionForDisplay(task.getDescription());
        String dueDateLine = TaskDueDateFormatUtil.formatDueDateForTelegram(task.getDueDate());

        String message = String.format(
                "📋 *Task Details*\n\n" +
                "*Title:* %s\n\n" +
                "*Description:* %s\n\n" +
                "*Status:* %s\n\n" +
                "*Due date:* %s\n\n" +
                "Select a new status:",
                escapeMarkdown(task.getTitle()),
                escapeMarkdown(taskDescription),
                escapeMarkdown(status),
                escapeMarkdown(dueDateLine)
        );

        stateManager.setSelectingTaskStatus(chatId, task.getID(), sprintId, assigneeUserId);
        BotHelper.sendMessageToTelegram(chatId, message, telegramClient, keyboardMarkup);
    }

    private void showTaskDetailsReadOnly(ToDoItem task, Long sprintId, Long assigneeUserId) {
        ReplyKeyboardMarkup keyboardMarkup = ReplyKeyboardMarkup.builder()
                .keyboard(List.of(new KeyboardRow("⬅️ Back to tasks")))
                .resizeKeyboard(true).selective(true).build();

        String taskDescription = formatTaskDescriptionForDisplay(task.getDescription());

        String message = String.format(
                "📋 *Task Details*\n\n*Title:* %s\n\n*Description:* %s\n\n*Status:* %s\n\n*Due date:* %s",
                escapeMarkdown(task.getTitle()),
                escapeMarkdown(taskDescription),
                escapeMarkdown(formatTaskStatusForDisplay(task.getStatus())),
                escapeMarkdown(TaskDueDateFormatUtil.formatDueDateForTelegram(task.getDueDate()))
        );

        stateManager.setSelectingTaskStatus(chatId, task.getID(), sprintId, assigneeUserId);
        BotHelper.sendMessageToTelegram(chatId, message, telegramClient, keyboardMarkup);
    }

    private String escapeMarkdown(String text) {
        if (text == null) return "";
        return text.replace("_", "\\_").replace("*", "\\*").replace("[", "\\[").replace("]", "\\]");
    }

    public void fnVerifyCredentialsPhoneEmail() {
        if (!stateManager.isVerifyingCredentialsPhoneEmail(chatId) || exit) return;
        String phoneEmail = requestText.trim();
        if (phoneEmail.isEmpty()) {
            BotHelper.sendMessageToTelegram(chatId, "Please enter a valid phone number or email.", telegramClient, null);
            exit = true;
            return;
        }
        Long userId = stateManager.getCredentialVerificationUserId(chatId);
        Long sprintId = stateManager.getSprintIdInSprintUserFlow(chatId);
        if (userId == null || sprintId == null) { sendSelectSprintKeyboard(null); exit = true; return; }
        stateManager.setVerifyingCredentialsPassword(chatId, userId, sprintId, phoneEmail);
        BotHelper.sendMessageToTelegram(chatId, "Now please enter your password:", telegramClient, null);
        exit = true;
    }

    public void fnVerifyCredentialsPassword() {
        if (!stateManager.isVerifyingCredentialsPassword(chatId) || exit) return;
        String password = requestText.trim();
        if (password.isEmpty()) {
            BotHelper.sendMessageToTelegram(chatId, "Password cannot be empty. Please try again.", telegramClient, null);
            exit = true;
            return;
        }
        Long userId = stateManager.getCredentialVerificationUserId(chatId);
        String phoneEmail = stateManager.getStoredPhoneEmailForVerification(chatId);
        Long sprintId = stateManager.getSprintIdInSprintUserFlow(chatId);
        if (userId == null || phoneEmail == null || sprintId == null) { sendSelectSprintKeyboard(null); exit = true; return; }

        boolean credentialsValid = userService != null && userService.verifyUserCredentials(userId, phoneEmail, password);

        if (credentialsValid) {
            telegramUserMappingService.registerUser(chatId, userId.intValue());
            stateManager.setTelegramSignedInUser(chatId, userId);
            stateManager.setViewingSprintTasks(chatId, sprintId, userId);
            String welcomeName = resolveUserWelcomeName(userId);
            String verifiedIntro = welcomeName != null
                    ? "Welcome, " + welcomeName + "! Your identity is verified."
                    : "Identity verified!";
            BotHelper.sendMessageToTelegram(chatId, verifiedIntro, telegramClient, null);
            deliverPendingAssignmentNotices(userId);
            showSprintTasksForAssignee(sprintId, userId);
        } else {
            BotHelper.sendMessageToTelegram(chatId,
                    "❌ Invalid credentials. Please try again.\n\nEnter your phone number or email:",
                    telegramClient, null);
            stateManager.setVerifyingCredentialsPhoneEmail(chatId, userId, sprintId);
        }
        exit = true;
    }

    public void fnSelectTaskStatus() {
        logger.debug("fnSelectTaskStatus: Called for chatId={}, requestText='{}'", chatId, requestText);
        if (!stateManager.isSelectingTaskStatus(chatId) || exit) return;

        if ("⬅️ Back to tasks".equals(requestText)) {
            Long sprintId = stateManager.getViewingSprintId(chatId);
            Long assigneeUserId = stateManager.getViewingSelectedUserId(chatId);
            if (assigneeUserId == null) {
                assigneeUserId = resolveActingAssigneeUserId();
            }
            if (sprintId != null && assigneeUserId != null) {
                stateManager.setViewingSprintTasks(chatId, sprintId, assigneeUserId);
                showSprintTasksForAssignee(sprintId, assigneeUserId);
            } else {
                sendSelectSprintKeyboard(null);
            }
            exit = true;
            return;
        }

        if ("↩️ Reopen my part".equals(requestText != null ? requestText.trim() : "")) {
            Integer taskId = stateManager.getSelectedTaskId(chatId);
            Long assigneeUserId = resolveActingAssigneeUserId();
            Long sprintId = stateManager.getViewingSprintId(chatId);
            if (taskId != null && assigneeUserId != null) {
                boolean reopened = userTaskService.reopenMyAssignment(assigneeUserId, (long) taskId);
                BotHelper.sendMessageToTelegram(
                        chatId,
                        reopened
                                ? "Your part was reopened. You can update the status again."
                                : "Could not reopen your assignment.",
                        telegramClient,
                        null);
                if (sprintId != null) {
                    stateManager.setViewingSprintTasks(chatId, sprintId, assigneeUserId);
                    showSprintTasksForAssignee(sprintId, assigneeUserId);
                }
            }
            exit = true;
            return;
        }

        Long signedInViewer = stateManager.getTelegramSignedInUserId(chatId);
        boolean viewerIsManager = signedInViewer != null && isUserManager(signedInViewer);
        if (viewerIsManager) {
            BotHelper.sendMessageToTelegram(chatId, "Manager view is read-only. Tap ⬅️ Back to tasks.", telegramClient, null);
            exit = true;
            return;
        }

        String newStatus = null;
        String normalizedRequest = requestText != null ? requestText.trim() : "";
        if ("📝 To-do".equals(normalizedRequest)) newStatus = "TODO";
        else if ("🔄 In Process".equals(normalizedRequest)) newStatus = "IN_PROGRESS";
        else if ("👀 In Review".equals(normalizedRequest)) newStatus = "IN_REVIEW";
        else if ("✅ Done".equals(normalizedRequest)) newStatus = "DONE";
        else if ("🚧 Blocked".equals(normalizedRequest) || "Blocked".equalsIgnoreCase(normalizedRequest)) newStatus = "BLOCKED";
        else { logger.debug("fnSelectTaskStatus: Unrecognized status button: '{}'", requestText); exit = true; return; }

        Integer taskId = stateManager.getSelectedTaskId(chatId);
        if (taskId == null) {
            BotHelper.sendMessageToTelegram(chatId, "Task not found.", telegramClient, null);
            exit = true;
            return;
        }

        ToDoItem task = todoService.getToDoItemById(taskId);
        if (task == null) {
            BotHelper.sendMessageToTelegram(chatId, "Task not found.", telegramClient, null);
            exit = true;
            return;
        }

        if ("DONE".equals(newStatus)) {
            Long actingUserId = resolveEffectiveActingUserId();
            Long sprintId = stateManager.getViewingSprintId(chatId);
            stateManager.setWaitingForHours(chatId, taskId, sprintId, actingUserId);
            BotHelper.sendMessageToTelegram(chatId,
                    "How many hours did you work on this task? (e.g. 2 or 1.5)",
                    telegramClient, null);
        } else if ("BLOCKED".equals(newStatus)) {
            Long actingUserId = resolveEffectiveActingUserId();
            stateManager.setWaitingForBlockedReason(chatId, taskId, actingUserId);
            BotHelper.sendMessageToTelegram(chatId,
                    "Please provide the reason why this task is blocked:",
                    telegramClient, null);
        } else {
            Long actingUserId = resolveEffectiveActingUserId();
            boolean updated = actingUserId != null
                    && userTaskService.updateAssignmentStatus(actingUserId, (long) taskId, newStatus);

            if (!updated) {
                BotHelper.sendMessageToTelegram(
                        chatId,
                        "Could not update your assignment. Make sure you are assigned to this task.",
                        telegramClient,
                        null);
                exit = true;
                return;
            }
            BotHelper.sendMessageToTelegram(chatId,
                    "✓ Task status updated to: " + formatTaskStatusForDisplay(newStatus),
                    telegramClient, null);
            Long sprintId = stateManager.getViewingSprintId(chatId);
            if (sprintId != null && actingUserId != null) {
                stateManager.setViewingSprintTasks(chatId, sprintId, actingUserId);
                showSprintTasksForAssignee(sprintId, actingUserId);
            }
        }
        exit = true;
    }

    // ========================================================================
    // MY PERFORMANCE - CON SELECCIÓN DE SPRINT
    // ========================================================================

    public void fnMyPerformance() {
        if (exit) return;
        if (!requestText.equals(BotCommands.MY_PERFORMANCE.getCommand())
                && !requestText.equals(BotLabels.MY_PERFORMANCE.getLabel())) {
            return;
        }

        if (!stateManager.isTelegramSignedIn(chatId)) {
            BotHelper.sendMessageToTelegram(chatId, "Please sign in with /start first.", telegramClient, null);
            exit = true;
            return;
        }

        Long userId = stateManager.getTelegramSignedInUserId(chatId);
        if (userId == null) {
            BotHelper.sendMessageToTelegram(chatId,
                    "Could not identify your user. Please sign in again with /start.",
                    telegramClient, null);
            exit = true;
            return;
        }
        if (isUserManager(userId)) {
            String nm = resolveUserWelcomeName(userId);
            sendMainMenuKeyboard("📊 Performance is available for developers only.\n\n" + helloMyTodoBotWithDeveloperName(nm));
            stateManager.clearPendingState(chatId);
            exit = true;
            return;
        }

        sendLoadingMessage("performance options");

        // Obtener sprints donde el usuario tiene tareas
        List<Long> sprintIdsWithWork = userTaskService.findSprintIdsWithAssignmentsForUser(userId);
        List<Sprint> mySprints = sortSprintsForTelegramMenu(
                sprintService.findAll().stream()
                        .filter(s -> sprintIdsWithWork.contains(s.getId()))
                        .collect(Collectors.toList()));

        stateManager.setMyPerformanceUserId(chatId, userId);
        stateManager.setMyPerformanceSprints(chatId, mySprints);
        stateManager.setSelectingMyPerformanceScope(chatId);

        List<KeyboardRow> keyboard = new ArrayList<>();
        keyboard.add(new KeyboardRow("📊 All sprints (overall)"));
        keyboard.add(new KeyboardRow("⬅️ Back to main menu"));

        if (!mySprints.isEmpty()) {
            for (Sprint sprint : mySprints) {
                String sprintLabel = "Sprint " + sprint.getId();
                String dateRange = "";
                if (sprint.getStartDate() != null && sprint.getDueDate() != null) {
                    dateRange = " (" + formatShortDate(sprint.getStartDate()) + " - " + formatShortDate(sprint.getDueDate()) + ")";
                }
                keyboard.add(new KeyboardRow(sprintLabel + dateRange));
            }
        } else {
            keyboard.add(new KeyboardRow("📭 No sprints with tasks yet"));
        }

        ReplyKeyboardMarkup keyboardMarkup = ReplyKeyboardMarkup.builder()
                .keyboard(keyboard)
                .resizeKeyboard(true)
                .selective(true)
                .build();

        BotHelper.sendMessageToTelegram(chatId,
                "📊 *Performance Summary*\n\n"
                        + "What would you like to see?\n\n"
                        + "• *All sprints*: Overall performance across all your assigned tasks\n"
                        + "• *Specific sprint*: Performance only for that sprint\n\n"
                        + "Select an option:",
                telegramClient, keyboardMarkup);
        exit = true;
    }

    public void fnSelectMyPerformanceScope() {
        if (!stateManager.isSelectingMyPerformanceScope(chatId) || exit) return;

        String text = requestText != null ? requestText.trim() : "";

        if ("⬅️ Back to main menu".equals(text)) {
            restoreMainMenuForSignedInUser();
            stateManager.clearPendingState(chatId);
            exit = true;
            return;
        }

        Long userId = stateManager.getMyPerformanceUserId(chatId);
        if (userId == null) {
            BotHelper.sendMessageToTelegram(chatId, "Session expired. Please use /start again.", telegramClient, null);
            stateManager.clearPendingState(chatId);
            exit = true;
            return;
        }

        Long selectedSprintId = null;

        if ("📊 All sprints (overall)".equals(text)) {
            selectedSprintId = null;
        } else if (text.startsWith("Sprint ")) {
            try {
                String sprintIdStr = text.substring(7).split(" ")[0];
                selectedSprintId = Long.parseLong(sprintIdStr);
            } catch (NumberFormatException e) {
                BotHelper.sendMessageToTelegram(chatId, "Invalid sprint selection. Please try again.", telegramClient, null);
                exit = true;
                return;
            }
        } else if (text.equals("📭 No sprints with tasks yet")) {
            BotHelper.sendMessageToTelegram(chatId,
                    "📊 You don't have any assigned tasks yet.\n\nAsk your manager to assign tasks to you in the web app.",
                    telegramClient, null);
            stateManager.clearPendingState(chatId);
            restoreMainMenuForSignedInUser();
            exit = true;
            return;
        } else {
            BotHelper.sendMessageToTelegram(chatId, "Please select a valid option.", telegramClient, null);
            exit = true;
            return;
        }

        stateManager.clearPendingState(chatId);
        generateAndSendPerformanceSummary(userId, selectedSprintId);
        exit = true;
    }

    private void generateAndSendPerformanceSummary(Long userId, Long sprintId) {
        sendLoadingMessage("performance summary");

        try {
            List<UserTask> myTasks;
            if (sprintId == null) {
                myTasks = userTaskService.findByUserId(userId);
            } else {
                myTasks = userTaskService.findByUserIdAndSprintId(userId, sprintId);
            }

            if (myTasks == null || myTasks.isEmpty()) {
                String msg = sprintId == null
                        ? "📊 No task assignments found for your account yet.\n\nAsk your manager to assign tasks in the web app."
                        : "📊 You have no tasks assigned in Sprint " + sprintId + ".\n\nTry selecting a different option.";
                BotHelper.sendMessageToTelegram(chatId, msg, telegramClient, null);
                return;
            }

            Sprint sprintInfo = null;
            if (sprintId != null) {
                sprintInfo = sprintService.findById(sprintId);
            }

            int total = 0;
            int completed = 0;
            int onTime = 0;
            int late = 0;
            int blocked = 0;
            double totalHours = 0;
            List<Map<String, Object>> taskDetails = new ArrayList<>();
            Map<Long, Integer> assigneeCountByTask = new HashMap<>();
            for (UserTask ut : myTasks) {
                Task t = ut.getTask();
                if (t != null && t.getId() != null) {
                    assigneeCountByTask.merge(t.getId(), 1, Integer::sum);
                }
            }

            for (UserTask ut : myTasks) {
                Task t = ut.getTask();
                if (t == null) continue;
                total++;

                boolean isDone = UserTask.isCompletedAssignmentStatus(ut.getStatus())
                        || (t.getStatus() != null && t.getStatus().equalsIgnoreCase("DONE"));

                if (isDone) {
                    completed++;
                    int assigneeCount = assigneeCountByTask.getOrDefault(t.getId(), 1);
                    Boolean onTimeFlag = UserTaskOnTimeUtil.evaluateAssignmentOnTime(ut, t, assigneeCount);
                    if (onTimeFlag != null) {
                        if (onTimeFlag) onTime++;
                        else late++;
                    }
                }
                if (Boolean.TRUE.equals(ut.getIsBlocked())) blocked++;
                if (ut.getWorkedHours() != null) totalHours += ut.getWorkedHours();

                if (taskDetails.size() < 20) {
                    Map<String, Object> td = new HashMap<>();
                    td.put("title", t.getTitle() != null ? t.getTitle() : "");
                    td.put("status", t.getStatus() != null ? t.getStatus() : "");
                    td.put("userTaskStatus", ut.getStatus() != null ? ut.getStatus() : "");
                    td.put("workedHours", ut.getWorkedHours() != null ? ut.getWorkedHours() : 0);
                    if (t.getDueDate() != null) td.put("dueDate", t.getDueDate().toString());
                    if (ut.getCompletedAt() != null) {
                        td.put("completedAt", ut.getCompletedAt().toString());
                    } else if (t.getFinishDate() != null) {
                        td.put("finishDate", t.getFinishDate().toString());
                    }
                    if (Boolean.TRUE.equals(ut.getIsBlocked())) {
                        td.put("blocked", true);
                        if (ut.getBlockedReason() != null) td.put("blockedReason", ut.getBlockedReason());
                    }
                    taskDetails.add(td);
                }
            }

            int pending = total - completed;
            double completionRate = total > 0 ? (completed * 100.0 / total) : 0;
            int onTimeKnown = onTime + late;
            double onTimeRate = onTimeKnown > 0 ? (onTime * 100.0 / onTimeKnown) : 0;

            String userName = resolveUserWelcomeName(userId);
            if (userName == null) userName = "Developer";

            String sprintContext = "";
            if (sprintInfo != null) {
                sprintContext = String.format(" for Sprint %d", sprintInfo.getId());
                if (sprintInfo.getStartDate() != null && sprintInfo.getDueDate() != null) {
                    sprintContext += String.format(" (%s - %s)",
                            formatShortDate(sprintInfo.getStartDate()),
                            formatShortDate(sprintInfo.getDueDate()));
                }
            } else {
                sprintContext = " across all sprints (overall performance)";
            }

            String prompt = buildDeveloperPerformancePromptWithContext(
                    userName, total, completed, pending, onTime, late, blocked, totalHours,
                    completionRate, onTimeRate, taskDetails, sprintContext);

            String summary;
            if (geminiService != null) {
                try {
                    summary = geminiService.generateDeveloperPerformanceSummary(prompt);
                } catch (Exception e) {
                    logger.error("Gemini performance summary failed: {}", e.getMessage());
                    summary = buildFallbackSummaryWithContext(userName, total, completed, pending, onTime, late, blocked, totalHours, completionRate, onTimeRate, sprintContext);
                }
            } else {
                summary = buildFallbackSummaryWithContext(userName, total, completed, pending, onTime, late, blocked, totalHours, completionRate, onTimeRate, sprintContext);
            }

            BotHelper.sendMessageToTelegram(chatId, summary, telegramClient, null);

        } catch (Exception e) {
            logger.error("generateAndSendPerformanceSummary error: {}", e.getMessage(), e);
            BotHelper.sendMessageToTelegram(chatId,
                    "❌ Sorry, there was an error generating your performance summary. Please try again later.",
                    telegramClient, null);
        } finally {
            restoreMainMenuAfterPerformance();
        }
    }

    private String buildDeveloperPerformancePromptWithContext(
            String name, int total, int completed, int pending,
            int onTime, int late, int blocked, double hours,
            double completionRate, double onTimeRate,
            List<Map<String, Object>> taskDetails, String sprintContext) {

        String statsJson;
        try {
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> stats = new HashMap<>();
            stats.put("developerName", name);
            stats.put("scope", sprintContext);
            stats.put("totalAssignedTasks", total);
            stats.put("completedTasks", completed);
            stats.put("pendingTasks", pending);
            stats.put("onTimeCompletedTasks", onTime);
            stats.put("lateCompletedTasks", late);
            stats.put("currentlyBlockedAssignments", blocked);
            stats.put("totalWorkedHours", hours);
            stats.put("completionRatePercent", Math.round(completionRate));
            stats.put("onTimeRatePercent", Math.round(onTimeRate));
            stats.put("taskDetails", taskDetails);
            statsJson = mapper.writeValueAsString(stats);
        } catch (Exception e) {
            statsJson = "{\"developerName\":\"" + name + "\",\"completedTasks\":" + completed + ",\"totalAssignedTasks\":" + total + "}";
        }

        return "You are an Agile coach giving a developer a personal performance summary via Telegram. "
                + "Be encouraging, concise, and actionable. Use plain text only — no JSON, no markdown headers, "
                + "no bullet symbols that look bad on Telegram. You can use emojis sparingly. Max 300 words.\n\n"
                + "Developer performance data" + sprintContext + ":\n" + statsJson + "\n\n"
                + "Write a summary covering:\n"
                + "1. Overall completion rate and what it means\n"
                + "2. On-time delivery performance\n"
                + "3. Hours logged and effort recognition\n"
                + "4. Any blocked tasks and encouragement to resolve them\n"
                + "5. One specific, actionable tip to improve\n"
                + "6. A short motivational closing line\n\n"
                + "Address the developer by first name. Keep it conversational and human.";
    }

    private String buildFallbackSummaryWithContext(
            String name, int total, int completed, int pending,
            int onTime, int late, int blocked, double hours,
            double completionRate, double onTimeRate, String sprintContext) {

        StringBuilder sb = new StringBuilder();
        sb.append("📊 *Performance Summary for ").append(name).append("*").append(sprintContext).append("\n\n");
        sb.append("✅ Completed: ").append(completed).append(" / ").append(total)
          .append(" tasks (").append(Math.round(completionRate)).append("%)\n");
        if (completed > 0) {
            sb.append("⏰ On time: ").append(onTime).append(" task(s)");
            if (late > 0) sb.append(", ").append(late).append(" late");
            sb.append(" (").append(Math.round(onTimeRate)).append("% on-time rate)\n");
        }
        sb.append("🕐 Hours logged: ").append(WorkedHoursUtil.formatForDisplay(hours)).append("h\n");
        if (pending > 0) sb.append("📝 Pending: ").append(pending).append(" task(s)\n");
        if (blocked > 0) sb.append("🚧 Blocked: ").append(blocked).append(" task(s) — reach out to your manager\n");
        sb.append("\nKeep it up! 💪");
        return sb.toString();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADD / LLM / ELSE
    // ─────────────────────────────────────────────────────────────────────────

    public void fnHide() {
        if (!(requestText.equals(BotCommands.HIDE_COMMAND.getCommand())
                || requestText.equals(BotLabels.HIDE_MAIN_SCREEN.getLabel())) || exit) return;
        BotHelper.sendMessageToTelegram(chatId, BotMessages.BYE.getMessage(), telegramClient);
        exit = true;
    }

    public void fnLogOut() {
        if (exit) return;
        String t = requestText != null ? requestText.trim() : "";
        if (!t.equals(BotCommands.LOGOUT_COMMAND.getCommand()) && !t.equals(BotLabels.LOG_OUT.getLabel())) return;
        if (!stateManager.isTelegramSignedIn(chatId)) {
            BotHelper.sendMessageToTelegram(chatId, BotMessages.NOT_SIGNED_IN_LOGOUT.getMessage(), telegramClient, null);
            exit = true;
            return;
        }
        performSignOut();
        exit = true;
    }

    public void fnElse() {
        if (exit) return;
        if (stateManager.isWaitingForNewTaskDescription(chatId)) {
            Long signedInForAdd = stateManager.getTelegramSignedInUserId(chatId);
            if (signedInForAdd != null && !isUserManager(signedInForAdd)) {
                stateManager.clearPendingState(chatId);
                sendDeveloperCannotAddTaskMessage();
                return;
            }
            String desc = requestText != null ? requestText.trim() : "";
            if (desc.isEmpty()) {
                BotHelper.sendMessageToTelegram(chatId, "Please send a short description for your new task.", telegramClient, null);
                exit = true;
                return;
            }
            if (desc.equals(BotLabels.ADD_NEW_ITEM.getLabel()) || desc.contains(BotCommands.ADD_ITEM.getCommand())) {
                BotHelper.sendMessageToTelegram(chatId, BotMessages.TYPE_NEW_TODO_ITEM.getMessage(), telegramClient, null);
                exit = true;
                return;
            }
            if (BotLabels.CANCEL_ADD.getLabel().equals(desc)) {
                cancelAddNewTaskFlow();
                return;
            }
            Long sprintId = stateManager.getNewTaskSprintId(chatId);
            Long assigneeId = stateManager.getNewTaskAssigneeUserId(chatId);
            createTaskFromBotDescription(desc, sprintId, assigneeId);
            stateManager.clearPendingState(chatId);
            Long signedIn = stateManager.getTelegramSignedInUserId(chatId);
            ReplyKeyboardMarkup menu = signedIn != null && isUserManager(signedIn)
                    ? buildMainMenuKeyboardMarkup()
                    : null;
            BotHelper.sendMessageToTelegram(chatId, buildNewTaskConfirmation(sprintId, assigneeId), telegramClient, menu);
            exit = true;
            return;
        }
        if (stateManager.isSessionLoginAwaitingIdentifier(chatId) || stateManager.isSessionLoginAwaitingPassword(chatId)) return;
        if (stateManager.hasPendingState(chatId)) {
            Integer taskId = stateManager.getTaskIdWaitingForHours(chatId);
            if (taskId != null) {
                try {
                    double hours = WorkedHoursUtil.parseBotInput(requestText);
                    String rangeError = WorkedHoursUtil.validateRange(hours);
                    if (rangeError != null) {
                        BotHelper.sendMessageToTelegram(chatId, rangeError, telegramClient, null);
                        exit = true;
                        return;
                    }
                    Long sprintIdWait = stateManager.getSprintIdWaitingForHours(chatId);
                    Long assigneeWait = stateManager.getActingUserIdForHours(chatId);
                    if (!saveWorkedHours(taskId, hours)) { exit = true; return; }
                    stateManager.clearPendingState(chatId);
                    BotHelper.sendMessageToTelegram(
                            chatId,
                            WorkedHoursUtil.formatForDisplay(hours) + " hours recorded! ✓",
                            telegramClient,
                            null);
                    Long sid = sprintIdWait;
                    Long aid = assigneeWait;
                    if (sid == null) {
                        ToDoItem t = todoService.getToDoItemById(taskId);
                        if (t != null && t.getAssignedSprint() != null) {
                            sid = t.getAssignedSprint().longValue();
                        }
                    }
                    if (aid == null) {
                        aid = resolveEffectiveActingUserId();
                    }
                    if (sid != null && aid != null) {
                        stateManager.setViewingSprintTasks(chatId, sid, aid);
                        showSprintTasksForAssignee(sid, aid);
                    }
                } catch (NumberFormatException e) {
                    BotHelper.sendMessageToTelegram(
                            chatId,
                            "Please enter a valid number of hours (e.g. 2 or 1.5)",
                            telegramClient,
                            null);
                }
                exit = true;
                return;
            }

            Integer blockedTaskId = stateManager.getTaskIdWaitingForBlockedReason(chatId);
            if (blockedTaskId != null) {
                String blockedReason = requestText.trim();
                if (blockedReason.isEmpty()) {
                    BotHelper.sendMessageToTelegram(chatId, "Please provide a reason for blocking the task.", telegramClient, null);
                    exit = true;
                    return;
                }
                if (blockedReason.length() > 500) {
                    BotHelper.sendMessageToTelegram(chatId, "Reason is too long (max 500 characters). Please try again.", telegramClient, null);
                    exit = true;
                    return;
                }
                Long actingUserId = stateManager.getActingUserIdForBlockedReason(chatId);
                Long sprintId = null;
                ToDoItem blockedTask = todoService.getToDoItemById(blockedTaskId);
                if (blockedTask != null && blockedTask.getAssignedSprint() != null) {
                    sprintId = blockedTask.getAssignedSprint().longValue();
                }
                saveBlockedReason(blockedTaskId, blockedReason);
                BotHelper.sendMessageToTelegram(chatId, "✓ Task marked as blocked with reason: " + blockedReason, telegramClient, null);
                stateManager.clearPendingState(chatId);
                if (actingUserId == null) {
                    actingUserId = resolveEffectiveActingUserId();
                }
                if (sprintId != null && actingUserId != null) {
                    stateManager.setViewingSprintTasks(chatId, sprintId, actingUserId);
                    showSprintTasksForAssignee(sprintId, actingUserId);
                }
                exit = true;
                return;
            }
        }
        if (stateManager.isSelectingSprint(chatId) || stateManager.isSelectingSprintForNewTask(chatId)
                || stateManager.isSelectingAssigneeForNewTask(chatId)
                || stateManager.isSelectingUserInSprint(chatId) || stateManager.isViewingSprintTasks(chatId)) {
            exit = true;
            return;
        }
        if (!stateManager.isTelegramSignedIn(chatId)) {
            if (!stateManager.isSessionLoginAwaitingIdentifier(chatId)
                    && !stateManager.isSessionLoginAwaitingPassword(chatId)) {
                beginSignInFlow();
            }
            exit = true;
            return;
        }
        exit = true;
    }

    public void fnAddItem() {
        if (exit) return;
        String text = requestText != null ? requestText.trim() : "";
        boolean addCommand = text.contains(BotCommands.ADD_ITEM.getCommand());
        boolean addLabel = text.equals(BotLabels.ADD_NEW_ITEM.getLabel());
        if (!addCommand && !addLabel) return;
        if (!stateManager.isTelegramSignedIn(chatId)) {
            BotHelper.sendMessageToTelegram(chatId, "Please sign in with /start first.", telegramClient, null);
            exit = true;
            return;
        }
        Long signedIn = stateManager.getTelegramSignedInUserId(chatId);
        if (signedIn != null && isUserManager(signedIn)) {
            sendSelectSprintForNewTaskKeyboard();
            return;
        }
        sendDeveloperCannotAddTaskMessage();
    }

    public void fnLLM() {
        if (!requestText.contains(BotCommands.LLM_REQ.getCommand()) || exit) return;
        if (!stateManager.isTelegramSignedIn(chatId)) {
            BotHelper.sendMessageToTelegram(chatId, "Please sign in with /start first.", telegramClient, null);
            exit = true;
            return;
        }
        if (deepSeekService == null) { exit = true; return; }
        try {
            String out = deepSeekService.generateText(requestText.replace(BotCommands.LLM_REQ.getCommand(), ""));
            BotHelper.sendMessageToTelegram(chatId, "🤖 AI: " + out, telegramClient);
        } catch (Exception e) {
            logger.error("LLM error: " + e.getMessage());
        }
        exit = true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private boolean saveWorkedHours(Integer taskId, double hours) {
        try {
            Long uid = stateManager.getActingUserIdForHours(chatId);
            if (uid == null) uid = Long.valueOf(telegramUserMappingService.getUserIdByChatId(chatId));
            if (uid == null) {
                uid = resolveEffectiveActingUserId();
            }
            if (uid == null) {
                BotHelper.sendMessageToTelegram(
                    chatId,
                    "Please sign in before logging hours.",
                    telegramClient,
                    null
                );
                return false;
            }
            userTaskService.saveWorkedHours(uid, (long) taskId, hours);
            logger.info("Saved {} hours for task {} by user {}", hours, taskId, uid);
            return true;
        } catch (Exception e) {
            logger.error("Error saving worked hours for task {}: {}", taskId, e.getMessage(), e);
            BotHelper.sendMessageToTelegram(chatId, "Sorry, there was an error saving your hours. Please try again.", telegramClient, null);
            return false;
        }
    }

    private void saveBlockedReason(Integer taskId, String blockedReason) {
        try {
            Long uid = stateManager.getActingUserIdForBlockedReason(chatId);
            if (uid == null) uid = Long.valueOf(telegramUserMappingService.getUserIdByChatId(chatId));
            if (uid == null) {
                uid = resolveEffectiveActingUserId();
            }
            if (uid == null) {
                BotHelper.sendMessageToTelegram(
                    chatId,
                    "Please sign in before updating this task.",
                    telegramClient,
                    null);
                return;
            }
            userTaskService.saveBlockedReason(uid, (long) taskId, blockedReason);
            logger.info("Saved blocked reason for task {} by user {}: {}", taskId, uid, blockedReason);
        } catch (Exception e) {
            logger.error("Error saving blocked reason for task {}: {}", taskId, e.getMessage(), e);
            BotHelper.sendMessageToTelegram(chatId, "Sorry, there was an error saving the blocked reason. Please try again.", telegramClient, null);
        }
    }
}