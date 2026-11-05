"""
Classificação das notícias do Radar SECTIES.

Dá a cada notícia:
  - tipo       : o tipo do cartão (edital, evento, norma, ciencia, inovacao, ensino,
                 quantica, ia-gov, patrimonio, inclusao, seguranca, oficial)
  - programas  : de 1 a 3 ids de programa/tema (os mesmos ids das edições antigas)
  - escopo     : Paraíba, Nacional ou Global
  - pontos     : número que mede quanto a notícia importa (serve para ordenar)
  - relevancia : alta, media ou radar (calculada depois, no main, para a edição inteira)

Tudo aqui é por regras de palavras, em português e inglês, sem serviço externo.
Para ajustar, mexa nas listas abaixo: cada palavra-chave vale os pontos indicados.
"""

import re
import unicodedata

# ----------------------------------------------------------------------------
# TIPOS DE CARTÃO (o que aparece no site como categoria visual)
# ----------------------------------------------------------------------------
TIPOS = {
    "edital":     {"rotulo": "Edital e fomento",        "cor": "#B3242D", "descricao": "Chamadas, bolsas, financiamento e prazos."},
    "evento":     {"rotulo": "Evento",                   "cor": "#C96A12", "descricao": "Feiras, congressos, cursos e inscrições."},
    "norma":      {"rotulo": "Política e norma",         "cor": "#5B3A8C", "descricao": "Leis, decretos, planos e decisões de governo."},
    "quantica":   {"rotulo": "Quântica",                 "cor": "#2F3AA6", "descricao": "Computação e tecnologias quânticas."},
    "ia-gov":     {"rotulo": "IA e governo digital",     "cor": "#0D6E8A", "descricao": "Inteligência artificial e serviços públicos digitais."},
    "inovacao":   {"rotulo": "Inovação e startups",      "cor": "#1E7A4A", "descricao": "Empreendedorismo, parques e compras de inovação."},
    "ensino":     {"rotulo": "Ensino superior",          "cor": "#8A5A00", "descricao": "Universidades, institutos, cursos e acesso."},
    "ciencia":    {"rotulo": "Ciência e pesquisa",       "cor": "#3D5A80", "descricao": "Descobertas, estudos e divulgação científica."},
    "patrimonio": {"rotulo": "Patrimônio",               "cor": "#7A4B2A", "descricao": "Acervos, museus e imóveis históricos."},
    "inclusao":   {"rotulo": "Inclusão digital",         "cor": "#2A7F7F", "descricao": "Conectividade e acesso à tecnologia."},
    "seguranca":  {"rotulo": "Segurança digital",        "cor": "#6B6B6B", "descricao": "Cibersegurança, dados pessoais e LGPD."},
    "oficial":    {"rotulo": "SECTIES e FAPESQ",         "cor": "#15171F", "descricao": "Pautas da secretaria e da fundação."},
}

# ----------------------------------------------------------------------------
# PROGRAMAS / TEMAS (ids iguais aos das edições anteriores do Radar)
# ----------------------------------------------------------------------------
PROGRAMAS = {
    "ciquanta":      "CIQUANTA",
    "secretaria2030": "SecretarIA 2030",
    "transversal":   "Tecnologia nas secretarias",
    "ensino":        "Ensino superior",
    "inovacao":      "Inovação",
    "patrimonio":    "Patrimônio",
    "astronomia":    "Cidade da Astronomia",
    "inclusao":      "Inclusão digital",
    "seguranca":     "Segurança digital",
    "fomento":       "Editais e fomento",
    "internacional": "Cooperação internacional",
}

# Palavras-chave por programa: (expressão, pontos). Minúsculas, sem acento.
REGRAS_PROGRAMA = {
    "ciquanta": [
        (r"\bquantic|\bquantum\b|\bqubit|post-quantum|pos-quantic|criptografia pos|ciquanta|chips? quantic|quantum chip|computador(es)? quantic", 6),
    ],
    "secretaria2030": [
        (r"\bia\b|inteligencia artificial|artificial intelligence|\bllm|modelos? de linguagem|chatbot|govtech|governo digital|gov\.br|servico publico digital|digital government|public sector ai|secretaria 2030", 4),
    ],
    "transversal": [
        (r"saude digital|telemedicina|prontuario|sus\b|hospital|ciatox|toxicolog|escola|educacao basica|seguranca publica|policia|agricultura|semiarido|meio ambiente|licenciamento|fazenda estadual|arrecadacao|administracao publica|prefeitura|municipi", 3),
    ],
    "ensino": [
        (r"universidade|university|universities|higher education|ensino superior|uepb|ufpb|ufcg|ifpb|instituto federal|campus|graduacao|pos-graduacao|mestrado|doutorado|vestibular|enem|sisu|prouni|fies|reitor|estudantes?|bolsas? de estudo|capes\b", 4),
    ],
    "inovacao": [
        (r"startup|inovacao|innovation|empreendedor|parque tecnologico|incubadora|aceleradora|venture|capital de risco|propriedade intelectual|patente|lei do bem|compra publica de inovacao|hub de inovacao|web summit|embrapii|sebrae", 4),
    ],
    "patrimonio": [
        (r"patrimonio|heritage|museu|museum|acervo|restauro|restauracao|tombad|iphan|iphaep|casarao|centro historico|arquivo historico|digitalizacao de acervo", 4),
    ],
    "astronomia": [
        (r"astronom|planetari|telescopi|observatori|nasa\b|\beso\b|exoplanet|galaxia|galaxy|satelite|satellite|espacial|space agency|divulgacao cientifica|cidade da astronomia", 4),
    ],
    "inclusao": [
        (r"inclusao digital|conectividade|banda larga|broadband|internet por satelite|starlink|5g|cobertura movel|wi-?fi|alfabetizacao digital|caminhos digitais|digital divide|anatel", 4),
    ],
    "seguranca": [
        (r"ciberseguran|cybersecur|seguranca da informacao|lgpd|dados pessoais|data protection|privacidade|privacy|ransomware|ataque hacker|vazamento|anpd\b|hacker", 4),
    ],
    "fomento": [
        (r"edital|chamada publica|chamada\b|call for proposals|funding|financiamento|fomento|bolsa|bolsista|subvencao|finep|cnpq|fapesq|fapesp|\bfap\b|confap|r\$ ?\d|milhoes|bilhoes|million|billion|apoio financeiro|recursos para|investimento", 3),
    ],
    "internacional": [
        (r"china|chines|chinese|cooperacao internacional|international cooperation|acordo bilateral|uniao europeia|european union|ocde|oecd|unesco|onu\b|\bun\b|banco mundial|world bank|bid\b|cepal|intercambio|delegacao|embaixada|portugal|lisboa", 3),
    ],
}

# Palavras-chave por tipo de cartão: (expressão, pontos).
REGRAS_TIPO = {
    "edital": [
        (r"edital|chamada publica|call for proposals|inscricoes? (abertas?|ate|vao ate|terminam)|prazo (para|termina|vai ate|final)|submissao|propostas? ate|selecao de bolsistas|bolsas? (de|para)|financiamento|funding (call|opportunity)|subvencao|credito|linha de credito|repasse", 5),
    ],
    "evento": [
        (r"congresso|conference|seminario|workshop|oficina|palestra|feira|expo\b|expotec|summit|simposio|semana (de|da|do)|encontro|hackathon|curso gratuito|mesa-redonda|webinar|inscricoes para o|acontece (em|nesta|hoje|amanha)|programacao", 5),
    ],
    "norma": [
        (r"\blei\b|decreto|portaria|resolucao|medida provisoria|projeto de lei|\bpl\b|regulament|regulation|regulatory|politica (nacional|estadual|publica)|plano (nacional|estadual)|marco legal|estrategia nacional|sancion|aprova|aprovad|assembleia|senado|camara dos deputados|congresso nacional|governo (federal|estadual) (lanca|anuncia|cria)|ministerio", 4),
    ],
    "quantica": [
        (r"quantic|quantum|qubit|ciquanta|post-quantum|pos-quantic", 7),
    ],
    "ia-gov": [
        (r"inteligencia artificial|artificial intelligence|\bia\b|\bai\b|\bllm|modelos? de linguagem|chatbot|govtech|governo digital|digital government|gov\.br|automacao|algoritm|machine learning|aprendizado de maquina|generative|generativ", 5),
    ],
    "inovacao": [
        (r"startup|inovacao|innovation|empreendedor|parque tecnologico|incubadora|aceleradora|web summit|embrapii|hub\b|ecossistema|venture|patente", 5),
    ],
    "ensino": [
        (r"universidade|university|universities|higher education|ensino superior|uepb|ufpb|ufcg|ifpb|instituto federal|campus|graduacao|pos-graduacao|reitor|vestibular|enem|sisu|capes\b|ranking", 5),
    ],
    "ciencia": [
        (r"pesquisa|research|cientist|scientist|estudo (mostra|aponta|revela|indica)|study (finds|shows)|descobert|discover|laboratorio|experimento|fisica|physics|biologia|quimica|chemistry|nature\b|science\b|sbpc|astronom|telescop|planetari|nasa|espaco|space", 3),
    ],
    "patrimonio": [
        (r"patrimonio|heritage|museu|museum|acervo|restauro|restauracao|tombad|iphan|iphaep|casarao|centro historico", 6),
    ],
    "inclusao": [
        (r"inclusao digital|conectividade|banda larga|broadband|internet por satelite|starlink|5g|cobertura movel|caminhos digitais|digital divide|alfabetizacao digital", 6),
    ],
    "seguranca": [
        (r"ciberseguran|cybersecur|seguranca da informacao|lgpd|dados pessoais|data protection|privacidade|privacy|ransomware|hacker|anpd\b", 6),
    ],
    "oficial": [
        (r"secties|fapesq|fundacao de apoio a pesquisa do estado da paraiba|secretaria de estado da ciencia|secretaria da ciencia, tecnologia|ciquanta|cidade da astronomia|ciatox|claudio furtado|secretario de ciencia", 8),
    ],
}

# Sinais de que a notícia é da Paraíba (mesmo vindo de fonte nacional ou global).
PARAIBA = r"paraiba|paraiban|joao pessoa|campina grande|patos\b|sousa\b|cajazeiras|guarabira|pombal|monteiro\b|secties|fapesq|uepb|ufpb|ufcg|ifpb|ciquanta|ciatox|cariri|sertao paraibano|litoral norte|brejo paraibano|\bpb\b"

# Sinais de que a notícia interessa à SECTIES (fora disso, a notícia perde pontos).
INTERESSE_GERAL = r"ciencia|science|tecnolog|technolog|inovacao|innovation|pesquisa|research|universidade|university|educacao|education|digital|dados|data\b|internet|software|computa|quantic|quantum|\bia\b|\bai\b|inteligencia artificial|startup|satelite|satellite|laboratorio|patrimonio|heritage|museu|museum|edital|bolsa|finep|cnpq|capes|fapesq|secties|ensino"

# Sinais de notícia que NÃO interessa (perde muitos pontos).
RUIDO = r"\bfutebol\b|\bbbb\b|celebridade|horoscopo|novela\b|\bshow\b de|cantor|\bsertanejo|\bforro\b|acidente de transito|homicidio|assalto|\bpreso\b|\bpresa\b|tiroteio|loteria|mega-sena|resultado do jogo|campeonato|\bgol\b|clube|\btorcida|eleitoral|candidato a|pesquisa eleitoral|\bvereador|\bprefeito\b e|\bcrime\b|estupro|feminicidio|\bbet\b|apostas|celular roubado|cupom|desconto|oferta|black friday|review do|unboxing|iphone \d|galaxy s\d|lancamento do celular"

# Palavras que indicam urgência (prazo): dão pontos extras.
URGENCIA = r"prazo|ate (o dia|dia|esta|sexta|segunda|terca|quarta|quinta|sabado|domingo)|termina|encerra|ultimo dia|deadline|inscricoes? (abertas?|ate)|vai ate|fecha (nesta|em|dia)"


def normalizar(texto: str) -> str:
    """Minúsculas, sem acentos, espaços simples."""
    if not texto:
        return ""
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = texto.lower()
    return re.sub(r"\s+", " ", texto)


def _pontuar(regras, texto):
    total = 0
    for expr, pontos in regras:
        achados = len(re.findall(expr, texto))
        if achados:
            total += pontos + min(achados - 1, 3)  # repetição conta um pouco, até 3
    return total


def classificar(item: dict, fonte: dict) -> dict:
    """Recebe um item bruto (titulo, resumo, fonte...) e devolve o item classificado."""
    titulo = normalizar(item.get("titulo", ""))
    corpo = normalizar(item.get("resumo", ""))
    texto = f"{titulo} {titulo} {corpo}"  # título pesa dobrado

    # --- tipo do cartão -----------------------------------------------------
    pontos_tipo = {t: _pontuar(r, texto) for t, r in REGRAS_TIPO.items()}
    for dica in fonte.get("dicas", []):
        if dica in pontos_tipo and pontos_tipo[dica] > 0:
            pontos_tipo[dica] += 2  # a dica da fonte só desempata, nunca inventa
    # "oficial" vence sempre que a SECTIES/FAPESQ é citada; senão, o maior.
    if pontos_tipo["oficial"] >= 8:
        tipo = "oficial"
    else:
        tipo = max(pontos_tipo, key=pontos_tipo.get)
        if pontos_tipo[tipo] == 0:
            tipo = "ciencia"

    # --- programas ----------------------------------------------------------
    pontos_prog = {p: _pontuar(r, texto) for p, r in REGRAS_PROGRAMA.items()}
    for dica in fonte.get("dicas", []):
        if dica in pontos_prog and pontos_prog[dica] > 0:
            pontos_prog[dica] += 2
    programas = [p for p, v in sorted(pontos_prog.items(), key=lambda kv: -kv[1]) if v > 0][:3]
    if not programas:
        programas = {"ensino": ["ensino"], "inovacao": ["inovacao"], "quantica": ["ciquanta"],
                     "ia-gov": ["secretaria2030"], "patrimonio": ["patrimonio"], "inclusao": ["inclusao"],
                     "seguranca": ["seguranca"], "edital": ["fomento"]}.get(tipo, ["transversal"])

    # --- escopo -------------------------------------------------------------
    escopo = fonte.get("escopo", "Nacional")
    if re.search(PARAIBA, texto):
        escopo = "Paraíba"

    # --- pontos de relevância ----------------------------------------------
    pontos = 0
    pontos += max(pontos_tipo.values())
    pontos += sum(sorted(pontos_prog.values(), reverse=True)[:2])
    pontos += 3 * int(fonte.get("peso", 1))
    if escopo == "Paraíba":
        pontos += 8
    if re.search(URGENCIA, texto):
        pontos += 5
    if tipo == "oficial":
        pontos += 10
    if re.search(r"r\$ ?\d|milh|bilh", texto):
        pontos += 2
    if not re.search(INTERESSE_GERAL, texto):
        pontos -= 10
    if re.search(RUIDO, texto):
        pontos -= 25

    item = dict(item)
    item.update({
        "tipo": tipo,
        "programas": programas,
        "escopo": escopo,
        "pontos": pontos,
        "urgente": bool(re.search(URGENCIA, texto)),
    })
    return item


def dar_relevancia(itens: list, max_alta: int = 5) -> list:
    """Marca relevancia alta/media/radar na lista inteira, misturando as três esferas."""
    ordenados = sorted(itens, key=lambda i: -i["pontos"])
    for i in ordenados:
        i["relevancia"] = "radar"
    # Prioridades: as melhores, mas garantindo pelo menos uma de cada esfera quando houver.
    altas = []
    for esc in ("Paraíba", "Nacional", "Global"):
        for i in ordenados:
            if i["escopo"] == esc and i not in altas and i["pontos"] > 0:
                altas.append(i)
                break
    for i in ordenados:
        if len(altas) >= max_alta:
            break
        if i not in altas and i["pontos"] > 0:
            altas.append(i)
    for i in altas:
        i["relevancia"] = "alta"
    # Médias: as próximas 10 com pontos positivos.
    resto = [i for i in ordenados if i["relevancia"] != "alta" and i["pontos"] > 0][:10]
    for i in resto:
        i["relevancia"] = "media"
    return ordenados
