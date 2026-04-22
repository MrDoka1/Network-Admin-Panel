package ru.krizhanovskiy.admin.panel.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.TrunkAllowedVlanCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.TrunkAllowedVlanResponse;
import ru.krizhanovskiy.admin.panel.backend.domain.TrunkAllowedVlan;
import ru.krizhanovskiy.admin.panel.backend.domain.TrunkAllowedVlanId;
import ru.krizhanovskiy.admin.panel.backend.mapper.NetworkEntityMapper;
import ru.krizhanovskiy.admin.panel.backend.repository.TrunkAllowedVlanRepository;
import ru.krizhanovskiy.admin.panel.backend.web.error.NotFoundException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TrunkAllowedVlanService {

    private final TrunkAllowedVlanRepository trunkAllowedVlanRepository;
    private final DeviceInterfaceService deviceInterfaceService;
    private final VlanService vlanService;
    private final NetworkEntityMapper networkEntityMapper;

    @Transactional(readOnly = true)
    public List<TrunkAllowedVlanResponse> listByInterface(UUID interfaceId) {
        deviceInterfaceService.interfaceById(interfaceId);
        return trunkAllowedVlanRepository.findByDeviceInterface_Id(interfaceId).stream()
                .map(networkEntityMapper::toTrunkAllowedVlanResponse)
                .toList();
    }

    @Transactional
    public TrunkAllowedVlanResponse add(UUID interfaceId, TrunkAllowedVlanCreateRequest request) {
        var iface = deviceInterfaceService.interfaceById(interfaceId);
        var vlan = vlanService.vlanById(request.vlanId());
        TrunkAllowedVlan e = new TrunkAllowedVlan();
        e.setDeviceInterface(iface);
        e.setVlan(vlan);
        return networkEntityMapper.toTrunkAllowedVlanResponse(trunkAllowedVlanRepository.save(e));
    }

    @Transactional
    public void remove(UUID interfaceId, Short vlanId) {
        deviceInterfaceService.interfaceById(interfaceId);
        var id = new TrunkAllowedVlanId(interfaceId, vlanId);
        if (!trunkAllowedVlanRepository.existsById(id)) {
            throw new NotFoundException("Запись trunk allowed VLAN не найдена: interface=" + interfaceId + ", vlan=" + vlanId);
        }
        trunkAllowedVlanRepository.deleteById(id);
    }
}
