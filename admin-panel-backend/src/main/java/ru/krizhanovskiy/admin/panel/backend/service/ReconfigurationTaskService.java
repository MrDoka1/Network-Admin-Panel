package ru.krizhanovskiy.admin.panel.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationTaskCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationTaskResponse;
import ru.krizhanovskiy.admin.panel.backend.domain.User;
import ru.krizhanovskiy.admin.panel.backend.kafka.KafkaReconfigAdapter;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ReconfigurationBatch;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ReconfigurationEntityStatus;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ReconfigurationTask;
import ru.krizhanovskiy.admin.panel.backend.mapper.ReconfigurationTaskMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletionException;

@Service
@RequiredArgsConstructor
public class ReconfigurationTaskService {

    @Value("${app.instance-id:admin-panel}")
    private String applicationInstanceId;

    private final KafkaReconfigAdapter kafkaReconfigAdapter;
    private final ReconfigurationTaskMapper reconfigurationTaskMapper;
    private final UserAuthService userAuthService;

    public List<ReconfigurationTaskResponse> listSnapshot(Duration maxTotalWait, int maxRecords) {
        return kafkaReconfigAdapter.readTopicSnapshot(maxTotalWait, maxRecords).stream()
                .map(reconfigurationTaskMapper::toResponse)
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
        return reconfigurationTaskMapper.toResponse(task);
    }

    private String resolveInitiatedBy() {
        User user = userAuthService.getCurrentUser();
        return applicationInstanceId + ":" + user.getFirstName() + "_" + user.getLastName();
    }
}
