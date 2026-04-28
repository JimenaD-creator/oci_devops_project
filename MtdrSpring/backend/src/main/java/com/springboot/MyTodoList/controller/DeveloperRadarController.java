package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.UserSprintRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import com.springboot.MyTodoList.model.UserSprint;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/insights")
public class DeveloperRadarController {

    @Autowired
    private UserTaskRepository userTaskRepository;

    @Autowired
    private UserSprintRepository userSprintRepository;

    @GetMapping("/sprint/{sprintId}/developer-radar")
    public ResponseEntity<List<Map<String, Object>>> getDeveloperRadar(@PathVariable Long sprintId) {
        List<UserTask> raw = userTaskRepository.findBySprintIdWithUserAndTask(sprintId);
        if (raw == null) raw = new ArrayList<>();

        // Deduplicate
        LinkedHashMap<String, UserTask> deduped = new LinkedHashMap<>();
        for (UserTask ut : raw) {
            if (ut == null || ut.getId() == null) continue;
            String key = ut.getId().getUserId() + ":" + ut.getId().getTaskId();
            deduped.putIfAbsent(key, ut);
        }

        // Aggregate per user
        class Agg {
            String name;
            String profilePicture;
            int total, done, onTime, late;
            long worked, assigned;
        }

        Map<Long, Agg> byUser = new LinkedHashMap<>();

        for (UserTask ut : deduped.values()) {
            Task t = ut.getTask();
            if (t == null) continue;
            Long uid = ut.getId().getUserId();
            User u = ut.getUser();
            Agg a = byUser.computeIfAbsent(uid, id -> {
                Agg x = new Agg();
                x.name = (u != null && u.getName() != null && !u.getName().isBlank())
                    ? u.getName().trim() : ("User " + id);
                x.profilePicture = (u != null) ? u.getProfilePicture() : null;
                return x;
            });
            a.total++;
            String st = t.getStatus() != null ? t.getStatus().trim().toUpperCase() : "";
            if ("DONE".equals(st) || "COMPLETED".equals(st) || "FINISHED".equals(st)) {
                a.done++;
                boolean onTimeFlag = t.getFinishDate() != null && t.getDueDate() != null
                    && !t.getFinishDate().isAfter(t.getDueDate());
                if (onTimeFlag) a.onTime++; else a.late++;
            }
            if (ut.getWorkedHours() != null) a.worked += ut.getWorkedHours();
            if (t.getAssignedHours() != null) a.assigned += t.getAssignedHours();
        }

        // Roster-only members
        List<UserSprint> roster = userSprintRepository.findBySprintIdWithUser(sprintId);
        if (roster != null) {
            for (UserSprint us : roster) {
                User u = us.getUser();
                if (u == null) continue;
                Long uid = u.getId();
                if (byUser.containsKey(uid)) continue;
                Agg a = new Agg();
                a.name = (u.getName() != null && !u.getName().isBlank())
                    ? u.getName().trim() : ("User " + uid);
                a.profilePicture = u.getProfilePicture();
                byUser.put(uid, a);
            }
        }

        if (byUser.isEmpty()) return ResponseEntity.ok(Collections.emptyList());

        // Normalization maxes
        int maxTotal     = byUser.values().stream().mapToInt(a -> a.total).max().orElse(1);
        int maxDone      = byUser.values().stream().mapToInt(a -> a.done).max().orElse(1);
        long maxWorked   = byUser.values().stream().mapToLong(a -> a.worked).max().orElse(1);

        List<Map<String, Object>> result = new ArrayList<>();
        for (Agg a : byUser.values()) {
            double completionRatio    = a.total > 0 ? (double) a.done / a.total : 0;
            double onTimeRatio        = a.done  > 0 ? (double) a.onTime / a.done : 0;
            double participationRatio = maxTotal > 0 ? (double) a.total / maxTotal : 0;
            double hoursRatio         = maxWorked > 0 ? (double) a.worked / maxWorked : 0;
            double efficiencyRatio    = (a.assigned > 0 && a.worked > 0)
                ? Math.min(1.0, (double) a.assigned / a.worked) : (a.done > 0 ? 0.5 : 0);
            double volumeRatio        = maxDone > 0 ? (double) a.done / maxDone : 0;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("developerName",   a.name);
            row.put("profilePicture",  a.profilePicture);  // null si no tiene foto
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

    private int scale(double ratio) {
        return (int) Math.round(Math.max(1, Math.min(99, ratio * 99)));
    }
}