package org.rossijr.apicentral.mapper;

import org.mapstruct.InheritInverseConfiguration;
import org.mapstruct.MappingTarget;

import java.util.List;

public interface BaseMapper<E, D> {

    D toDto(E entity);

    E toEntity(D dto);

    List<D> toDto(List<E> entities);

    List<D> toDto(Iterable<E> entities);

    List<E> toEntity(List<D> dtos);

    @InheritInverseConfiguration(name = "toDto")
    void fromDto(D dto, @MappingTarget E entity);

}
