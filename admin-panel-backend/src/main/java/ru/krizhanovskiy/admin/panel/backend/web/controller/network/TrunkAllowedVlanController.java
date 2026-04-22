package ru.krizhanovskiy.admin.panel.backend.web.controller.network;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.TrunkAllowedVlanCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.TrunkAllowedVlanResponse;
import ru.krizhanovskiy.admin.panel.backend.service.TrunkAllowedVlanService;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/network/interfaces/{interfaceId}/trunk-allowed-vlans")
@RequiredArgsConstructor
@Validated
@Tag(name = "Trunk: разрешённые VLAN", description = "Список VLAN, разрешённых на trunk-порту")
public class TrunkAllowedVlanController {

    private final TrunkAllowedVlanService trunkAllowedVlanService;

    @GetMapping
    @Operation(summary = "Список разрешённых VLAN на интерфейсе")
    public List<TrunkAllowedVlanResponse> list(@PathVariable UUID interfaceId) {
        return trunkAllowedVlanService.listByInterface(interfaceId);
    }

    @PostMapping
    @Operation(summary = "Добавить VLAN в список trunk")
    public ResponseEntity<TrunkAllowedVlanResponse> add(
            @PathVariable UUID interfaceId,
            @Valid @RequestBody TrunkAllowedVlanCreateRequest request) {
        TrunkAllowedVlanResponse created = trunkAllowedVlanService.add(interfaceId, request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{vlanId}")
                .buildAndExpand(created.vlanId())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @DeleteMapping("/{vlanId}")
    @Operation(summary = "Убрать VLAN из списка trunk")
    public ResponseEntity<Void> remove(
            @PathVariable UUID interfaceId,
            @PathVariable @Min(1) @Max(4094) Short vlanId) {
        trunkAllowedVlanService.remove(interfaceId, vlanId);
        return ResponseEntity.noContent().build();
    }
}
