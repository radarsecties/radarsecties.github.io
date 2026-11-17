// Totais públicos do Painel CIQUANTA (rede de cadastrados e visitas à réplica), com histórico diário.
// A fonte é a mesma do painel público e só traz números agregados, nenhum dado pessoal.
import { baixar, ler, gravar, agora, hoje } from './lib.mjs';

export const PAINEL_URL = process.env.CIQUANTA_PAINEL_URL || 'https://script.google.com/macros/s/AKfycbx1oLvENMRgjLYaUYICnUrHA-iP2R3B4yoIdeW7kID331zwaDR5dIVFC2RrC9xH4CJZCg/exec?painel=1';

export async function coletarPainel({ log = console.log } = {}) {
  const j = await baixar(PAINEL_URL, { tipo: 'json', timeout: 30000 });
  if (!j || j.ok === false || typeof j.total !== 'number') throw new Error('Resposta inesperada do Painel CIQUANTA');
  const hist = ler('painel.json', { historico: [] }).historico || [];
  const linha = { dia: hoje(), cadastros: j.total, pessoas: j.pessoas, instituicoes: j.instituicoes, ufs: j.ufs, previstos: j.prev, recebidos: j.rec };
  const h = [...hist.filter(x => x.dia !== linha.dia), linha].sort((a, b) => a.dia.localeCompare(b.dia)).slice(-400);
  gravar('painel.json', { coletadoEm: agora(), fonte: 'Painel CIQUANTA (painelciquanta.secties.pb.gov.br)', dados: j, historico: h });
  log(`painel: ${j.total} cadastros (${j.pessoas} pessoas, ${j.instituicoes} instituições, ${j.ufs} estados), ${j.prev} visitantes previstos, ${j.rec} já recebidos`);
  return { n: j.total };
}
