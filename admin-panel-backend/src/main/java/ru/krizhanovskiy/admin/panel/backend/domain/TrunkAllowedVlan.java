package ru.krizhanovskiy.admin.panel.backend.domain;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "trunk_allowed_vlan")
@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class TrunkAllowedVlan {

    @EmbeddedId
    @EqualsAndHashCode.Include
    private TrunkAllowedVlanId id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("interfaceId")
    @JoinColumn(name = "interface_id", nullable = false)
    private DeviceInterface deviceInterface;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("vlanId")
    @JoinColumn(name = "vlan_id", nullable = false)
    private Vlan vlan;
}
