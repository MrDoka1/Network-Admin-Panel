package ru.krizhanovskiy.admin.panel.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationTaskCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationTaskResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationTaskStatusHistoryEntry;
import ru.krizhanovskiy.admin.panel.backend.domain.ReconfigurationTaskStatus;
import ru.krizhanovskiy.admin.panel.backend.domain.User;
import ru.krizhanovskiy.admin.panel.backend.kafka.KafkaReconfigAdapter;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ReconfigurationBatch;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ReconfigurationEntityStatus;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ReconfigurationTask;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.ReconfigurationTaskExecutionStatus;
import ru.krizhanovskiy.admin.panel.backend.mapper.ReconfigurationTaskMapper;
import ru.krizhanovskiy.admin.panel.backend.service.ReconfigurationTaskStatusService.TaskExecutionStatusBundle;
import ru.krizhanovskiy.admin.panel.backend.web.error.ConflictException;
import ru.krizhanovskiy.admin.panel.backend.web.error.NotFoundException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletionException;

@Service
@RequiredArgsConstructor
public class ReconfigurationTaskService {

    @Value("${app.instance-id:admin-panel}")
    private String applicationInstanceId;

    private final KafkaReconfigAdapter kafkaReconfigAdapter;
    private final ReconfigurationTaskMapper reconfigurationTaskMapper;
    private final ReconfigurationTaskStatusService reconfigurationTaskStatusService;
    private final UserAuthService userAuthService;

    public List<ReconfigurationTaskResponse> listSnapshot(Duration maxTotalWait, int maxRecords) {
        List<ReconfigurationTask> tasks = latestKafkaTasksById(
                kafkaReconfigAdapter.readTopicSnapshot(maxTotalWait, maxRecords));
        List<UUID> taskIds = tasks.stream().map(ReconfigurationTask::id).toList();
        Map<UUID, ReconfigurationTaskStatusService.TaskExecutionStatusBundle> statusByTaskId =
                reconfigurationTaskStatusService.loadLatestByTaskIds(taskIds);
        return tasks.stream()
                .map(task -> reconfigurationTaskMapper.toResponse(task, statusByTaskId))
                .toList();
    }

    public ReconfigurationTaskResponse publish(ReconfigurationTaskCreateRequest request) {
        List<ReconfigurationBatch> kafkaBatches =
                request.batches().stream().map(reconfigurationTaskMapper::toKafkaBatch).toList();

        UUID id = request.id() != null ? request.id() : UUID.randomUUID();
        Instant createdAt = request.createdAt() != null ? request.createdAt() : Instant.now();
        ReconfigurationEntityStatus status =
                request.status() != null ? request.status() : ReconfigurationEntityStatus.PENDING;
        String initiatedBy = resolveInitiatedBy();

        ReconfigurationTask task = new ReconfigurationTask(id, initiatedBy, createdAt, status, kafkaBatches);
        try {
            kafkaReconfigAdapter.send(task).join();
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Не удалось сериализовать задачу: " + ex.getOriginalMessage(), ex);
        } catch (CompletionException ex) {
            Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
            throw new IllegalStateException("Не удалось отправить задачу в Kafka: " + cause.getMessage(), cause);
        }
        return taskResponseAfterStatusChange(task);
    }

    public ReconfigurationTaskResponse cancel(UUID taskId) {
        ReconfigurationTask task = requireTaskFromKafka(taskId);
        TaskExecutionStatusBundle bundle = loadStatusBundle(task.id());
        if (!reconfigurationTaskMapper.isTaskCancellable(task, bundle)) {
            throw new ConflictException(
                    "Отмена доступна только для задач в статусе «Ожидает» или «Ожидает подтверждения»");
        }
        reconfigurationTaskStatusService.recordTaskLevelStatus(
                taskId,
                ReconfigurationTaskExecutionStatus.CANCEL,
                resolveUpdatedBy(),
                null,
                task.batches().stream().map(ReconfigurationBatch::id).toList());
        return taskResponseAfterStatusChange(task);
    }

    public List<ReconfigurationTaskStatusHistoryEntry> getStatusHistory(UUID taskId) {
        List<ReconfigurationTaskStatus> rows =
                reconfigurationTaskStatusService.findHistoryByTaskId(taskId);
        return rows.stream().map(reconfigurationTaskMapper::toHistoryEntry).toList();
    }

    public ReconfigurationTaskResponse confirm(UUID taskId) {
        ReconfigurationTask task = requireTaskFromKafka(taskId);
        TaskExecutionStatusBundle bundle = loadStatusBundle(task.id());
        ReconfigurationEntityStatus effective =
                reconfigurationTaskMapper.effectiveTaskStatus(task, bundle);
        if (effective != ReconfigurationEntityStatus.AWAITING_CONFIRMATION) {
            throw new ConflictException(
                    "Подтверждение доступно только для задач в статусе «Ожидает подтверждения»");
        }
        reconfigurationTaskStatusService.recordTaskLevelStatus(
                taskId,
                ReconfigurationTaskExecutionStatus.CONFIRMED,
                resolveUpdatedBy(),
                null);
        return taskResponseAfterStatusChange(task);
    }

    private ReconfigurationTask requireTaskFromKafka(UUID taskId) {
        return kafkaReconfigAdapter.readTopicSnapshot(Duration.ofSeconds(45), 5000).stream()
                .filter(t -> taskId.equals(t.id()))
                .reduce((first, second) -> second)
                .orElseThrow(() -> new NotFoundException("Задача реконфигурации не найдена: " + taskId));
    }

    private TaskExecutionStatusBundle loadStatusBundle(UUID taskId) {
        Map<UUID, TaskExecutionStatusBundle> statusByTaskId =
                reconfigurationTaskStatusService.loadLatestByTaskIds(List.of(taskId));
        return statusByTaskId.get(taskId);
    }

    private ReconfigurationTaskResponse taskResponseAfterStatusChange(ReconfigurationTask task) {
        Map<UUID, TaskExecutionStatusBundle> statusByTaskId =
                reconfigurationTaskStatusService.loadLatestByTaskIds(List.of(task.id()));
        return reconfigurationTaskMapper.toResponse(task, statusByTaskId);
    }

    private String resolveUpdatedBy() {
        User user = userAuthService.getCurrentUser();
        return user.getLogin();
    }

    private String resolveInitiatedBy() {
        User user = userAuthService.getCurrentUser();
        return applicationInstanceId + ":" + user.getFirstName() + "_" + user.getLastName();
    }

    /**
     * В снимке топика одна задача может встречаться несколько раз (обновления в Kafka).
     * Берём последнюю версию по порядку чтения — как в {@link #requireTaskFromKafka}.
     */
    private static List<ReconfigurationTask> latestKafkaTasksById(List<ReconfigurationTask> tasks) {
        Map<UUID, ReconfigurationTask> byId = new LinkedHashMap<>();
        for (ReconfigurationTask task : tasks) {
            if (task.id() != null) {
                byId.put(task.id(), task);
            }
        }
        return new ArrayList<>(byId.values());
    }
}
