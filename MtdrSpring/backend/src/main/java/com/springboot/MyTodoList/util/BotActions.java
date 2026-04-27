package com.springboot.MyTodoList.util;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.ReplyKeyboardMarkup;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.buttons.KeyboardRow;
import org.telegram.telegrambots.meta.generics.TelegramClient;

import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.ToDoItem;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.service.DeepSeekService;
import com.springboot.MyTodoList.service.SprintService;
import com.springboot.MyTodoList.service.TelegramUserMappingService;
import com.springboot.MyTodoList.service.ToDoItemService;
import com.springboot.MyTodoList.service.UserService;
import com.springboot.MyTodoList.service.UserTaskService;

public class BotActions {

    private static final Logger logger = LoggerFactory.getLogger(BotActions.class);
    private static final int TELEGRAM_BUTTON_MAX = 62;
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

    public BotActions(TelegramClient tc, ToDoItemService ts, DeepSeekService ds, 
                      BotStateManager sm, TelegramUserMappingService tums, UserTaskService uts, SprintService ss){
        telegramClient = tc;
        todoService = ts;
        deepSeekService = ds;
        stateManager = sm;
        telegramUserMappingService = tums;
        userTaskService = uts;
        sprintService = ss;
        exit  = false;
    }

    public BotActions(TelegramClient tc, ToDoItemService ts, DeepSeekService ds, 
                      BotStateManager sm, TelegramUserMappingService tums, UserTaskService uts, SprintService ss, UserService us){
        telegramClient = tc;
        todoService = ts;
        deepSeekService = ds;
        stateManager = sm;
        telegramUserMappingService = tums;
        userTaskService = uts;
        sprintService = ss;
        userService = us;
        exit  = false;
    }

    // --- Setters y Getters para compatibilidad con ToDoItemBotController ---
    public void setRequestText(String cmd) { this.requestText = cmd; }
    public void setChatId(long chId) { this.chatId = chId; }
    public void setTelegramClient(TelegramClient tc) { this.telegramClient = tc; }
    public void setTodoService(ToDoItemService tsvc) { this.todoService = tsvc; }
    public void setDeepSeekService(DeepSeekService dssvc) { this.deepSeekService = dssvc; }
    
    public ToDoItemService getTodoService() { return todoService; }
    public DeepSeekService getDeepSeekService() { return deepSeekService; }

    /**
     * Prefer the DB user chosen in Sprint → name menu; otherwise Telegram chat → user mapping (often default 1).
     */
    private Long resolveEffectiveActingUserId() {
        if (stateManager.isViewingSprintTasks(chatId)) {
            Long sel = stateManager.getViewingSelectedUserId(chatId);
            if (sel != null) {
                return sel;
            }
        }
        return Long.valueOf(telegramUserMappingService.getUserIdByChatId(chatId));
    }

    // --- Command handlers ---

    public void fnStart() {
        if (!(requestText.equals(BotCommands.START_COMMAND.getCommand()) 
            || requestText.equals(BotLabels.SHOW_MAIN_SCREEN.getLabel())) || exit) 
            return;

        BotHelper.sendMessageToTelegram(chatId, BotMessages.HELLO_MYTODO_BOT.getMessage(), telegramClient, ReplyKeyboardMarkup
            .builder()
            .keyboardRow(new KeyboardRow(BotLabels.LIST_ALL_ITEMS.getLabel()))
            .keyboardRow(new KeyboardRow(BotLabels.SHOW_MAIN_SCREEN.getLabel(), BotLabels.HIDE_MAIN_SCREEN.getLabel()))
            .resizeKeyboard(true)
            .build()
        );
        exit = true;
    }

    public void fnDone() {
        // Skip if in new task interaction states
        if (stateManager.isViewingSprintTasks(chatId) || stateManager.isSelectingTaskStatus(chatId) || exit) 
            return;
        if (!(requestText.indexOf(BotLabels.DONE.getLabel()) != -1) || exit) 
            return;
            
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
                BotHelper.sendMessageToTelegram(
                    chatId,
                    "You are not assigned to this task. You can only mark your own assignment complete.",
                    telegramClient,
                    null
                );
                exit = true;
                return;
            }
            /*
             * Do not set the whole TASK to DONE here — that would mark every assignee complete.
             * Completion is recorded only after hours are entered: USER_TASK for this user → COMPLETED,
             * then TaskAssignmentSyncService updates TASK when all assignees are done.
             */
            stateManager.setWaitingForHours(chatId, id, actingUserId);
            BotHelper.sendMessageToTelegram(
                chatId,
                "How many hours did you work on this task? (Please enter a whole number)",
                telegramClient,
                null
            );

        } catch (Exception e) {
            logger.error(e.getLocalizedMessage(), e);
        }
        exit = true;
    }

    public void fnUndo() {
        // Skip if in new task interaction states
        if (stateManager.isViewingSprintTasks(chatId) || stateManager.isSelectingTaskStatus(chatId) || exit) return;
        if (requestText.indexOf(BotLabels.UNDO.getLabel()) == -1 || exit) return;
        try {
            String idStr = requestText.substring(0, requestText.indexOf(BotLabels.DASH.getLabel()));
            int id = Integer.parseInt(idStr);
            ToDoItem item = todoService.getToDoItemById(id);
            if (item == null) {
                exit = true;
                return;
            }
            Long actingUserId = resolveEffectiveActingUserId();
            boolean reopened = userTaskService.reopenMyAssignment(actingUserId, (long) id);
            if (!reopened) {
                /* Legacy tasks without USER_TASK rows: revert the whole task row */
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
        // Skip if in new task interaction states
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

    /** Keyboard label: title, else description, else id fallback. */
    private static String toUserPickerButton(User u) {
        String base = (u.getName() != null && !u.getName().isBlank()) ? u.getName().trim() : ("User " + u.getId());
        String suffix = " #" + u.getId();
        String prefix = "👤 ";
        int maxBase = TELEGRAM_BUTTON_MAX - prefix.length() - suffix.length();
        if (maxBase < 4) {
            maxBase = 4;
        }
        if (base.length() > maxBase) {
            base = base.substring(0, maxBase - 1) + "…";
        }
        return prefix + base + suffix;
    }

    private static Long parseUserPickerSelection(String text) {
        if (text == null) {
            return null;
        }
        Matcher m = USER_PICKER_ID.matcher(text.trim());
        if (!m.matches()) {
            return null;
        }
        return Long.parseLong(m.group(1));
    }

    /** Sprint list keyboard (shared by / list command and “back to sprints”). */
    private void sendSelectSprintKeyboard(String optionalNotice) {
        stateManager.setSelectingSprint(chatId);
        List<Sprint> allSprints = sprintService.findAll();
        List<KeyboardRow> keyboard = new ArrayList<>();
        keyboard.add(new KeyboardRow(BotLabels.SHOW_MAIN_SCREEN.getLabel()));
        for (Sprint sprint : allSprints) {
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

    private static String keyboardLabelForItem(ToDoItem item) {
        if (item.getTitle() != null && !item.getTitle().trim().isEmpty()) {
            return item.getTitle().trim();
        }
        if (item.getDescription() != null && !item.getDescription().isEmpty()) {
            return item.getDescription();
        }
        return "Task #" + item.getID();
    }

    public void fnListAll(){
        if (!(requestText.equals(BotCommands.TODO_LIST.getCommand())
                || requestText.equals(BotLabels.LIST_ALL_ITEMS.getLabel())
                || requestText.equals(BotLabels.MY_TODO_LIST.getLabel())) || exit)
            return;

        sendSelectSprintKeyboard(null);
        exit = true;
    }

    public void fnSelectSprint() {
        if (!stateManager.isSelectingSprint(chatId) || exit) return;

        if (requestText.startsWith("Sprint ")) {
            try {
                String sprintIdStr = requestText.substring(7); // Remove "Sprint "
                Long sprintId = Long.parseLong(sprintIdStr);

                stateManager.setSelectingUserInSprint(chatId, sprintId);
                showUserPickerForSprint(sprintId);
                exit = true;
            } catch (NumberFormatException e) {
                BotHelper.sendMessageToTelegram(chatId, "Invalid sprint selection. Please try again.", telegramClient);
                exit = true;
            }
        }
    }

    /**
     * After choosing a sprint: list assignees who have USER_TASK rows on tasks in that sprint.
     */
    private void showUserPickerForSprint(Long sprintId) {
        List<User> users = userTaskService.findDistinctAssigneesBySprintId(sprintId);
        List<KeyboardRow> keyboard = new ArrayList<>();
        keyboard.add(new KeyboardRow("⬅️ Back to Sprints"));
        if (users.isEmpty()) {
            sendSelectSprintKeyboard("ℹ️ This sprint has no tasks with assigned users (USER_TASK). Assign team members from the web app.");
            return;
        }
        for (User u : users) {
            keyboard.add(new KeyboardRow(toUserPickerButton(u)));
        }
        ReplyKeyboardMarkup keyboardMarkup = ReplyKeyboardMarkup.builder()
                .keyboard(keyboard)
                .resizeKeyboard(true)
                .selective(true)
                .build();
        BotHelper.sendMessageToTelegram(
                chatId,
                "👥 *Sprint " + sprintId + "* — pick your name to see **only your** assigned tasks:",
                telegramClient,
                keyboardMarkup
        );
    }

    public void fnSelectUserInSprint() {
        if (!stateManager.isSelectingUserInSprint(chatId) || exit) {
            return;
        }
        if ("⬅️ Back to Sprints".equals(requestText)) {
            sendSelectSprintKeyboard(null);
            exit = true;
            return;
        }
        Long picked = parseUserPickerSelection(requestText);
        if (picked == null) {
            exit = true;
            return;
        }
        Long sprintId = stateManager.getSprintIdInSprintUserFlow(chatId);
        if (sprintId == null) {
            sendSelectSprintKeyboard(null);
            exit = true;
            return;
        }
        
        // Instead of directly showing sprint tasks, ask for credential verification
        stateManager.setVerifyingCredentialsPhoneEmail(chatId, picked, sprintId);
        BotHelper.sendMessageToTelegram(
                chatId,
                "🔐 Before accessing tasks, please verify your identity.\n\nPlease enter your phone number or email:",
                telegramClient,
                null
        );
        exit = true;
    }

    private void showSprintTasksForAssignee(Long sprintId, Long assigneeUserId) {
        List<ToDoItem> sprintItems = todoService.findByAssignedSprint(Math.toIntExact(sprintId));
        UserTaskService.UserSprintTaskListIndex sprintIdx =
                userTaskService.loadUserSprintTaskListIndex(assigneeUserId, sprintId);
        Set<Long> allowedTaskIds = sprintIdx.assignedTaskIds;
        Set<Long> myCompletedTaskIds = sprintIdx.myCompletedAssignmentTaskIds;
        List<ToDoItem> mine = sprintItems.stream()
                .filter(item -> allowedTaskIds.contains((long) item.getID()))
                .collect(Collectors.toList());

        List<KeyboardRow> keyboard = new ArrayList<>();
        keyboard.add(new KeyboardRow("⬅️ Back to users"));
        keyboard.add(new KeyboardRow("⬅️ Back to Sprints"));

        List<ToDoItem> activeItems = mine.stream()
                .filter(item -> !item.isDone() && !myCompletedTaskIds.contains((long) item.getID()))
                .collect(Collectors.toList());
        for (ToDoItem item : activeItems) {
            KeyboardRow currentRow = new KeyboardRow();
            String taskLabel = keyboardLabelForItem(item);
            if (item.getStatus() != null) {
                taskLabel += " [" + item.getStatus() + "]";
            }
            // Include task ID at the beginning for parsing
            String buttonText = item.getID() + " - " + taskLabel;
            currentRow.add(buttonText);
            keyboard.add(currentRow);
        }

        List<ToDoItem> doneItems = mine.stream()
                .filter(item -> item.isDone() || myCompletedTaskIds.contains((long) item.getID()))
                .collect(Collectors.toList());
        for (ToDoItem item : doneItems) {
            KeyboardRow currentRow = new KeyboardRow();
            String taskLabel = keyboardLabelForItem(item);
            if (item.getStatus() != null) {
                taskLabel += " [" + item.getStatus() + "]";
            }
            // Include task ID at the beginning for parsing
            String buttonText = item.getID() + " - " + taskLabel;
            currentRow.add(buttonText);
            keyboard.add(currentRow);
        }

        ReplyKeyboardMarkup keyboardMarkup = ReplyKeyboardMarkup.builder()
                .keyboard(keyboard)
                .resizeKeyboard(true)
                .selective(true)
                .build();

        String message = mine.isEmpty()
                ? "📋 *You have no assigned tasks in Sprint " + sprintId + "*\n\n⬅️ Go back to users or sprints."
                : "📋 *Your tasks (Sprint " + sprintId + "):*\n\nClick on a task to view details and change status.";

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
        if ("⬅️ Back to users".equals(requestText)) {
            Long sprintId = stateManager.getViewingSprintId(chatId);
            if (sprintId != null) {
                stateManager.setSelectingUserInSprint(chatId, sprintId);
                showUserPickerForSprint(sprintId);
            } else {
                sendSelectSprintKeyboard(null);
            }
            exit = true;
            return;
        }
        
        // User clicked on a task - show task details and status options
        Long sprintId = stateManager.getViewingSprintId(chatId);
        Long assigneeUserId = stateManager.getViewingSelectedUserId(chatId);
        
        if (sprintId == null || assigneeUserId == null) {
            logger.debug("Missing sprintId or assigneeUserId, returning to sprint selection");
            sendSelectSprintKeyboard(null);
            exit = true;
            return;
        }
        
        // Try to find the task - extract ID from the label
        Integer taskId = extractTaskIdFromLabel(requestText);
        logger.debug("Extracted taskId: {} from text: {}", taskId, requestText);
        
        if (taskId == null) {
            logger.debug("Could not extract task ID from: {}", requestText);
            exit = true;
            return;
        }
        
        // Show task details with status options
        ToDoItem task = todoService.getToDoItemById(taskId);
        if (task == null) {
            BotHelper.sendMessageToTelegram(chatId, "Task not found.", telegramClient, null);
            exit = true;
            return;
        }
        
        showTaskDetailsWithStatusOptions(task, sprintId, assigneeUserId);
        exit = true;
    }
    
    /**
     * Extract task ID from task label (format: "ID - Title [Status]")
     */
    private Integer extractTaskIdFromLabel(String label) {
        if (label == null || label.isEmpty()) {
            return null;
        }
        try {
            // Parse ID from the beginning: "123 - Task Title [Status]"
            int dashIndex = label.indexOf(" - ");
            if (dashIndex > 0) {
                String idStr = label.substring(0, dashIndex).trim();
                int id = Integer.parseInt(idStr);
                logger.debug("Successfully extracted task ID {} from label: {}", id, label);
                return id;
            }
            // Fallback: try to parse the whole string as an ID
            int id = Integer.parseInt(label.trim());
            logger.debug("Parsed whole string as task ID {} from label: {}", id, label);
            return id;
        } catch (Exception e) {
            logger.debug("Could not extract task ID from label: {}", label, e);
            return null;
        }
    }
    
    /**
     * Show task details with status selection buttons
     */
    private void showTaskDetailsWithStatusOptions(ToDoItem task, Long sprintId, Long assigneeUserId) {
        List<KeyboardRow> keyboard = new ArrayList<>();
        
        // Status buttons
        KeyboardRow statusRow1 = new KeyboardRow();
        statusRow1.add("📝 To-do");
        statusRow1.add("🔄 In Process");
        keyboard.add(statusRow1);
        
        KeyboardRow statusRow2 = new KeyboardRow();
        statusRow2.add("👀 In Review");
        statusRow2.add("✅ Done");
        keyboard.add(statusRow2);
        
        // Navigation buttons
        keyboard.add(new KeyboardRow("⬅️ Back to tasks"));
        
        ReplyKeyboardMarkup keyboardMarkup = ReplyKeyboardMarkup.builder()
                .keyboard(keyboard)
                .resizeKeyboard(true)
                .selective(true)
                .build();
        
        String taskStatus = task.getStatus() != null ? task.getStatus() : "No status set";
        String taskDescription = task.getDescription() != null && !task.getDescription().isEmpty() 
                ? task.getDescription() 
                : "No description provided";
        
        String message = String.format(
                "📋 *Task Details*\n\n" +
                "*Title:* %s\n\n" +
                "*Description:* %s\n\n" +
                "*Current Status:* %s\n\n" +
                "Select a new status:",
                escapeMarkdown(task.getTitle()),
                escapeMarkdown(taskDescription),
                taskStatus
        );
        
        // Store task selection state
        stateManager.setSelectingTaskStatus(chatId, task.getID(), sprintId, assigneeUserId);
        
        BotHelper.sendMessageToTelegram(chatId, message, telegramClient, keyboardMarkup);
    }
    
    /**
     * Escape special characters for Telegram Markdown
     */
    private String escapeMarkdown(String text) {
        if (text == null) return "";
        return text.replace("_", "\\_")
                   .replace("*", "\\*")
                   .replace("[", "\\[")
                   .replace("]", "\\]");
    }

    /**
     * Handle credential verification step 1: phone/email input
     */
    public void fnVerifyCredentialsPhoneEmail() {
        if (!stateManager.isVerifyingCredentialsPhoneEmail(chatId) || exit) {
            return;
        }
        
        String phoneEmail = requestText.trim();
        if (phoneEmail.isEmpty()) {
            BotHelper.sendMessageToTelegram(
                    chatId,
                    "Please enter a valid phone number or email.",
                    telegramClient,
                    null
            );
            exit = true;
            return;
        }
        
        Long userId = stateManager.getCredentialVerificationUserId(chatId);
        Long sprintId = stateManager.getSprintIdInSprintUserFlow(chatId);
        
        if (userId == null || sprintId == null) {
            sendSelectSprintKeyboard(null);
            exit = true;
            return;
        }
        
        // Move to password verification state
        stateManager.setVerifyingCredentialsPassword(chatId, userId, sprintId, phoneEmail);
        BotHelper.sendMessageToTelegram(
                chatId,
                "Now please enter your password:",
                telegramClient,
                null
        );
        exit = true;
    }

    /**
     * Handle credential verification step 2: password input and verification
     */
    public void fnVerifyCredentialsPassword() {
        if (!stateManager.isVerifyingCredentialsPassword(chatId) || exit) {
            return;
        }
        
        String password = requestText.trim();
        if (password.isEmpty()) {
            BotHelper.sendMessageToTelegram(
                    chatId,
                    "Password cannot be empty. Please try again.",
                    telegramClient,
                    null
            );
            exit = true;
            return;
        }
        
        Long userId = stateManager.getCredentialVerificationUserId(chatId);
        String phoneEmail = stateManager.getStoredPhoneEmailForVerification(chatId);
        Long sprintId = stateManager.getSprintIdInSprintUserFlow(chatId);
        
        if (userId == null || phoneEmail == null || sprintId == null) {
            sendSelectSprintKeyboard(null);
            exit = true;
            return;
        }
        
        // Verify credentials against database
        boolean credentialsValid = false;
        if (userService != null) {
            credentialsValid = userService.verifyUserCredentials(userId, phoneEmail, password);
        }
        
        if (credentialsValid) {
            // Credentials verified! Now show the sprint tasks
            stateManager.setViewingSprintTasks(chatId, sprintId, userId);
            BotHelper.sendMessageToTelegram(
                    chatId,
                    "✅ Identity verified! Loading your tasks...",
                    telegramClient,
                    null
            );
            showSprintTasksForAssignee(sprintId, userId);
        } else {
            // Credentials invalid - ask them to try again
            BotHelper.sendMessageToTelegram(
                    chatId,
                    "❌ Invalid credentials. Please try again.\n\nEnter your phone number or email:",
                    telegramClient,
                    null
            );
            stateManager.setVerifyingCredentialsPhoneEmail(chatId, userId, sprintId);
        }
        exit = true;
    }

    /**
     * Handle task status selection
     */
    public void fnSelectTaskStatus() {
        logger.debug("fnSelectTaskStatus: Called for chatId={}, requestText='{}'", chatId, requestText);
        if (!stateManager.isSelectingTaskStatus(chatId) || exit) {
            logger.debug("fnSelectTaskStatus: Not in selecting task status state or exit=true, returning");
            return;
        }
        
        logger.debug("fnSelectTaskStatus: Processing requestText: '{}'", requestText);
        
        if ("⬅️ Back to tasks".equals(requestText)) {
            logger.debug("fnSelectTaskStatus: Back to tasks clicked");
            Long sprintId = stateManager.getViewingSprintId(chatId);
            Long assigneeUserId = stateManager.getViewingSelectedUserId(chatId);
            if (sprintId != null && assigneeUserId != null) {
                stateManager.setViewingSprintTasks(chatId, sprintId, assigneeUserId);
                showSprintTasksForAssignee(sprintId, assigneeUserId);
            } else {
                sendSelectSprintKeyboard(null);
            }
            exit = true;
            return;
        }
        
        // Map emoji buttons to status values
        String newStatus = null;
        if ("📝 To-do".equals(requestText)) {
            newStatus = "TODO";
        } else if ("🔄 In Process".equals(requestText)) {
            newStatus = "IN_PROGRESS";
        } else if ("👀 In Review".equals(requestText)) {
            newStatus = "IN_REVIEW";
        } else if ("✅ Done".equals(requestText)) {
            newStatus = "DONE";
        } else {
            logger.debug("fnSelectTaskStatus: Unrecognized status button: '{}'", requestText);
            exit = true;
            return;
        }
        
        logger.debug("fnSelectTaskStatus: Mapped '{}' to status '{}'", requestText, newStatus);
        
        Integer taskId = stateManager.getSelectedTaskId(chatId);
        if (taskId == null) {
            logger.debug("fnSelectTaskStatus: No taskId found in state");
            BotHelper.sendMessageToTelegram(chatId, "Task not found.", telegramClient, null);
            exit = true;
            return;
        }
        
        logger.debug("fnSelectTaskStatus: Updating task {} to status {}", taskId, newStatus);
        
        ToDoItem task = todoService.getToDoItemById(taskId);
        if (task == null) {
            BotHelper.sendMessageToTelegram(chatId, "Task not found.", telegramClient, null);
            exit = true;
            return;
        }
        
        // If status is "Done", ask for hours worked
        if ("DONE".equals(newStatus)) {
            logger.debug("fnSelectTaskStatus: Status is DONE, asking for hours");
            Long actingUserId = stateManager.getViewingSelectedUserId(chatId);
            stateManager.setWaitingForHours(chatId, taskId, actingUserId);
            BotHelper.sendMessageToTelegram(
                    chatId,
                    "How many hours did you work on this task? (Please enter a whole number)",
                    telegramClient,
                    null
            );
        } else {
            // For other statuses, just update and return to task list
            logger.debug("fnSelectTaskStatus: Updating status for non-DONE task");
            boolean updated = todoService.updateTaskStatusOnly(taskId, newStatus);

            if (!updated) {
                BotHelper.sendMessageToTelegram(chatId, "Task not found.", telegramClient, null);
                exit = true;
                return;
            }
            
            logger.debug("fnSelectTaskStatus: Sending confirmation message");
            BotHelper.sendMessageToTelegram(
                    chatId,
                    "✓ Task status updated to: " + newStatus,
                    telegramClient,
                    null
            );
            
            logger.debug("fnSelectTaskStatus: Returning to task list");
            Long sprintId = stateManager.getViewingSprintId(chatId);
            Long assigneeUserId = stateManager.getViewingSelectedUserId(chatId);
            if (sprintId != null && assigneeUserId != null) {
                stateManager.setViewingSprintTasks(chatId, sprintId, assigneeUserId);
                showSprintTasksForAssignee(sprintId, assigneeUserId);
            }
        }
        exit = true;
    }

    public void fnHide() {
        if (!(requestText.equals(BotCommands.HIDE_COMMAND.getCommand())
            || requestText.equals(BotLabels.HIDE_MAIN_SCREEN.getLabel())) || exit) {
            return;
        }
        BotHelper.sendMessageToTelegram(chatId, BotMessages.BYE.getMessage(), telegramClient);
        exit = true;
    }

    /**
     * Free text after other handlers: hours entry after marking a task done, or new task description.
     */
    public void fnElse() {
        if (exit) {
            return;
        }
        if (stateManager.hasPendingState(chatId)) {
            Integer taskId = stateManager.getTaskIdWaitingForHours(chatId);
            if (taskId != null) {
                try {
                    Integer hours = Integer.parseInt(requestText.trim());
                    if (hours < 1) {
                        BotHelper.sendMessageToTelegram(
                            chatId,
                            "Hours must be at least 1. Please try again.",
                            telegramClient,
                            null
                        );
                        exit = true;
                        return;
                    }
                    if (hours > 100) {
                        BotHelper.sendMessageToTelegram(
                            chatId,
                            "Please enter a reasonable number of hours (max 100).",
                            telegramClient,
                            null
                        );
                        exit = true;
                        return;
                    }
                    saveWorkedHours(taskId, hours);
                    BotHelper.sendMessageToTelegram(
                        chatId,
                        hours + " hours recorded! ✓",
                        telegramClient,
                        null
                    );
                    stateManager.clearPendingState(chatId);
                } catch (NumberFormatException e) {
                    BotHelper.sendMessageToTelegram(
                        chatId,
                        "Please enter a valid whole number (e.g., 2 or 5)",
                        telegramClient,
                        null
                    );
                }
                exit = true;
                return;
            }
        }
        if (stateManager.isSelectingSprint(chatId) || stateManager.isSelectingUserInSprint(chatId) || stateManager.isViewingSprintTasks(chatId)) {
            exit = true;
            return;
        }
        ToDoItem newItem = new ToDoItem();
        newItem.setDescription(requestText);
        newItem.setCreation_ts(OffsetDateTime.now());
        newItem.setDone(false);
        todoService.addToDoItem(newItem);
        BotHelper.sendMessageToTelegram(chatId, BotMessages.NEW_ITEM_ADDED.getMessage(), telegramClient, null);
        exit = true;
    }

    public void fnAddItem() {
        // Block task creation from the bot
        if (!(requestText.contains(BotCommands.ADD_ITEM.getCommand()) 
            || requestText.contains(BotLabels.ADD_NEW_ITEM.getLabel())) || exit)
            return;
        
        BotHelper.sendMessageToTelegram(chatId, "🚫 You can only create tasks from the web app.", telegramClient);
        exit = true;
    }

    public void fnLLM() {
        if (!requestText.contains(BotCommands.LLM_REQ.getCommand()) || exit) return;
        try {
            String out = deepSeekService.generateText(requestText.replace(BotCommands.LLM_REQ.getCommand(), ""));
            BotHelper.sendMessageToTelegram(chatId, "🤖 AI: " + out, telegramClient);
        } catch (Exception e) {
            logger.error("LLM error: " + e.getMessage());
        }
        exit = true;
    }

    /**
     * Save worked hours for a task (Telegram): updates only this user's USER_TASK, then syncs TASK status.
     */
    private void saveWorkedHours(Integer taskId, Integer hours) {
        try {
            Long uid = stateManager.getActingUserIdForHours(chatId);
            if (uid == null) {
                uid = Long.valueOf(telegramUserMappingService.getUserIdByChatId(chatId));
            }
            userTaskService.saveWorkedHours(uid, (long) taskId, hours);
            logger.info("Saved {} hours for task {} by user {}", hours, taskId, uid);
        } catch (Exception e) {
            logger.error("Error saving worked hours for task {}: {}", taskId, e.getMessage(), e);
            BotHelper.sendMessageToTelegram(
                chatId,
                "Sorry, there was an error saving your hours. Please try again.",
                telegramClient,
                null
            );
        }
    }
}