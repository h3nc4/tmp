package org.rossijr.apicentral.entity;


import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrimaryKeyJoinColumn;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@Entity
@Table(name = "tb_vehicle", schema = "api_central")
public class Vehicle {

    @Id
    @Column(name = "id_vehicle", nullable = false)
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tx_plate", nullable = false)
    private String plate;

    @OneToOne
    @PrimaryKeyJoinColumn(name = "id_program_card")
    private ProgramCard programCardAssigned;
}
