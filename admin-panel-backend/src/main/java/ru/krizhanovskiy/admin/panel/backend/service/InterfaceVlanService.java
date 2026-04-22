package ru.krizhanovskiy.admin.panel.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.InterfaceVlanResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.InterfaceVlanUpsertRequest;
import ru.krizhanovskiy.admin.panel.backend.domain.InterfaceVlan;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.InterfaceVlanMode;
import ru.krizhanovskiy.admin.panel.backend.mapper.NetworkEntityMapper;
import ru.krizhanovskiy.admin.panel.backend.repository.InterfaceVlanRepository;
import ru.krizhanovskiy.admin.panel.backend.web.error.NotFoundException;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class InterfaceVlanService {

    private final InterfaceVlanRepository interfaceVlanRepository;
    private final DeviceInterfaceService deviceInterfaceService;
    private final VlanService vlanService;
    private final NetworkEntityMapper networkEntityMapper;

    @Transactional(readOnly = true)
    public InterfaceVlanResponse getByInterfaceId(UUID interfaceId) {
        deviceInterfaceService.interfaceById(interfaceId);
        return interfaceVlanRepository.findByDeviceInterface_Id(interfaceId)
                .map(networkEntityMapper::toInterfaceVlanResponse)
                .orElseThrow(() -> new NotFoundException("Для интерфейса " + interfaceId + " нет настроек VLAN"));
    }

    @Transactional
    public InterfaceVlanResponse upsert(UUID interfaceId, InterfaceVlanUpsertRequest request) {
        validateVlanBinding(request);
        var iface = deviceInterfaceService.interfaceById(interfaceId);
        InterfaceVlan e = interfaceVlanRepository.findByDeviceInterface_Id(interfaceId).orElseGet(() -> {
            InterfaceVlan n = new InterfaceVlan();
            n.setDeviceInterface(iface);
            return n;
        });
        e.setMode(request.mode());
        e.setAccessVlan(request.accessVlanId() != null ? vlanService.vlanById(request.accessVlanId()) : null);
        e.setNativeVlan(request.nativeVlanId() != null ? vlanService.vlanById(request.nativeVlanId()) : null);
        return networkEntityMapper.toInterfaceVlanResponse(interfaceVlanRepository.save(e));
    }

    @Transactional
    public void deleteByInterfaceId(UUID interfaceId) {
        deviceInterfaceService.interfaceById(interfaceId);
        interfaceVlanRepository.findByDeviceInterface_Id(interfaceId)
                .ifPresentOrElse(
                        interfaceVlanRepository::delete,
                        () -> {
                            throw new NotFoundException("Для интерфейса " + interfaceId + " нет настроек VLAN");
                        });
    }

    private static void validateVlanBinding(InterfaceVlanUpsertRequest request) {
        if (request.mode() == InterfaceVlanMode.ACCESS) {
            if (request.accessVlanId() == null) {
                throw new IllegalArgumentException("В режиме ACCESS поле accessVlanId обязательно");
            }
            if (request.nativeVlanId() != null) {
                throw new IllegalArgumentException("В режиме ACCESS поле nativeVlanId должно быть пустым");
            }
        } else if (request.mode() == InterfaceVlanMode.TRUNK) {
            if (request.accessVlanId() != null) {
                throw new IllegalArgumentException("В режиме TRUNK поле accessVlanId должно быть пустым");
            }
        }
    }
}
