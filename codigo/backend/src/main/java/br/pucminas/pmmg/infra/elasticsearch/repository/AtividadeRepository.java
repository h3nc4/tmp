package br.pucminas.pmmg.infra.elasticsearch.repository;

import br.pucminas.pmmg.infra.elasticsearch.entity.Atividade;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

import java.util.UUID;

public interface AtividadeRepository extends ElasticsearchRepository<Atividade, UUID> {
}
