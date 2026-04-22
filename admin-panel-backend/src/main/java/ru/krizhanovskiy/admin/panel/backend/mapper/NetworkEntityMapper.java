package ru.krizhanovskiy.admin.panel.backend.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.DeviceInterfaceResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.InterfaceVlanResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.LinkResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.NetworkDeviceResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.TrunkAllowedVlanResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.VlanResponse;
import ru.krizhanovskiy.admin.panel.backend.domain.DeviceInterface;
import ru.krizhanovskiy.admin.panel.backend.domain.InterfaceVlan;
import ru.krizhanovskiy.admin.panel.backend.domain.Link;
import ru.krizhanovskiy.admin.panel.backend.domain.NetworkDevice;
import ru.krizhanovskiy.admin.panel.backend.domain.TrunkAllowedVlan;
import ru.krizhanovskiy.admin.panel.backend.domain.Vlan;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface NetworkEntityMapper {

    NetworkDeviceResponse toNetworkDeviceResponse(NetworkDevice entity);

    VlanResponse toVlanResponse(Vlan entity);

    @Mapping(target = "deviceId", source = "device.id")
    DeviceInterfaceResponse toDeviceInterfaceResponse(DeviceInterface entity);

    @Mapping(target = "interfaceAId", source = "interfaceA.id")
    @Mapping(target = "interfaceBId", source = "interfaceB.id")
    LinkResponse toLinkResponse(Link entity);

    @Mapping(target = "interfaceId", source = "deviceInterface.id")
    @Mapping(target = "accessVlanId", source = "accessVlan.vlanId")
    @Mapping(target = "nativeVlanId", source = "nativeVlan.vlanId")
    InterfaceVlanResponse toInterfaceVlanResponse(InterfaceVlan entity);

    @Mapping(target = "interfaceId", source = "deviceInterface.id")
    @Mapping(target = "vlanId", source = "vlan.vlanId")
    TrunkAllowedVlanResponse toTrunkAllowedVlanResponse(TrunkAllowedVlan entity);
}
