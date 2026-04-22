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
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.DeviceInterfaceCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.DeviceInterfaceResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.DeviceInterfaceUpdateRequest;
import ru.krizhanovskiy.admin.panel.backend.service.DeviceInterfaceService;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/network")
@RequiredArgsConstructor
@Tag(name = "Интерфейсы устройств", description = "Порты и прочие интерфейсы")
public class DeviceInterfaceController {

    private final DeviceInterfaceService deviceInterfaceService;

    @GetMapping("/devices/{deviceId}/interfaces")
    @Operation(summary = "Интерфейсы устройства")
    public List<DeviceInterfaceResponse> listByDevice(@PathVariable UUID deviceId) {
        return deviceInterfaceService.listByDevice(deviceId);
    }

    @GetMapping("/interfaces/{id}")
    @Operation(summary = "Интерфейс по id")
    public DeviceInterfaceResponse get(@PathVariable UUID id) {
        return deviceInterfaceService.getById(id);
    }

    @PostMapping("/devices/{deviceId}/interfaces")
    @Operation(summary = "Добавить интерфейс устройству")
    public ResponseEntity<DeviceInterfaceResponse> create(
            @PathVariable UUID deviceId,
            @Valid @RequestBody DeviceInterfaceCreateRequest request) {
        DeviceInterfaceResponse created = deviceInterfaceService.create(deviceId, request);
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/v1/network/interfaces/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PutMapping("/interfaces/{id}")
    @Operation(summary = "Обновить интерфейс")
    public DeviceInterfaceResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody DeviceInterfaceUpdateRequest request) {
        return deviceInterfaceService.update(id, request);
    }

    @DeleteMapping("/interfaces/{id}")
    @Operation(summary = "Удалить интерфейс")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        deviceInterfaceService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
