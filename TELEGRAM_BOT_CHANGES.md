# Telegram Bot Sprint-Based Task Listing Implementation

## Overview
This document explains the changes made to implement a sprint-based task listing feature in the Telegram bot. Previously, the "List All Items" command displayed all tasks from every sprint, which could be overwhelming. Now, it first shows available sprints, allowing users to select a specific sprint and view only its tasks.

## Changes Made

### 1. Database Layer Changes

#### ToDoItemRepository.java
- **Added method**: `findByAssignedSprint(Integer assignedSprint)`
- **Purpose**: Enables filtering tasks by their assigned sprint ID

#### ToDoItemService.java
- **Added method**: `findByAssignedSprint(Integer assignedSprint)`
- **Purpose**: Service layer wrapper for the repository method

### 2. New Service Creation

#### SprintService.java (New File)
- **Location**: `src/main/java/com/springboot/MyTodoList/service/SprintService.java`
- **Methods**:
  - `findAll()`: Retrieves all sprints
  - `findById(Long id)`: Retrieves a specific sprint by ID
- **Purpose**: Provides access to sprint data for the bot

### 3. Bot State Management Enhancements

#### BotUserState.java
- **Added field**: `sprintId` (Long)
- **Updated constructor**: Now accepts sprintId parameter
- **Added getters/setters**: For the new sprintId field
- **Purpose**: Track which sprint the user is currently viewing

#### BotStateManager.java
- **New states**:
  - `SELECTING_SPRINT`: User is choosing from available sprints
  - `VIEWING_SPRINT_TASKS`: User is viewing tasks for a specific sprint
- **New methods**:
  - `setSelectingSprint(Long chatId)`: Sets user to sprint selection mode
  - `setViewingSprintTasks(Long chatId, Long sprintId)`: Sets user to view specific sprint tasks
  - `isSelectingSprint(Long chatId)`: Checks if user is selecting sprint
  - `isViewingSprintTasks(Long chatId)`: Checks if user is viewing sprint tasks
  - `getViewingSprintId(Long chatId)`: Gets the sprint ID being viewed

### 4. Bot Logic Updates

#### BotActions.java
- **Modified `fnListAll()`**: Now shows sprints instead of all tasks
- **Added `fnSelectSprint()`**: Handles sprint selection from the list
- **Added `showSprintTasks(Long sprintId)`**: Displays tasks for a specific sprint
- **Added `fnViewSprintTasks()`**: Handles the back button functionality
- **Updated constructor**: Now accepts SprintService parameter

### 5. Controller Updates

#### ToDoItemBotController.java
- **Added SprintService injection**: Constructor now includes SprintService
- **Added method calls**: `fnSelectSprint()` and `fnViewSprintTasks()` in the message processing chain

## User Flow

### Before Changes:
1. User types "/start" → Shows menu
2. User selects "List All Items" → Shows ALL tasks from ALL sprints
3. Tasks displayed: Pending and completed from every sprint

### After Changes:
1. User types "/start" → Shows menu
2. User selects "List All Items" → Shows list of available sprints (e.g., "Sprint 1", "Sprint 2")
3. User selects "Sprint X" → Shows only tasks for Sprint X
4. Tasks displayed: Pending and completed for that specific sprint
5. "⬅️ Back to Sprints" button allows returning to sprint selection
6. Task interactions (Done/Undo/Delete) work as before within the sprint view

## Technical Details

### State Management
The bot uses a state machine to track user context:
- **Default**: Normal operation
- **WAITING_FOR_HOURS**: After marking task as done, waiting for hours input
- **SELECTING_SPRINT**: User is choosing a sprint
- **VIEWING_SPRINT_TASKS**: User is viewing tasks for a specific sprint

### Database Relationships
- Tasks are linked to sprints via `assigned_sprint` field
- Sprints are linked to projects via `assigned_project` field
- The bot now leverages these relationships for filtered display

### Error Handling
- Invalid sprint selections are handled gracefully
- State timeouts prevent stuck states (30-minute timeout)
- Database errors are logged appropriately

## Benefits

1. **Improved UX**: Users can focus on one sprint at a time
2. **Reduced Clutter**: No more overwhelming lists of tasks from all sprints
3. **Better Organization**: Tasks are logically grouped by sprint
4. **Easy Navigation**: Back button allows quick switching between sprints
5. **Maintained Functionality**: All existing task operations still work

## Files Modified
- `ToDoItemRepository.java`
- `ToDoItemService.java`
- `SprintService.java` (new)
- `BotUserState.java`
- `BotStateManager.java`
- `BotActions.java`
- `ToDoItemBotController.java`

## Files Created
- `SprintService.java`

This implementation maintains backward compatibility while significantly improving the user experience for task management in the Telegram bot.