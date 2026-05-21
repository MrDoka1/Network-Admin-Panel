package ru.krizhanovskiy.admin.panel.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.krizhanovskiy.admin.panel.backend.domain.ReconfigurationTaskStatus;
import ru.krizhanovskiy.admin.panel.backend.repository.ReconfigurationTaskStatusRepository;

import ru.krizhanovskiy.admin.panel.backend.domain.enums.ReconfigurationTaskExecutionStatus;

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReconfigurationTaskStatusService {

    private final ReconfigurationTaskStatusRepository reconfigurationTaskStatusRepository;

    @Transactional(readOnly = true)
    public Map<UUID, TaskExecutionStatusBundle> loadLatestByTaskIds(Collection<UUID> taskIds) {
        if (taskIds == null || taskIds.isEmpty()) {
            return Map.of();
        }
        List<ReconfigurationTaskStatus> rows =
                reconfigurationTaskStatusRepository.findLatestByTaskIdIn(taskIds);
        Map<UUID, TaskExecutionStatusBundle> result = new HashMap<>();
        for (ReconfigurationTaskStatus row : rows) {
            TaskExecutionStatusBundle bundle =
                    result.computeIfAbsent(row.getTaskId(), id -> new TaskExecutionStatusBundle());
            if (row.getBatchId() == null) {
                bundle.setTaskStatus(row);
            } else {
                bundle.batchStatuses().put(row.getBatchId(), row);
            }
        }
        return result;
    }

    @Transactional
    public ReconfigurationTaskStatus recordTaskLevelStatus(
            UUID taskId,
            ReconfigurationTaskExecutionStatus status,
            String updatedBy,
            String statusReason) {
        ReconfigurationTaskStatus row = new ReconfigurationTaskStatus();
        row.setTaskId(taskId);
        row.setBatchId(null);
        row.setStatus(status);
        row.setUpdatedAt(Instant.now());
        row.setUpdatedBy(updatedBy);
        row.setStatusReason(statusReason);
        return reconfigurationTaskStatusRepository.save(row);
    }

    public static final class TaskExecutionStatusBundle {
        private ReconfigurationTaskStatus taskStatus;
        private final Map<UUID, ReconfigurationTaskStatus> batchStatuses = new HashMap<>();

        public ReconfigurationTaskStatus taskStatus() {
            return taskStatus;
        }

        public void setTaskStatus(ReconfigurationTaskStatus taskStatus) {
            this.taskStatus = taskStatus;
        }

        public Map<UUID, ReconfigurationTaskStatus> batchStatuses() {
            return batchStatuses;
        }
    }
}
