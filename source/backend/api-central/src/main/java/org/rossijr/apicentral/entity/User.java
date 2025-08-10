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
@Table(name = "tb_user", schema = "api_central")
public class User {

    @Id
    @Column(name = "id_user", nullable = false)
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tx_name", nullable = false)
    private String name;

    @Column(name = "tx_rank", nullable = false)
    private String rank;

    @Column(name = "is_manager", nullable = false)
    private boolean isManager;

    @OneToOne
    @PrimaryKeyJoinColumn(name = "id_program_card")
    private ProgramCard programCardAssigned;
}
