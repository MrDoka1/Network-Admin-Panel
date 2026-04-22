package ru.krizhanovskiy.admin.panel.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.DeviceInterfaceCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.DeviceInterfaceResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.DeviceInterfaceUpdateRequest;
import ru.krizhanovskiy.admin.panel.backend.domain.DeviceInterface;
import ru.krizhanovskiy.admin.panel.backend.mapper.NetworkEntityMapper;
import ru.krizhanovskiy.admin.panel.backend.repository.DeviceInterfaceRepository;
import ru.krizhanovskiy.admin.panel.backend.web.error.NotFoundException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DeviceInterfaceService {

    private final DeviceInterfaceRepository deviceInterfaceRepository;
    private final NetworkDeviceService networkDeviceService;
    private final NetworkEntityMapper networkEntityMapper;

    @Transactional(readOnly = true)
    public List<DeviceInterfaceResponse> listByDevice(UUID deviceId) {
        networkDeviceService.deviceById(deviceId);
        return deviceInterfaceRepository.findByDevice_Id(deviceId).stream()
                .map(networkEntityMapper::toDeviceInterfaceResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public DeviceInterfaceResponse getById(UUID id) {
        return networkEntityMapper.toDeviceInterfaceResponse(interfaceById(id));
    }

    @Transactional
    public DeviceInterfaceResponse create(UUID deviceId, DeviceInterfaceCreateRequest request) {
        var device = networkDeviceService.deviceById(deviceId);
        DeviceInterface e = new DeviceInterface();
        e.setDevice(device);
        e.setName(request.name());
        e.setAdminStatus(request.adminStatus());
        return networkEntityMapper.toDeviceInterfaceResponse(deviceInterfaceRepository.save(e));
    }

    @Transactional
    public DeviceInterfaceResponse update(UUID id, DeviceInterfaceUpdateRequest request) {
        DeviceInterface e = interfaceById(id);
        e.setName(request.name());
        e.setAdminStatus(request.adminStatus());
        return networkEntityMapper.toDeviceInterfaceResponse(deviceInterfaceRepository.save(e));
    }

    @Transactional
    public void delete(UUID id) {
        if (!deviceInterfaceRepository.existsById(id)) {
            throw new NotFoundException("Интерфейс не найден: " + id);
        }
        deviceInterfaceRepository.deleteById(id);
    }

    DeviceInterface interfaceById(UUID id) {
        return deviceInterfaceRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Интерфейс не найден: " + id));
    }
}
