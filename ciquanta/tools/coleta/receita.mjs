// Dados cadastrais da Receita Federal (CNPJ) pelas bases públicas, para as organizações cujo CNPJ é conhecido.
// O CNPJ vem do próprio mapeamento ou do rodapé do site oficial (canais.json).
import { baixar, ler, gravar, agora, organizacoes, sleep } from './lib.mjs';

const LOTE = Number(process.env.CIQUANTA_LOTE_RECEITA || 80), REVISAO_DIAS = 30;
const FONTES = [
  c => `https://brasilapi.com.br/api/cnpj/v1/${c}`,
  c => `https://minhareceita.org/${c}`,
];

export const resumir = (j, cnpj) => ({
  cnpj, razao: j.razao_social || '', fantasia: j.nome_fantasia || '', situacao: j.descricao_situacao_cadastral || '',
  cnae: String(j.cnae_fiscal || ''), cnaeDesc: j.cnae_fiscal_descricao || '', porte: j.porte || j.descricao_porte || '',
  natureza: j.natureza_juridica || '', municipio: j.municipio || '', uf: j.uf || '', capital: Number(j.capital_social) || 0,
  abertura: j.data_inicio_atividade || '', atualizadoEm: agora(),
});

export async function coletarReceita({ log = console.log } = {}) {
  const canais = ler('canais.json', { porOrg: {} }).porOrg;
  const base = ler('receita.json', { porOrg: {} });
  const limite = new Date(Date.now() - REVISAO_DIAS * 864e5).toISOString();
  const alvo = organizacoes().map(o => ({ id: o.id, cnpj: String(o.cnpj || canais[o.id]?.cnpj || '').replace(/\D/g, '') }))
    .filter(o => o.cnpj.length === 14 && (!base.porOrg[o.id] || base.porOrg[o.id].atualizadoEm < limite || base.porOrg[o.id].cnpj !== o.cnpj))
    .slice(0, LOTE);
  let ok = 0, erros = 0;
  for (const o of alvo) {
    let feito = false;
    for (const f of FONTES) {
      try { base.porOrg[o.id] = resumir(await baixar(f(o.cnpj), { tipo: 'json', timeout: 15000 }), o.cnpj); ok++; feito = true; break; }
      catch (e) { if (e.status === 404) break; }
    }
    if (!feito) erros++;
    await sleep(1300); // as bases públicas limitam o ritmo de consultas
  }
  base.atualizadoEm = agora();
  gravar('receita.json', base);
  log(`receita: ${ok} CNPJ atualizados, ${erros} sem resposta · base: ${Object.keys(base.porOrg).length} organizações com dados cadastrais`);
  return { n: ok, erros };
}
