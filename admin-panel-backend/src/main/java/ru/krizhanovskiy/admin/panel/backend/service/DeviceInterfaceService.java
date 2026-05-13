package ru.krizhanovskiy.admin.panel.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.DeviceInterfaceCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.DeviceInterfaceResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.DeviceInterfaceUpdateRequest;
import ru.krizhanovskiy.admin.panel.backend.domain.DeviceInterface;
import ru.krizhanovskiy.admin.panel.backend.domain.Vlan;
import ru.krizhanovskiy.admin.panel.backend.mapper.NetworkEntityMapper;
import ru.krizhanovskiy.admin.panel.backend.repository.DeviceInterfaceRepository;
import ru.krizhanovskiy.admin.panel.backend.repository.VlanRepository;
import ru.krizhanovskiy.admin.panel.backend.web.error.ConflictException;
import ru.krizhanovskiy.admin.panel.backend.web.error.NotFoundException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DeviceInterfaceService {

    private static final short VLAN_MIN = 1;
    private static final short VLAN_MAX = 4094;

    private final DeviceInterfaceRepository deviceInterfaceRepository;
    private final NetworkDeviceService networkDeviceService;
    private final VlanRepository vlanRepository;
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
        e.setIpAddress(normalizeIp(request.ipAddress()));

        if (request.parentInterfaceId() == null) {
            if (request.dot1qVlanId() != null) {
                throw new IllegalArgumentException(
                        "У физического порта не задаётся VLAN 802.1Q (dot1qVlanId должен быть пустым)");
            }
            e.setParentInterface(null);
            e.setDot1qVlan(null);
        } else {
            DeviceInterface parent = interfaceById(request.parentInterfaceId());
            if (!parent.getDevice().getId().equals(deviceId)) {
                throw new IllegalArgumentException(
                        "Родительский интерфейс принадлежит другому устройству");
            }
            if (parent.getParentInterface() != null) {
                throw new IllegalArgumentException(
                        "Сабинтерфейс можно создать только на физическом порту (родитель без parent)");
            }
            if (request.dot1qVlanId() == null) {
                throw new IllegalArgumentException(
                        "Для сабинтерфейса укажите dot1qVlanId (VID из таблицы vlan)");
            }
            Vlan vlan = vlanByVid(request.dot1qVlanId());
            e.setParentInterface(parent);
            e.setDot1qVlan(vlan);
        }

        assertUniqueName(deviceId, request.name(), null);
        assertUniqueParentVlan(e);

        return networkEntityMapper.toDeviceInterfaceResponse(deviceInterfaceRepository.save(e));
    }

    @Transactional
    public DeviceInterfaceResponse update(UUID id, DeviceInterfaceUpdateRequest request) {
        DeviceInterface e = interfaceById(id);
        e.setName(request.name());
        e.setAdminStatus(request.adminStatus());
        e.setIpAddress(normalizeIp(request.ipAddress()));

        if (e.getParentInterface() == null) {
            if (request.dot1qVlanId() != null) {
                throw new IllegalArgumentException(
                        "У физического порта не задаётся VLAN 802.1Q (dot1qVlanId должен быть пустым)");
            }
            e.setDot1qVlan(null);
        } else {
            if (request.dot1qVlanId() == null) {
                throw new IllegalArgumentException(
                        "Для сабинтерфейса укажите dot1qVlanId");
            }
            e.setDot1qVlan(vlanByVid(request.dot1qVlanId()));
        }

        assertUniqueName(e.getDevice().getId(), request.name(), e.getId());
        assertUniqueParentVlan(e);

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

    private Vlan vlanByVid(Short vlanId) {
        assertVlanRange(vlanId);
        return vlanRepository.findById(vlanId)
                .orElseThrow(() -> new IllegalArgumentException("VLAN не найден в модели: " + vlanId));
    }

    private static void assertVlanRange(Short vlanId) {
        if (vlanId == null) {
            return;
        }
        if (vlanId < VLAN_MIN || vlanId > VLAN_MAX) {
            throw new IllegalArgumentException("Номер VLAN должен быть от 1 до 4094");
        }
    }

    private static String normalizeIp(String ip) {
        if (ip == null) {
            return null;
        }
        String t = ip.trim();
        return t.isEmpty() ? null : t;
    }

    private void assertUniqueName(UUID deviceId, String name, UUID excludeInterfaceId) {
        boolean taken = excludeInterfaceId == null
                ? deviceInterfaceRepository.existsByDevice_IdAndName(deviceId, name)
                : deviceInterfaceRepository.existsByDevice_IdAndNameAndIdNot(deviceId, name, excludeInterfaceId);
        if (taken) {
            throw new ConflictException("На этом устройстве уже есть интерфейс с именем «" + name + "».");
        }
    }

    private void assertUniqueParentVlan(DeviceInterface e) {
        if (e.getParentInterface() == null || e.getDot1qVlan() == null) {
            return;
        }
        UUID parentId = e.getParentInterface().getId();
        Short vid = e.getDot1qVlan().getVlanId();
        boolean taken = e.getId() == null
                ? deviceInterfaceRepository.existsByParentInterface_IdAndDot1qVlan_VlanId(parentId, vid)
                : deviceInterfaceRepository.existsByParentInterface_IdAndDot1qVlan_VlanIdAndIdNot(
                        parentId, vid, e.getId());
        if (taken) {
            throw new ConflictException(
                    "На порту «" + e.getParentInterface().getName() + "» уже есть сабинтерфейс с VLAN " + vid + ".");
        }
    }
}
