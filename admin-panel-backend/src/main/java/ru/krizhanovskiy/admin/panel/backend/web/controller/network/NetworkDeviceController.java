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
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.NetworkDeviceCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.NetworkDeviceResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.NetworkDeviceUpdateRequest;
import ru.krizhanovskiy.admin.panel.backend.service.NetworkDeviceService;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/network/devices")
@RequiredArgsConstructor
@Tag(name = "Сетевые устройства", description = "Роутеры и коммутаторы")
public class NetworkDeviceController {

    private final NetworkDeviceService networkDeviceService;

    @GetMapping
    @Operation(summary = "Список устройств")
    public List<NetworkDeviceResponse> list() {
        return networkDeviceService.listAll();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Устройство по id")
    public NetworkDeviceResponse get(@PathVariable UUID id) {
        return networkDeviceService.getById(id);
    }

    @PostMapping
    @Operation(summary = "Создать устройство")
    public ResponseEntity<NetworkDeviceResponse> create(@Valid @RequestBody NetworkDeviceCreateRequest request) {
        NetworkDeviceResponse created = networkDeviceService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Обновить устройство")
    public NetworkDeviceResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody NetworkDeviceUpdateRequest request) {
        return networkDeviceService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Удалить устройство")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        networkDeviceService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
