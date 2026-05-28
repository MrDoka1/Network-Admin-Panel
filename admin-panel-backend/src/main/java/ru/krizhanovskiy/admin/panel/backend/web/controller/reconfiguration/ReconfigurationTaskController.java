package ru.krizhanovskiy.admin.panel.backend.web.controller.reconfiguration;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationTaskCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationTaskResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationTaskStatusHistoryEntry;
import ru.krizhanovskiy.admin.panel.backend.service.ReconfigurationTaskService;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reconfiguration/tasks")
@RequiredArgsConstructor
@Validated
@Tag(name = "Реконфигурация (Kafka)", description = "Задачи реконфигурации VLAN в топике Kafka")
public class ReconfigurationTaskController {

    private final ReconfigurationTaskService reconfigurationTaskService;

    @GetMapping
    @Operation(summary = "Список задач из топика (снимок с начала)",
            description = "Однократное чтение топика с earliest; останавливается по таймауту или лимиту записей. "
                    + "Порядок соответствует обходу партиций при poll, не гарантирует глобальный порядок по времени.")
    public List<ReconfigurationTaskResponse> list(
            @RequestParam(defaultValue = "500") @Min(1) @Max(5000) int maxRecords,
            @RequestParam(defaultValue = "30") @Min(1) @Max(120) int maxWaitSeconds) {
        return reconfigurationTaskService.listSnapshot(Duration.ofSeconds(maxWaitSeconds), maxRecords);
    }

    @PostMapping
    @Operation(summary = "Создать задачу (отправить сообщение в Kafka)")
    public ResponseEntity<ReconfigurationTaskResponse> create(
            @Valid @RequestBody ReconfigurationTaskCreateRequest request) {
        ReconfigurationTaskResponse created = reconfigurationTaskService.publish(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @GetMapping("/{id}/status-history")
    @Operation(summary = "История смены статусов задачи и батчей",
            description = "Все записи из reconfiguration_task_status для задачи, от новых к старым. "
                    + "Записи с batchId = null — изменения на уровне задачи (отображаются для всех батчей).")
    public List<ReconfigurationTaskStatusHistoryEntry> statusHistory(@PathVariable UUID id) {
        return reconfigurationTaskService.getStatusHistory(id);
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "Отменить задачу",
            description = "Доступно для задач в статусе «Ожидает» или «Ожидает подтверждения».")
    public ReconfigurationTaskResponse cancel(@PathVariable UUID id) {
        return reconfigurationTaskService.cancel(id);
    }

    @PostMapping("/{id}/confirm")
    @Operation(summary = "Подтвердить задачу",
            description = "Доступно для задач в статусе «Ожидает подтверждения».")
    public ReconfigurationTaskResponse confirm(@PathVariable UUID id) {
        return reconfigurationTaskService.confirm(id);
    }
}
