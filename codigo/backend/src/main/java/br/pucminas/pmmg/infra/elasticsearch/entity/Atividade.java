package br.pucminas.pmmg.infra.elasticsearch.entity;

import co.elastic.clients.util.DateTime;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;

import java.util.UUID;

@Document(indexName = "atividade")
public class Atividade {
    @Id
    private UUID id;
    private String local;
    private DateTime horario;
    private String atividade;
    private String observacoes;
}
