package ru.krizhanovskiy.admin.panel.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serial;
import java.io.Serializable;
import java.util.UUID;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class DeviceVlanId implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Column(name = "device_id", nullable = false)
    private UUID deviceId;

    @Column(name = "vlan_id", nullable = false)
    private Short vlanId;
}
