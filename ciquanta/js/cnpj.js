// Consulta de CNPJ em bases públicas da Receita Federal (BrasilAPI, com alternativas)
import { onlyDigits, validCNPJ } from './util.js';

const FONTES = [
  { nome: 'BrasilAPI', url: c => `https://brasilapi.com.br/api/cnpj/v1/${c}` },
  { nome: 'Minha Receita', url: c => `https://minhareceita.org/${c}` },
  { nome: 'CNPJ.ws', url: c => `https://publica.cnpj.ws/cnpj/${c}` },
];

const cap = s => String(s || '').toLowerCase().replace(/(^|\s|\/|-)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E|Em)\b/g, w => w.toLowerCase()).replace(/\b(S\.?a\.?|Ltda|Me|Epp)\b/gi, w => w.toUpperCase());
const tel = (ddd, n) => { const d = onlyDigits(`${ddd || ''}${n || ''}`); return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : ''; };

function normaliza(j, fonte) {
  if (j.estabelecimento) { // CNPJ.ws
    const e = j.estabelecimento;
    return {
      fonte, cnpj: onlyDigits(e.cnpj), razao: j.razao_social, fantasia: e.nome_fantasia || '', uf: e.estado?.sigla || '', municipio: e.cidade?.nome || '',
      email: (e.email || '').toLowerCase(), telefone: tel(e.ddd1, e.telefone1), telefone2: tel(e.ddd2, e.telefone2),
      cnae: e.atividade_principal?.id || '', cnaeDesc: e.atividade_principal?.descricao || '', porte: j.porte?.descricao || '',
      situacao: e.situacao_cadastral || '', abertura: e.data_inicio_atividade || '', capital: Number(j.capital_social) || 0,
      endereco: [e.tipo_logradouro, e.logradouro, e.numero, e.bairro].filter(Boolean).join(' '), cep: e.cep || '',
      socios: (j.socios || []).map(s => ({ nome: s.nome, qualificacao: s.qualificacao_socio?.descricao || '' })),
    };
  }
  const t1 = j.ddd_telefone_1 || '', t2 = j.ddd_telefone_2 || '';
  return {
    fonte, cnpj: onlyDigits(j.cnpj), razao: j.razao_social, fantasia: j.nome_fantasia || '', uf: j.uf || '', municipio: j.municipio || '',
    email: (j.email || j.correio_eletronico || '').toLowerCase(), telefone: tel('', t1), telefone2: tel('', t2),
    cnae: String(j.cnae_fiscal || ''), cnaeDesc: j.cnae_fiscal_descricao || '', porte: j.descricao_porte || j.porte || '',
    situacao: j.descricao_situacao_cadastral || j.situacao_cadastral || '', abertura: j.data_inicio_atividade || '', capital: Number(j.capital_social) || 0,
    endereco: [j.descricao_tipo_de_logradouro || j.descricao_tipo_logradouro, j.logradouro, j.numero, j.bairro].filter(Boolean).join(' '), cep: j.cep || '',
    socios: (j.qsa || []).map(s => ({ nome: s.nome_socio || s.nome, qualificacao: s.qualificacao_socio || s.descricao_qualificacao_socio || '' })),
  };
}

export async function consultarCNPJ(cnpj) {
  const c = onlyDigits(cnpj);
  if (!validCNPJ(c)) throw new Error('CNPJ inválido (confira os dígitos).');
  const erros = [];
  for (const f of FONTES) {
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(f.url(c), { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      clearTimeout(t);
      if (r.status === 404) throw new Error('CNPJ não encontrado');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const n = normaliza(await r.json(), f.nome);
      n.razao = cap(n.razao); n.fantasia = cap(n.fantasia); n.municipio = cap(n.municipio);
      n.socios = n.socios.map(s => ({ ...s, nome: cap(s.nome) }));
      return n;
    } catch (e) { erros.push(`${f.nome}: ${e.name === 'AbortError' ? 'tempo esgotado' : e.message}`); }
  }
  throw new Error('Não foi possível consultar o CNPJ. ' + erros.join(' · '));
}

/** Sugere o setor do CRM a partir do CNAE. */
export function setorPorCnae(t) {
  const n = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const R = [[/banco|credito|financ|pagamento|corretora|investimento|bolsa/, 'financeiro'], [/seguro|previdencia|ressegur/, 'seguros'], [/hospital|saude|farmac|medicament|diagnost|laborator/, 'saude'],
    [/agricult|pecuar|soja|graos|fertiliz|defensiv|sement|abate|frigorif|aliment/, 'agro'], [/energia eletrica|geracao de energia|transmissao de energia|distribuicao de energia/, 'energia'],
    [/petroleo|gas natural|refino|combustiv|etanol/, 'oleo-gas'], [/minerio|mineracao|extracao de|siderur|metalurg/, 'mineracao'], [/quimic|petroquim|cosmet|celulose|papel/, 'quimica'],
    [/semicondut|componentes eletronicos|equipamentos de informatica|computadores/, 'semicondutores'], [/veiculos|automove|autopec|caminhoes/, 'automotivo'], [/aeronave|aeroespac|defesa|armamento/, 'aeroespacial'],
    [/telecomunica|telefonia|internet|certificacao digital/, 'telecom'], [/software|tecnologia da informacao|processamento de dados|computacao/, 'tic'], [/transporte|logistic|armazenamento|portuar|ferrovi|aere/, 'logistica'],
    [/comercio varejista|supermercado|varejo/, 'varejo'], [/fabricacao|industria/, 'industria']];
  for (const [re, id] of R) if (re.test(n)) return id;
  return '';
}

/** Converte o resultado da Receita no formato de organização do CRM. */
export function paraOrganizacao(r) {
  return {
    nome: r.razao, nomeFantasia: r.fantasia, cnpj: r.cnpj, uf: r.uf, municipio: r.municipio, cidade: r.municipio,
    email: r.email, telefone: r.telefone, setor: setorPorCnae(`${r.cnae} ${r.cnaeDesc}`), cnae: `${r.cnae} ${r.cnaeDesc}`.trim(), porte: r.porte,
    receita: { situacao: r.situacao, abertura: r.abertura, capital: r.capital, endereco: r.endereco, cep: r.cep, socios: r.socios, consultadoEm: new Date().toISOString(), fonte: r.fonte },
  };
}
