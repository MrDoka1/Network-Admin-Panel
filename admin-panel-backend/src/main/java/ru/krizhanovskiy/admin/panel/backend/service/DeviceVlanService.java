package ru.krizhanovskiy.admin.panel.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.DeviceVlanResponse;
import ru.krizhanovskiy.admin.panel.backend.domain.DeviceVlan;
import ru.krizhanovskiy.admin.panel.backend.domain.DeviceVlanId;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.VlanAdminStatus;
import ru.krizhanovskiy.admin.panel.backend.mapper.NetworkEntityMapper;
import ru.krizhanovskiy.admin.panel.backend.repository.DeviceVlanRepository;
import ru.krizhanovskiy.admin.panel.backend.web.error.NotFoundException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DeviceVlanService {

    private final DeviceVlanRepository deviceVlanRepository;
    private final NetworkDeviceService networkDeviceService;
    private final VlanService vlanService;
    private final NetworkEntityMapper networkEntityMapper;

    @Transactional(readOnly = true)
    public List<DeviceVlanResponse> listAll() {
        return deviceVlanRepository.findAll().stream()
                .map(networkEntityMapper::toDeviceVlanResponse)
                .toList();
    }

    @Transactional
    public DeviceVlanResponse assign(UUID deviceId, Short vlanId) {
        var device = networkDeviceService.deviceById(deviceId);
        var vlan = vlanService.vlanById(vlanId);
        var id = new DeviceVlanId(deviceId, vlanId);
        if (deviceVlanRepository.existsById(id)) {
            throw new IllegalArgumentException(
                    "VLAN " + vlanId + " уже настроен на устройстве " + device.getHostname());
        }
        DeviceVlan e = new DeviceVlan();
        e.setId(id);
        e.setDevice(device);
        e.setName(vlan.getName());
        e.setAdminStatus(vlan.getAdminStatus() != null ? vlan.getAdminStatus() : VlanAdminStatus.ACTIVE);
        e.setOperStatus(vlan.getOperStatus());
        return networkEntityMapper.toDeviceVlanResponse(deviceVlanRepository.save(e));
    }

    @Transactional
    public void unassign(UUID deviceId, Short vlanId) {
        networkDeviceService.deviceById(deviceId);
        var id = new DeviceVlanId(deviceId, vlanId);
        if (!deviceVlanRepository.existsById(id)) {
            throw new NotFoundException(
                    "VLAN " + vlanId + " не настроен на устройстве: " + deviceId);
        }
        deviceVlanRepository.deleteById(id);
    }
}
