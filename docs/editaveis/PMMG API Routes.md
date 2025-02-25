# Documentação da API - Sistema de Cartões-Programa PMMG

Este documento apresenta a documentação da API responsável pela automatização e gerenciamento dos cartões-programa na PMMG, detalhando rotas, métodos e parâmetros para facilitar a integração e a otimização dos processos operacionais.

---

## Endpoints

### 1. Gerar Sugestão de Cartão-Programa
**Rota:** `/cartao-programa/sugestao`  
**Método:** `POST`  
**Descrição:** Gera uma sugestão de cartão-programa com base nos índices criminais de um setor específico, facilitando o planejamento das atividades da viatura.  
**Parâmetros:**

- **setor**  
  - **Local:** Body Param  
  - **Tipo:** `string`  
  - **Descrição:** Identificador ou nome do setor para o qual a sugestão será gerada.
- **data**  
  - **Local:** Body Param  
  - **Tipo:** `string` (formato `YYYY-MM-DD`)  
  - **Descrição:** Data para a qual o cartão-programa será sugerido.

- **executorId**
	- **Local:** Body Param
	- **Tipo:** String
	- **Descrição:** Id do policial que o cartão programa é atribuído.

---

### 2. Obter Detalhes do Cartão-Programa
**Rota:** `/cartao-programa/{id}`  
**Método:** `GET`  
**Descrição:** Retorna as informações detalhadas de um cartão-programa específico, permitindo que tanto Gestores quanto Executores visualizem os dados completos.  
**Parâmetros:**

- **id**  
  - **Local:** Route Param  
  - **Tipo:** `string`  
  - **Descrição:** Identificador único do cartão-programa.

---

### 3. Editar Cartão-Programa
**Rota:** `/cartao-programa/{id}`  
**Método:** `PUT`  
**Descrição:** Permite que o Gestor edite um cartão-programa previamente gerado ou sugerido, ajustando atividades ou outras informações conforme necessário. Somente Tenentes e Majores da PMMG podem realizar essa ação.  
**Parâmetros:**

- **id**  
  - **Local:** Route Param  
  - **Tipo:** `string`  
  - **Descrição:** Identificador único do cartão-programa a ser editado.

- **atividades**  
     - **Local:** Body Param  
     - **Tipo:** `array` de `string`  
     - **Descrição:** Lista das atividades planejadas.
   
 - **observacoes**  
      - **Local:** Body Param
      - **Tipo:** `string`  
      - **Descrição:** Comentários ou observações adicionais sobre o cartão-programa.

- **executorId**
	- **Local:** Body Param
	- **Tipo:** String
	- **Descrição:** Id do policial que o cartão programa é atribuído.

---

### 4. Exportar Cartão-Programa como PDF
**Rota:** `/cartao-programa/{id}/export/pdf`  
**Método:** `GET`  
**Descrição:** Gera e retorna um arquivo PDF editável do cartão-programa, facilitando a impressão e distribuição.  
**Parâmetros:**

- **id**  
  - **Local:** Route Param  
  - **Tipo:** `string`  
  - **Descrição:** Identificador único do cartão-programa a ser exportado.

---

### 5. Exportar Cartão-Programa como JSON
**Rota:** `/cartao-programa/{id}/export/json`  
**Método:** `GET`  
**Descrição:** Retorna os dados do cartão-programa em formato JSON, permitindo integrações e análises posteriores.  
**Parâmetros:**

- **id**  
  - **Local:** Route Param  
  - **Tipo:** `string`  
  - **Descrição:** Identificador único do cartão-programa.

---

### 6. Buscar Cartão-Programa por Identificador Único
**Rota:** `/cartao-programa/busca`  
**Método:** `GET`  
**Descrição:** Permite que o Gestor busque um cartão-programa utilizando seu identificador único, facilitando a recuperação de dados e análises de eficiência.  
**Parâmetros:**

- **identificador**  
  - **Local:** Query Param  
  - **Tipo:** `string`  
  - **Descrição:** Identificador único do cartão-programa utilizado na busca.

---

### 7. Visualizar Cartão-Programa (Executor)
**Rota:** `/cartao-programa/{id}/visualizacao`  
**Método:** `GET`  
**Descrição:** Retorna uma lista de cartões de programas que foram atribuídos àquele executor.
**Parâmetros:**

- **id**  
  - **Local:** Route Param  
  - **Tipo:** `string`  
  - **Descrição:** Identificador único do executor.

---

### 8. Visualizar Rota da Atividade em um Mapa (Executor)
**Rota:** `/cartao-programa/{id}/rota`  
**Método:** `GET`  
**Descrição:** Fornece os dados necessários para a visualização da rota das atividades em um mapa, integrando com a API do OpenStreetMap.  
**Parâmetros:**

- **id**  
  - **Local:** Route Param  
  - **Tipo:** `string`  
  - **Descrição:** Identificador único do cartão-programa.



