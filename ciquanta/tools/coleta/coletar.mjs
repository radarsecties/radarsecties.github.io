// Coleta diária do CRM do CIQUANTA. Roda todas as etapas, mesmo que alguma falhe, e registra o resultado em data/coleta.json.
// Uso: node tools/coleta/coletar.mjs [etapa ...]   (sem argumentos, roda todas)
import { execFileSync } from 'node:child_process';
import { ler, gravar, agora, RAIZ } from './lib.mjs';
import { coletarPainel } from './painel.mjs';
import { coletarSinais } from './sinais.mjs';
import { coletarCanais } from './canais.mjs';
import { coletarReceita } from './receita.mjs';

const ETAPAS = [
  ['painel', 'Painel CIQUANTA', coletarPainel],
  ['sinais', 'Notícias e editais', coletarSinais],
  ['canais', 'Canais institucionais e CNPJ', coletarCanais],
  ['receita', 'Dados da Receita Federal', coletarReceita],
  // A descoberta com IA carrega o SDK só quando há chave configurada
  ['descoberta', 'Descoberta com IA', async opts => (await import('./descoberta.mjs')).descobrir(opts)],
];

const pedidas = process.argv.slice(2);
const inicio = Date.now(), log = [];
const registro = ler('coleta.json', { execucoes: [] });
const etapas = [];
for (const [id, nome, fn] of ETAPAS) {
  if (pedidas.length && !pedidas.includes(id)) continue;
  const t = Date.now();
  try {
    const r = await fn({ log: m => { console.log(m); log.push(m); } });
    etapas.push({ id, nome, ok: true, ignorada: !!r?.ignorada, n: r?.n ?? 0, segundos: Math.round((Date.now() - t) / 1000), msg: log.at(-1) || '' });
  } catch (e) {
    console.error(`✗ ${nome}: ${e.message}`);
    etapas.push({ id, nome, ok: false, n: 0, segundos: Math.round((Date.now() - t) / 1000), msg: e.message });
  }
}

// Confere a integridade das bases antes de deixar o resultado ser publicado
let integridade = 'ok';
try { execFileSync(process.execPath, [RAIZ + 'tools/validar-dados.mjs'], { stdio: 'pipe' }); }
catch (e) { integridade = String(e.stderr || e.stdout || e.message).trim().split('\n').slice(-6).join(' '); console.error('✗ integridade: ' + integridade); }

const exec = { em: agora(), segundos: Math.round((Date.now() - inicio) / 1000), etapas, integridade };
registro.ultima = exec;
registro.execucoes = [exec, ...(registro.execucoes || [])].slice(0, 60);
gravar('coleta.json', registro);
const falhas = etapas.filter(e => !e.ok).length;
console.log(`\nColeta concluída em ${exec.segundos}s: ${etapas.length - falhas} etapa(s) com sucesso, ${falhas} com falha. Integridade: ${integridade === 'ok' ? 'ok' : 'com erro'}.`);
// Falha parcial não interrompe a publicação; integridade quebrada sim
process.exit(integridade === 'ok' ? 0 : 1);
