# Clinical Production Dashboard — versão Google Apps Script (iPhone)

A mesma aplicação de análise de produção clínica, a correr **gratuitamente na sua conta Google**:

- a app abre no **iPhone** (Safari), iPad e computador, a partir de um endereço privado do Google;
- os dados ficam numa **folha Google Sheets** sua (um separador por tabela);
- só **a sua conta Google** tem acesso (implementação "Apenas eu");
- os cálculos são os mesmos da versão local (código partilhado e testado).

Sem dados identificáveis de pacientes: apenas Case IDs (`DC-2026-001`).

---

## Instalar (10 minutos, uma única vez)

Precisa apenas de uma conta Google. Os 4 ficheiros a copiar estão em **`apps-script/dist/`**.

### 1. Criar a folha e o projeto

1. Em [sheets.new](https://sheets.new) crie uma folha nova e dê-lhe um nome, por exemplo **Produção clínica**.
2. Menu **Extensões › Apps Script**. Abre o editor, já ligado a esta folha.

### 2. Copiar os ficheiros

No editor do Apps Script:

| No editor | Conteúdo a colar |
|---|---|
| Ficheiro `Código.gs` que já existe (renomeie para **Codigo**) | `dist/Codigo.gs` |
| **+ › Script** com o nome **Servidor** | `dist/Servidor.gs` |
| **+ › HTML** com o nome **Index** | `dist/Index.html` |
| ⚙ **Definições do projeto** › marcar *Mostrar ficheiro de manifesto "appsscript.json"* e depois substituir o conteúdo de `appsscript.json` | `dist/appsscript.json` |

Guarde (⌘/Ctrl + S).

> Dica: no GitHub, abra cada ficheiro em `apps-script/dist/`, clique em **Raw** e copie tudo (⌘/Ctrl + A, ⌘/Ctrl + C).

### 3. Configurar

1. No topo do editor escolha a função **configurar** e clique **Executar**.
2. O Google pede autorização: *Rever permissões* › escolha a sua conta › *Avançadas* › *Aceder a … (não seguro)* › *Permitir*.
   (Aparece "não seguro" porque o script é seu e não foi verificado pela Google; só pede acesso às folhas de cálculo.)
3. Opcional: execute **carregarDemonstracao** para ver os dados de exemplo (setembro de 2026: €8.619 em 130,5 h).
   Pode apagá-los depois em **Mais › Dados › Apagar todos os registos**.

### 4. Publicar como aplicação web

1. **Implementar › Nova implementação** › ícone ⚙ › **Aplicação Web**.
2. *Executar como*: **Eu** · *Quem tem acesso*: **Apenas eu**.
3. **Implementar** e copie o **URL da aplicação Web** (termina em `/exec`).

### 5. Abrir no iPhone

1. Envie o URL para si próprio (Notas, email, AirDrop) e abra-o no **Safari** do iPhone.
2. Inicie sessão na mesma conta Google, se for pedido.
3. Toque em **Partilhar › Adicionar ao ecrã principal**. Fica com um ícone como uma app.

---

## Atualizar para uma versão nova

1. Substitua o conteúdo de `Servidor.gs` e `Index` pelos novos `dist/Servidor.gs` e `dist/Index.html`.
2. **Implementar › Gerir implementações** › ✏ › *Versão*: **Nova versão** › **Implementar**.
   O URL mantém-se.

Os dados na folha não são tocados.

### Alternativa para quem usa o terminal: `clasp`

```bash
npm run gas:build
cd apps-script
cp .clasp.json.example .clasp.json     # colocar o scriptId (Definições do projeto › ID do script)
npx @google/clasp login
npx @google/clasp push
```

---

## Utilização

A barra inferior tem **Início** (dashboard), **Registar** (procedimento em < 20 s), **Agenda**, **Planos** e
**Mais** (procedimentos, dias clínicos, faltas, rentabilidade, seguros, What if?, tendências, relatório,
definições, dados). Tudo o resto funciona como na versão local — ver o [README principal](../README.md).

- Cada gravação demora 1–2 s (é o tempo do Google Apps Script). A primeira abertura do dia pode demorar mais.
- É preciso ligação à internet.
- A folha pode ser aberta em **Mais › Dados › Abrir a folha**. Pode consultar e filtrar à vontade, mas
  **não altere os cabeçalhos** (primeira linha) nem as colunas `id`.
- Exportação CSV em **Mais › Dados** (formato compatível com a versão local).

### Estrutura da folha

| Separador | Conteúdo |
|---|---|
| Perfil, Horario, Objetivos, Cenarios, Templates | Definições |
| Dias | Dias clínicos (`data`, `inicio`, `fim`, `pausa_min`, `estado`) |
| Procedimentos | Um ato com uma receita (valores em **cêntimos**) |
| Consultas | Tempo de cadeira de cada procedimento (`procedimento_id`) |
| Faltas | Faltas e cancelamentos |
| Planos | Planos de tratamento |

Valores monetários em cêntimos inteiros (`60000` = €600). Datas `aaaa-mm-dd` e horas `HH:mm` guardadas como texto.

---

## Para programadores

O código fonte está em `apps-script/src/` (TypeScript) e reutiliza `src/modules/production`
(domínio, validação Zod e dados de demonstração):

```text
apps-script/
  src/server/   api.ts (operações), sheets.ts (Google Sheets), tables.ts (estrutura), entry.ts (Google)
  src/client/   main.ts (router), views/*, charts.ts (SVG), styles.css — sem framework
  src/preview/  folha simulada + google.script.run local
  src/Codigo.gs, appsscript.json, Index.template.html
  build.mjs     esbuild → dist/ (e .preview/ com --preview)
  dist/         ficheiros prontos a copiar (versionados; um teste garante que estão atualizados)
```

| Comando | O que faz |
|---|---|
| `npm run gas:build` | Gera `apps-script/dist/` |
| `npm run gas:preview` | Gera e serve a pré-visualização em http://localhost:3400 (folha simulada no browser; abra no iPhone pelo IP do computador) |
| `npm run test:producao` | Inclui os testes da API e dos ficheiros gerados (executados num contexto que simula o Apps Script) |
| `npm run test:e2e:gas` | Playwright sobre a pré-visualização, em tamanho iPhone e desktop |

Decisões: D-052 a D-057 em [`docs/DECISIONS.md`](../docs/DECISIONS.md).
