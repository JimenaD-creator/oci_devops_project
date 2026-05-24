package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.Team;
import com.springboot.MyTodoList.model.TeamMember;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.SprintRepository;
import com.springboot.MyTodoList.repository.TeamMembersRepository;
import com.springboot.MyTodoList.repository.UserSprintRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import com.springboot.MyTodoList.model.UserSprint;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.Locale;

@RestController
@RequestMapping("/api/insights")
public class DeveloperRadarController {

    private static final class DeveloperAgg {
        String name;
        String profilePicture;
        int total;
        int done;
        int onTime;
        int late;
        long worked;
        long assigned;
    }

    @Autowired
    private UserTaskRepository userTaskRepository;

    @Autowired
    private UserSprintRepository userSprintRepository;

    @Autowired
    private SprintRepository sprintRepository;

    @Autowired
    private TeamMembersRepository teamMembersRepository;

    @GetMapping("/sprint/{sprintId}/developer-radar")
    public ResponseEntity<List<Map<String, Object>>> getDeveloperRadar(@PathVariable Long sprintId) {
        List<UserTask> raw = userTaskRepository.findBySprintIdWithUserAndTask(sprintId);
        if (raw == null) raw = new ArrayList<>();

        LinkedHashMap<String, UserTask> deduped = new LinkedHashMap<>();
        for (UserTask ut : raw) {
            if (ut == null || ut.getId() == null) continue;
            String key = ut.getId().getUserId() + ":" + ut.getId().getTaskId();
            deduped.putIfAbsent(key, ut);
        }

        Map<Long, Integer> assigneeCountByTask = new HashMap<>();
        for (UserTask ut : deduped.values()) {
            if (ut.getId() == null) continue;
            Long tid = ut.getId().getTaskId();
            assigneeCountByTask.merge(tid, 1, Integer::sum);
        }

        Map<Long, DeveloperAgg> byUser = new LinkedHashMap<>();

        for (UserTask ut : deduped.values()) {
            Task t = ut.getTask();
            if (t == null) continue;
            Long uid = ut.getId().getUserId();
            User u = ut.getUser();
            DeveloperAgg a = byUser.computeIfAbsent(uid, id -> {
                DeveloperAgg x = new DeveloperAgg();
                x.name = (u != null && u.getName() != null && !u.getName().isBlank())
                    ? u.getName().trim() : ("User " + id);
                x.profilePicture = (u != null) ? u.getProfilePicture() : null;
                return x;
            });
            a.total++;
            if (isAssignmentComplete(ut)) {
                a.done++;
                int assigneeCount = assigneeCountByTask.getOrDefault(t.getId(), 1);
                Boolean onTimeFlag = evaluateAssignmentOnTime(ut, t, assigneeCount);
                if (onTimeFlag != null) {
                    if (onTimeFlag) a.onTime++;
                    else a.late++;
                }
            }
            if (ut.getWorkedHours() != null) a.worked += ut.getWorkedHours();
            if (t.getAssignedHours() != null) a.assigned += t.getAssignedHours();
        }

        List<UserSprint> roster = userSprintRepository.findBySprintIdWithUser(sprintId);
        if (roster != null) {
            for (UserSprint us : roster) {
                User u = us.getUser();
                if (u == null) continue;
                Long uid = u.getId();
                if (byUser.containsKey(uid)) continue;
                byUser.put(uid, emptyAggForUser(u, uid));
            }
        }

        addProjectTeamRoster(sprintId, byUser);

        if (byUser.isEmpty()) return ResponseEntity.ok(Collections.emptyList());

        int maxTotal     = byUser.values().stream().mapToInt(a -> a.total).max().orElse(1);
        int maxDone      = byUser.values().stream().mapToInt(a -> a.done).max().orElse(1);
        long maxWorked   = byUser.values().stream().mapToLong(a -> a.worked).max().orElse(1);

        List<Map<String, Object>> result = new ArrayList<>();
        for (DeveloperAgg a : byUser.values()) {
            double completionRatio    = a.total > 0 ? (double) a.done / a.total : 0;
            int onTimeDenominator = a.onTime + a.late;
            double onTimeRatio        = onTimeDenominator > 0 ? (double) a.onTime / onTimeDenominator : 0;
            double participationRatio = maxTotal > 0 ? (double) a.total / maxTotal : 0;
            double hoursRatio         = maxWorked > 0 ? (double) a.worked / maxWorked : 0;
            double efficiencyRatio    = (a.assigned > 0 && a.worked > 0)
                ? Math.min(1.0, (double) a.assigned / a.worked) : (a.done > 0 ? 0.5 : 0);
            double volumeRatio        = maxDone > 0 ? (double) a.done / maxDone : 0;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("developerName",   a.name);
            row.put("profilePicture",  a.profilePicture);
            row.put("completionRate",  scale(completionRatio));
            row.put("onTimeRate",      scale(onTimeRatio));
            row.put("participation",   scale(participationRatio));
            row.put("hoursLogged",     scale(hoursRatio));
            row.put("efficiency",      scale(efficiencyRatio));
            row.put("deliveryVolume",  scale(volumeRatio));
            row.put("_total",    a.total);
            row.put("_done",     a.done);
            row.put("_onTime",   a.onTime);
            row.put("_late",     a.late);
            row.put("_worked",   a.worked);
            row.put("_assigned", a.assigned);
            result.add(row);
        }

        return ResponseEntity.ok(result);
    }

    private void addProjectTeamRoster(Long sprintId, Map<Long, DeveloperAgg> byUser) {
        Optional<Sprint> sprintOpt = sprintRepository.findById(sprintId);
        if (sprintOpt.isEmpty()) {
            return;
        }
        Project project = sprintOpt.get().getAssignedProject();
        if (project == null) {
            return;
        }
        Team team = project.getAssignedTeam();
        if (team == null || team.getId() == null) {
            return;
        }
        List<TeamMember> members = teamMembersRepository.findByTeam_Id(team.getId());
        if (members != null) {
            for (TeamMember tm : members) {
                User u = tm.getUser();
                if (u == null || !isDeveloperUser(u)) {
                    continue;
                }
                Long uid = u.getId();
                if (byUser.containsKey(uid)) {
                    continue;
                }
                byUser.put(uid, emptyAggForUser(u, uid));
            }
        }
        User manager = team.getManager();
        if (manager != null && isDeveloperUser(manager)) {
            Long uid = manager.getId();
            if (!byUser.containsKey(uid)) {
                byUser.put(uid, emptyAggForUser(manager, uid));
            }
        }
    }

    private static DeveloperAgg emptyAggForUser(User u, Long uid) {
        DeveloperAgg a = new DeveloperAgg();
        a.name = (u.getName() != null && !u.getName().isBlank())
                ? u.getName().trim()
                : ("User " + uid);
        a.profilePicture = u.getProfilePicture();
        return a;
    }

    private static boolean isDeveloperUser(User user) {
        String type = user != null ? user.getType() : null;
        if (type == null) {
            return false;
        }
        return type.trim().toLowerCase(Locale.ROOT).contains("developer");
    }

    private static boolean isAssignmentComplete(UserTask ut) {
        String s = ut.getStatus();
        if (s == null) return false;
        String n = s.trim().toUpperCase();
        return "COMPLETED".equals(n) || "DONE".equals(n) || "COMPLETE".equals(n);
    }

    /**
     * Per-assignee on-time: uses USER_TASK.completedAt, not TASK.finishDate (last finisher).
     * Returns null when completion time is unknown (e.g. multi-assignee legacy rows).
     */
    private static Boolean evaluateAssignmentOnTime(UserTask ut, Task t, int assigneeCount) {
        if (t.getDueDate() == null) return null;
        LocalDateTime doneAt = ut.getCompletedAt();
        if (doneAt == null) {
            if (assigneeCount <= 1 && t.getFinishDate() != null) {
                doneAt = t.getFinishDate();
            } else {
                return null;
            }
        }
        return !doneAt.toLocalDate().isAfter(t.getDueDate().toLocalDate());
    }

    private int scale(double ratio) {
        return (int) Math.round(Math.max(1, Math.min(99, ratio * 99)));
    }
}
