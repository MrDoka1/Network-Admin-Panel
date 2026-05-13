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
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointDeviceCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointDeviceResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointDeviceUpdateRequest;
import ru.krizhanovskiy.admin.panel.backend.service.EndpointDeviceService;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/network/endpoint-devices")
@RequiredArgsConstructor
@Tag(name = "Оконечные устройства", description = "Хосты и прочие не-infrastructure узлы")
public class EndpointDeviceController {

    private final EndpointDeviceService endpointDeviceService;

    @GetMapping
    @Operation(summary = "Список оконечных устройств")
    public List<EndpointDeviceResponse> list() {
        return endpointDeviceService.listAll();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Оконечное устройство по id")
    public EndpointDeviceResponse get(@PathVariable UUID id) {
        return endpointDeviceService.getById(id);
    }

    @PostMapping
    @Operation(summary = "Создать оконечное устройство")
    public ResponseEntity<EndpointDeviceResponse> create(@Valid @RequestBody EndpointDeviceCreateRequest request) {
        EndpointDeviceResponse created = endpointDeviceService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Обновить оконечное устройство")
    public EndpointDeviceResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody EndpointDeviceUpdateRequest request) {
        return endpointDeviceService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Удалить оконечное устройство")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        endpointDeviceService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
