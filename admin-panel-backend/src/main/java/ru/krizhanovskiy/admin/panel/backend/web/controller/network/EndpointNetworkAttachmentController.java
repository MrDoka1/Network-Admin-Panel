package ru.krizhanovskiy.admin.panel.backend.web.controller.network;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointNetworkAttachmentCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointNetworkAttachmentResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointNetworkAttachmentUpdateRequest;
import ru.krizhanovskiy.admin.panel.backend.service.EndpointNetworkAttachmentService;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/network/endpoint-attachments")
@RequiredArgsConstructor
@Tag(name = "Подключения оконечных устройств", description = "Стык NIC с портом сетевого устройства")
public class EndpointNetworkAttachmentController {

    private final EndpointNetworkAttachmentService endpointNetworkAttachmentService;

    @GetMapping
    @Operation(summary = "Список подключений")
    public List<EndpointNetworkAttachmentResponse> list() {
        return endpointNetworkAttachmentService.listAll();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Подключение по id")
    public EndpointNetworkAttachmentResponse get(@PathVariable UUID id) {
        return endpointNetworkAttachmentService.getById(id);
    }

    @PostMapping
    @Operation(summary = "Создать подключение")
    public ResponseEntity<EndpointNetworkAttachmentResponse> create(
            @Valid @RequestBody EndpointNetworkAttachmentCreateRequest request) {
        EndpointNetworkAttachmentResponse created = endpointNetworkAttachmentService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Обновить подключение (смена порта или NIC)")
    public EndpointNetworkAttachmentResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody EndpointNetworkAttachmentUpdateRequest request) {
        return endpointNetworkAttachmentService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Удалить подключение")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        endpointNetworkAttachmentService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
