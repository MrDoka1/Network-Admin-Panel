package ru.krizhanovskiy.admin.panel.backend.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.DeviceInterfaceResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.DeviceVlanResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointDeviceInterfaceResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointDeviceResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointNetworkAttachmentResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.InterfaceVlanResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.LinkResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.NetworkDeviceResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.TrunkAllowedVlanResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.VlanResponse;
import ru.krizhanovskiy.admin.panel.backend.domain.DeviceInterface;
import ru.krizhanovskiy.admin.panel.backend.domain.DeviceVlan;
import ru.krizhanovskiy.admin.panel.backend.domain.EndpointDevice;
import ru.krizhanovskiy.admin.panel.backend.domain.EndpointDeviceInterface;
import ru.krizhanovskiy.admin.panel.backend.domain.EndpointNetworkAttachment;
import ru.krizhanovskiy.admin.panel.backend.domain.InterfaceVlan;
import ru.krizhanovskiy.admin.panel.backend.domain.Link;
import ru.krizhanovskiy.admin.panel.backend.domain.NetworkDevice;
import ru.krizhanovskiy.admin.panel.backend.domain.TrunkAllowedVlan;
import ru.krizhanovskiy.admin.panel.backend.domain.Vlan;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface NetworkEntityMapper {

    NetworkDeviceResponse toNetworkDeviceResponse(NetworkDevice entity);

    @Mapping(target = "isProtected", source = "protected")
    VlanResponse toVlanResponse(Vlan entity);

    @Mapping(target = "deviceId", source = "device.id")
    @Mapping(target = "vlanId", source = "id.vlanId")
    DeviceVlanResponse toDeviceVlanResponse(DeviceVlan entity);

    @Mapping(target = "deviceId", source = "device.id")
    @Mapping(target = "parentInterfaceId", source = "parentInterface.id")
    @Mapping(target = "dot1qVlanId", source = "dot1qVlan.vlanId")
    @Mapping(target = "vlanBinding", ignore = true)
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

    EndpointDeviceResponse toEndpointDeviceResponse(EndpointDevice entity);

    @Mapping(target = "endpointDeviceId", source = "endpointDevice.id")
    @Mapping(target = "networkInterfaceId", source = "attachment.networkInterface.id")
    EndpointDeviceInterfaceResponse toEndpointDeviceInterfaceResponse(EndpointDeviceInterface entity);

    @Mapping(target = "networkInterfaceId", source = "networkInterface.id")
    @Mapping(target = "endpointInterfaceId", source = "endpointInterface.id")
    EndpointNetworkAttachmentResponse toEndpointNetworkAttachmentResponse(EndpointNetworkAttachment entity);
}
