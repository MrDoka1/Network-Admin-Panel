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
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointDeviceInterfaceCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointDeviceInterfaceResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointDeviceInterfaceUpdateRequest;
import ru.krizhanovskiy.admin.panel.backend.service.EndpointDeviceInterfaceService;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/network")
@RequiredArgsConstructor
@Tag(name = "Интерфейсы оконечных устройств", description = "NIC с MAC-адресом")
public class EndpointDeviceInterfaceController {

    private final EndpointDeviceInterfaceService endpointDeviceInterfaceService;

    @GetMapping("/endpoint-devices/{endpointDeviceId}/interfaces")
    @Operation(summary = "Интерфейсы оконечного устройства")
    public List<EndpointDeviceInterfaceResponse> listByEndpointDevice(@PathVariable UUID endpointDeviceId) {
        return endpointDeviceInterfaceService.listByEndpointDevice(endpointDeviceId);
    }

    @GetMapping("/endpoint-interfaces/{id}")
    @Operation(summary = "Интерфейс оконечного устройства по id")
    public EndpointDeviceInterfaceResponse get(@PathVariable UUID id) {
        return endpointDeviceInterfaceService.getById(id);
    }

    @PostMapping("/endpoint-devices/{endpointDeviceId}/interfaces")
    @Operation(summary = "Добавить интерфейс оконечному устройству")
    public ResponseEntity<EndpointDeviceInterfaceResponse> create(
            @PathVariable UUID endpointDeviceId,
            @Valid @RequestBody EndpointDeviceInterfaceCreateRequest request) {
        EndpointDeviceInterfaceResponse created =
                endpointDeviceInterfaceService.create(endpointDeviceId, request);
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/v1/network/endpoint-interfaces/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PutMapping("/endpoint-interfaces/{id}")
    @Operation(summary = "Обновить интерфейс оконечного устройства")
    public EndpointDeviceInterfaceResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody EndpointDeviceInterfaceUpdateRequest request) {
        return endpointDeviceInterfaceService.update(id, request);
    }

    @DeleteMapping("/endpoint-interfaces/{id}")
    @Operation(summary = "Удалить интерфейс оконечного устройства")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        endpointDeviceInterfaceService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
