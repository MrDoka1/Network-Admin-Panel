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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.VlanCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.VlanResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.VlanUpdateRequest;
import ru.krizhanovskiy.admin.panel.backend.service.VlanService;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/network/vlans")
@RequiredArgsConstructor
@Validated
@Tag(name = "VLAN", description = "VLAN (VID 1–4094)")
public class VlanController {

    private final VlanService vlanService;

    @GetMapping
    @Operation(summary = "Список VLAN")
    public List<VlanResponse> list() {
        return vlanService.listAll();
    }

    @GetMapping("/{vlanId}")
    @Operation(summary = "VLAN по номеру")
    public VlanResponse get(@PathVariable @Min(1) @Max(4094) Short vlanId) {
        return vlanService.getById(vlanId);
    }

    @PostMapping
    @Operation(summary = "Создать VLAN")
    public ResponseEntity<VlanResponse> create(@Valid @RequestBody VlanCreateRequest request) {
        VlanResponse created = vlanService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{vlanId}")
                .buildAndExpand(created.vlanId())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PatchMapping("/{vlanId}")
    @Operation(summary = "Частично обновить VLAN")
    public VlanResponse patch(
            @PathVariable @Min(1) @Max(4094) Short vlanId,
            @Valid @RequestBody VlanUpdateRequest request) {
        return vlanService.update(vlanId, request);
    }

    @DeleteMapping("/{vlanId}")
    @Operation(summary = "Удалить VLAN")
    public ResponseEntity<Void> delete(@PathVariable @Min(1) @Max(4094) Short vlanId) {
        vlanService.delete(vlanId);
        return ResponseEntity.noContent().build();
    }
}
