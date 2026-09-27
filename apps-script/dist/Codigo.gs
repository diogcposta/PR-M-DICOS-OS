/**
 * Clinical Production Dashboard — Google Apps Script.
 *
 * Pontos de entrada chamados pelo Google. A lógica está em "Servidor.gs"
 * (gerado a partir do código TypeScript do repositório — não editar à mão).
 *
 * Primeira utilização:
 *   1. Executar "configurar" (autoriza o acesso à folha e cria os separadores).
 *   2. Opcional: executar "carregarDemonstracao" para ver dados de exemplo.
 *   3. Implementar > Nova implementação > Aplicação Web
 *      (Executar como: Eu · Quem tem acesso: Apenas eu).
 */

/** Serve a aplicação web (abre no iPhone, iPad ou computador). */
function doGet(e) {
  return PM.doGet(e);
}

/** Único ponto de entrada da aplicação: google.script.run.api(operacao, argumentos). */
function api(operacao, argumentos) {
  return PM.api(operacao, argumentos);
}

/** Cria os separadores da folha e o perfil com os valores iniciais. Pode ser repetido. */
function configurar() {
  Logger.log(PM.setup());
}

/** Substitui os registos pelos dados de demonstração sintéticos (setembro de 2026). */
function carregarDemonstracao() {
  Logger.log(PM.loadDemo());
}
