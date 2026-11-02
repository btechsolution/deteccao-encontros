# Detector de Encontros por Geolocalização

Sistema desenvolvido em **TypeScript (Node.js)** com uma interface web complementar para processamento de dados de rastreamento (tornozeleiras eletrônicas e rastreadores portáteis), com o objetivo de detectar encontros físicos entre indivíduos com base na **Fórmula de Haversine** e regras de negócio específicas.

---

## 💡 Sobre a Solução

O principal desafio deste projeto é cruzar registros de posições geográficas de forma extremamente performática, respeitando o limite de proximidade de **20 metros** e garantindo que apenas registros do **exato mesmo timestamp** sejam comparados.

Para resolver isso de forma eficiente, a lógica foi estruturada em três pilares principais:

1. **Processamento em Stream:** A leitura dos arquivos `.txt` é feita linha por linha (`readline`). Isso evita o consumo excessivo de memória RAM, permitindo processar datasets grandes sem engasgos.

2. **Indexação Temporal:** Os dados são agrupados em memória por frações de tempo idênticas (`timestamp`). Assim, o algoritmo descarta instantaneamente qualquer comparação entre entidades que não estavam ativas no mesmo segundo.

3. **Pares Únicos e Matemática Otimizada:** Para cada timestamp, percorremos as combinações possíveis de duplas evitando duplicatas (`i < j`) e ordenando os IDs no resultado. A distância é calculada utilizando a fórmula de Haversine adaptada para o raio esférico da Terra ($6.371.000$ metros). Além disso, a aplicação identifica automaticamente se o encontro se enquadra nas regras de **Medida Protetiva**, **Facção** ou **Genérico**.

---

## 🖥️ Nova Interface de Consulta (Dashboard Web)

Além do script de processamento em lote, o projeto conta agora com um **painel interativo em HTML/Tailwind CSS** (`index.html`) localizado na raiz do projeto. 

Com ele, você pode:

* Carregar qualquer arquivo de saída gerado (`respostasX.json`).

* Visualizar estatísticas rápidas dos encontros detectados.

* Filtrar os resultados por tipo de encontro ou buscar por IDs específicos de monitorados em tempo real, facilitando a auditoria e a validação visual dos dados.

---

## 🛠️ Como Executar o Projeto

### Pré-requisitos
Certifique-se de ter o **Node.js** instalado na sua máquina (versão 18 ou superior recomendada).

### 1. Instalação das Dependências
Na pasta raiz do projeto, instale as dependências e as tipagens necessárias do Node:
```bash
npm install