"""
Camada editorial opcional do Radar SECTIES.

Sem chave configurada, o Radar funciona 100% com as regras automáticas: os cartões
mostram o título e o resumo originais da fonte. Com a variável de ambiente
RADAR_CHAVE_EDITORIAL (um segredo do GitHub), esta etapa reescreve em português
simples a manchete, a leitura do dia, os títulos/resumos das notícias escolhidas
e sugere as "Ideias para debate". O texto produzido segue a regra de conteúdo
oficial e nunca cita o fornecedor do serviço.

Se a chamada falhar por qualquer motivo, o Radar segue com o automático.
"""

import json
import os
import re

import requests

ENDERECO = os.environ.get("RADAR_EDITORIAL_URL", "https://api.anthropic.com/v1/messages")
MODELO = os.environ.get("RADAR_EDITORIAL_MODELO", "claude-sonnet-4-6")

INSTRUCOES = """Você é o editor do Radar SECTIES, clipping diário de ciência, tecnologia, inovação e ensino superior da SECTIES-PB (Secretaria de Estado da Ciência, Tecnologia, Inovação e Ensino Superior da Paraíba), que tem a FAPESQ como fundação vinculada. O leitor não é técnico. Escreva em português simples, frases curtas, sem jargão, sem emojis. Explique siglas na primeira vez. Nunca copie frases das fontes: parafraseie. Não invente números, datas ou nomes: use só o que está nos itens.

REGRA DE CONTEÚDO OFICIAL: cite apenas programas da SECTIES com divulgação pública (CIQUANTA, Cidade da Astronomia; exceção permitida: SecretarIA 2030). Nada interno ou em negociação. O site é público. Não escreva o nome de nenhuma empresa de inteligência artificial nem do modelo que você é.

Responda SOMENTE com um JSON válido, sem comentários nem cercas de código, neste formato:
{
 "destaque": "manchete do dia, até 70 caracteres, forte e institucional",
 "leitura": "2 a 3 frases curtas (até 380 caracteres). A primeira frase em tom público e sóbrio, sem 'para a SECTIES'.",
 "itens": {"<id>": {"titulo": "título novo, claro e informativo", "resumo": "2 frases curtas", "porQueImporta": "1 frase"}},
 "propostas": [{"id": "p-slug", "titulo": "...", "tipo": "Política|Projeto|Programa|Parceria|Edital", "horizonte": "Curto prazo|Médio prazo|Longo prazo", "programas": ["ids"], "descricao": "2 frases curtas", "base": ["ids de itens"]}]
}
Escreva de 5 a 8 propostas concretas e curtas para a SECTIES/Paraíba apoiadas nos itens (pelo menos uma de tecnologia para outra secretaria). Evite repetir as propostas recentes listadas."""


def disponivel() -> bool:
    return bool(os.environ.get("RADAR_CHAVE_EDITORIAL"))


def editar(itens: list[dict], propostas_recentes: list[str], programas: dict) -> dict | None:
    if not disponivel():
        return None
    compacto = [{"id": i["id"], "titulo": i["titulo"], "resumo": i.get("resumo", ""), "fonte": i["fonte"],
                 "escopo": i["escopo"], "relevancia": i["relevancia"], "programas": i["programas"], "url": i["url"]}
                for i in itens]
    pedido = {
        "model": MODELO,
        "max_tokens": 6000,
        "system": INSTRUCOES,
        "messages": [{"role": "user", "content":
            "Ids de programas válidos: " + json.dumps(programas, ensure_ascii=False) +
            "\n\nPropostas recentes (não repetir): " + json.dumps(propostas_recentes[-60:], ensure_ascii=False) +
            "\n\nItens da edição de hoje:\n" + json.dumps(compacto, ensure_ascii=False)}],
    }
    try:
        r = requests.post(ENDERECO, timeout=180, json=pedido, headers={
            "x-api-key": os.environ["RADAR_CHAVE_EDITORIAL"],
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        })
        r.raise_for_status()
        texto = "".join(b.get("text", "") for b in r.json().get("content", []))
        texto = re.sub(r"^```(json)?|```$", "", texto.strip(), flags=re.M).strip()
        dados = json.loads(texto)
    except Exception as exc:
        print(f"[editorial] etapa ignorada: {exc.__class__.__name__}: {exc}")
        return None
    # proteção extra: o site nunca cita o fornecedor
    bruto = json.dumps(dados, ensure_ascii=False)
    if re.search(r"claude|anthropic", bruto, re.I):
        bruto = re.sub(r"claude|anthropic", "", bruto, flags=re.I)
        dados = json.loads(bruto)
    return dados
