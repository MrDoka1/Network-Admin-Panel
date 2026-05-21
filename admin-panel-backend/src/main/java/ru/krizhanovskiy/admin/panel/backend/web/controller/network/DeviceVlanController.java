package ru.krizhanovskiy.admin.panel.backend.web.controller.network;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.DeviceVlanResponse;
import ru.krizhanovskiy.admin.panel.backend.service.DeviceVlanService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/network/device-vlans")
@RequiredArgsConstructor
@Tag(name = "VLAN на устройстве", description = "VLAN, настроенные на сетевых устройствах")
public class DeviceVlanController {

    private final DeviceVlanService deviceVlanService;

    @GetMapping
    @Operation(summary = "Список VLAN на устройствах")
    public List<DeviceVlanResponse> list() {
        return deviceVlanService.listAll();
    }
}
