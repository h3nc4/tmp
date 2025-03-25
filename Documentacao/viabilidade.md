# Estudo de Viabilidade para o Sistema HookCI

Data: 16 de março de 2025
Autores: Gabriel Dolabela e Henrique Almeida

## Introdução

O presente Estudo de Viabilidade tem como objetivo demonstrar a pertinência e o potencial impacto do Sistema HookCI, uma ferramenta inovadora que integra a prática de Integração Contínua diretamente ao ambiente local de desenvolvimento. Em um cenário em que a qualidade do código e o feedback ágil são fatores cruciais para o sucesso dos projetos de software, a proposta do HookCI visa evitar que *commits* ou *pushes* com falhas sejam enviados para o repositório remoto. Dessa forma, a ferramenta atua como uma camada preventiva, garantindo um ciclo de desenvolvimento mais seguro, eficiente e alinhado com as melhores práticas de engenharia de software.

## Contexto e Justificativa

Em projetos de desenvolvimento, métodos tradicionais de Integração Contínua, como os oferecidos por plataformas remotas (ex.: GitHub Actions, GitLab CI), são frequentemente afetados por desafios como a latência no feedback e a dependência de servidores externos. Esses fatores podem atrasar a identificação de erros, aumentar os custos do projeto e comprometer a produtividade das equipes.

A necessidade de uma solução que execute testes e validações de maneira local desponta nesse contexto, pois permite:

1. Feedback Imediato: Ao executar os testes localmente, os desenvolvedores podem identificar e corrigir erros de forma instantânea, antes mesmo de compartilhar as alterações com a equipe.

2. Redução da Sobrecarga em Servidores Externos: A execução dos testes em ambiente controlado localmente minimiza a dependência de infraestrutura remota, contribuindo para a economia de recursos e melhor desempenho.

3. Aumento da Confiabilidade do Código: Garantir que apenas códigos que atendam aos critérios de qualidade sejam integrados ao repositório central previne retrabalhos e erros que possam afetar a estabilidade do sistema.

Esses pontos justificam a proposta do Sistema HookCI, a qual está alinhada à ênfase no processo de desenvolvimento e gerenciamento de software, conforme previsto na Sessão de Ferramentas de suporte à Engenharia de Software. Assim, o software está alinhado ao item 3.2.2.1 da Resolução do Trabalho de Conclusão de Curso I.

## Proposta de Solução

O Sistema HookCI propõe a implementação de uma ferramenta que utiliza os *Git Hooks* como *pre-commit* e *pre-push* para disparar a execução de testes automatizados de forma local. Diferentemente das soluções tradicionais, nas quais o processamento é realizado em servidores remotos, o HookCI realiza a validação do código no próprio ambiente de desenvolvimento do usuário, garantindo que somente alterações aprovadas avancem para o repositório central.

A ferramenta foi concebida para ser de fácil integração com qualquer projeto, independentemente da linguagem ou ambiente de desenvolvimento utilizado. Entre as principais funcionalidades, destacam-se:

1. Execução Local de Testes: Por meio dos *Git Hooks*, os testes são automaticamente disparados antes que o código seja commitado ou enviado para o repositório remoto.

2. Ambiente Isolado com Docker: Para assegurar a consistência dos resultados e isolar as dependências, os testes são executados em containers Docker. Essa abordagem permite a montagem do diretório atual do repositório no container, simulando fielmente o ambiente previsto.

3. Configuração Flexível via YAML: Um arquivo de configuração no formato YAML possibilita que os usuários definam variáveis de ambiente, comandos de teste e parâmetros específicos, tornando a ferramenta adaptável às particularidades de cada projeto.

4. Interface de Linha de Comando: O HookCI oferece uma interface intuitiva que permite a execução manual dos testes, bem como a visualização de detalhes nessas operações, facilitando a rastreabilidade e a análise dos resultados.

5. Integração Natural ao Fluxo de Trabalho: A utilização dos *Git Hooks* possibilita uma integração sem atritos com os sistemas de versionamento já existentes, de modo que os desenvolvedores não precisem alterar suas práticas habituais.

## Análise de Riscos

### Listagem de Riscos

1. Compatibilidade e Integração: Garantir que a ferramenta opere de forma consistente em diferentes ambientes de desenvolvimento pode representar um desafio, especialmente considerando a variedade de distribuições GNU/Linux e suas configurações.

2. Adoção pelos Desenvolvedores: A implementação de um novo processo de validação pode encontrar resistência inicial por parte de desenvolvedores acostumados com métodos tradicionais.

### Mitigação de Riscos

1. Distribuição Padronizada: Serão distribuídos binários através do pyinstaller, que congela todo o ambiente Python dentro de um arquivo do tipo *Executable and Linkable Format* (ELF). Essa abordagem garante um ambiente padronizado para a execução da aplicação.

2. Documentação Detalhada: Será desenvolvida uma documentação abrangente, incluindo instruções avançadas, exemplos de uso, opções de configuração e manutenção, por meio de *manpages*, método consolidado de documentar software em sistemas GNU/Linux.

## Conclusão

Neste documento, evidenciamos como a implementação do Sistema HookCI pode contribuir positivamente para a Engenharia de Software. Ao integrar testes automatizados ao ambiente de desenvolvimento local, a ferramenta oferece feedback imediato, reduz a dependência de servidores externos e promove a confiabilidade do código. Desta forma, o Sistema HookCI pode agregar valor tanto para equipes de desenvolvimento quanto para a manutenção e evolução de sistemas complexos.
