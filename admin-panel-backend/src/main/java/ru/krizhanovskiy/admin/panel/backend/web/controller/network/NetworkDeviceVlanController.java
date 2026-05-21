package ru.krizhanovskiy.admin.panel.backend.web.controller.network;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.DeviceVlanResponse;
import ru.krizhanovskiy.admin.panel.backend.service.DeviceVlanService;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/network/devices/{deviceId}/vlans")
@RequiredArgsConstructor
@Validated
@Tag(name = "VLAN на устройстве", description = "Назначение VLAN на сетевом устройстве")
public class NetworkDeviceVlanController {

    private final DeviceVlanService deviceVlanService;

    @PostMapping("/{vlanId}")
    @Operation(summary = "Настроить VLAN на устройстве")
    public ResponseEntity<DeviceVlanResponse> assign(
            @PathVariable UUID deviceId,
            @PathVariable @Min(1) @Max(4094) Short vlanId) {
        DeviceVlanResponse created = deviceVlanService.assign(deviceId, vlanId);
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/v1/network/device-vlans")
                .build()
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @DeleteMapping("/{vlanId}")
    @Operation(summary = "Убрать VLAN с устройства")
    public ResponseEntity<Void> unassign(
            @PathVariable UUID deviceId,
            @PathVariable @Min(1) @Max(4094) Short vlanId) {
        deviceVlanService.unassign(deviceId, vlanId);
        return ResponseEntity.noContent().build();
    }
}
