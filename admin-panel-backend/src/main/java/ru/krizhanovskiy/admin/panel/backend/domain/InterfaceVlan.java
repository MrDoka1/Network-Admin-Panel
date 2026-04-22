package ru.krizhanovskiy.admin.panel.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.InterfaceVlanMode;

import java.util.UUID;

@Entity
@Table(name = "interface_vlan")
@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class InterfaceVlan {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "interface_id", nullable = false, unique = true)
    private DeviceInterface deviceInterface;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private InterfaceVlanMode mode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "access_vlan_id")
    private Vlan accessVlan;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "native_vlan_id")
    private Vlan nativeVlan;
}
