"""
Rotina diária do Radar SECTIES (roda sozinha no GitHub Actions ou à mão).

  python3 -m radar.main            coleta, classifica, grava edicoes/HOJE.json e monta o site
  python3 -m radar.main --sem-doe  pula a leitura do Diário Oficial
  python3 -m radar.main --so-montar  só remonta o site com as edições já gravadas

O que acontece, em ordem:
 1. Lê fontes/fontes.json e coleta os feeds (em paralelo, nunca trava por uma fonte ruim).
 2. Classifica cada notícia (tipo do cartão, programas, escopo, pontos).
 3. Junta com a base data/noticias.json (últimos 60 dias) e tira repetidas.
 4. Escolhe de 14 a 20 notícias para a edição, com cotas por esfera, e marca as prioridades.
 5. Se existir edicoes/HOJE.json escrito por uma revisão editorial (formato antigo do Radar),
    ele manda: seus itens, Diário Oficial, pautas e propostas ficam; o automático só completa.
 6. Lê o Diário Oficial do dia (tentativa; se o site bloquear, registra e segue).
 7. Camada editorial opcional (só com RADAR_CHAVE_EDITORIAL configurada).
 8. Grava a edição e monta o site em site/.
"""

import argparse
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from . import classificar as cl
from . import coletar, doe, editorial, montar

RAIZ = Path(__file__).resolve().parent.parent
FUSO = ZoneInfo("America/Fortaleza")
BASE = RAIZ / "data" / "noticias.json"
MIN_ITENS, MAX_ITENS = 14, 20
COTAS = {"Paraíba": 5, "Nacional": 4, "Global": 3}


def hoje() -> date:
    return datetime.now(FUSO).date()


def carregar_base() -> dict:
    if BASE.exists():
        try:
            return json.loads(BASE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {"itens": {}}


def salvar_base(base: dict, dias: int = 60) -> None:
    limite = (hoje() - timedelta(days=dias)).isoformat()
    base["itens"] = {k: v for k, v in base["itens"].items() if (v.get("dataPub") or v.get("coletadoEm", "")[:10]) >= limite}
    BASE.parent.mkdir(exist_ok=True)
    BASE.write_text(json.dumps(base, ensure_ascii=False, indent=0), encoding="utf-8")


def urls_recentes(dias: int = 7) -> tuple[set, int, list]:
    """URLs já publicadas, maior número de edição e propostas recentes."""
    usadas, maior, propostas = set(), 0, []
    limite = (hoje() - timedelta(days=dias)).isoformat()
    for arq in sorted((RAIZ / "edicoes").glob("????-??-??.json")):
        try:
            ed = json.loads(arq.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        maior = max(maior, int(ed.get("numero", 0)))
        if ed.get("data", "") >= limite and ed.get("data") != hoje().isoformat():
            usadas.update(coletar.url_canonica(i["url"]) for i in ed.get("itens", []) if i.get("url"))
            propostas.extend(p.get("titulo", "") for p in ed.get("propostas", []))
    return usadas, maior, propostas


def selecionar(candidatos: list[dict]) -> list[dict]:
    """Escolhe a edição: cotas por esfera, depois os melhores, sem passar de MAX_ITENS."""
    por_pontos = sorted(candidatos, key=lambda i: -i["pontos"])
    escolhidos = []
    for esc, cota in COTAS.items():
        for i in [c for c in por_pontos if c["escopo"] == esc][:cota]:
            if i["pontos"] > -5:
                escolhidos.append(i)
    for i in por_pontos:
        if len(escolhidos) >= MAX_ITENS:
            break
        if i not in escolhidos and i["pontos"] > 0:
            escolhidos.append(i)
    # evita monopólio de uma só fonte (máximo 5 por fonte)
    contagem, final = {}, []
    for i in escolhidos:
        contagem[i["fonte"]] = contagem.get(i["fonte"], 0) + 1
        if contagem[i["fonte"]] <= 5:
            final.append(i)
    return cl.dar_relevancia(final)


def slug(texto: str) -> str:
    t = cl.normalizar(texto)
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t[:60]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sem-doe", action="store_true")
    ap.add_argument("--so-montar", action="store_true")
    ap.add_argument("--dias", type=int, default=4, help="Janela de dias para notícias novas (padrão 4)")
    args = ap.parse_args(argv)

    if args.so_montar:
        montar.montar_site()
        return 0

    dia = hoje()
    arq_fontes = Path(os.environ.get("RADAR_FONTES", RAIZ / "fontes" / "fontes.json"))
    fontes = json.loads(arq_fontes.read_text(encoding="utf-8"))["fontes"]
    por_id = {f["id"]: f for f in fontes}

    print(f"[1/8] Coletando {len(fontes)} fontes...")
    brutos, saude = coletar.coletar_tudo(fontes, dias=10)
    print(f"      {len(brutos)} notícias brutas; {sum(1 for s in saude if s['ok'])} fontes responderam.")

    print("[2/8] Classificando...")
    classificados = [cl.classificar(i, por_id[i["fonteId"]]) for i in brutos]

    print("[3/8] Atualizando a base local e tirando repetidas...")
    base = carregar_base()
    for i in classificados:
        base["itens"].setdefault(i["id"], i)
    salvar_base(base)
    usadas, maior, propostas_recentes = urls_recentes()
    limite = (dia - timedelta(days=args.dias)).isoformat()
    candidatos = [i for i in base["itens"].values()
                  if coletar.url_canonica(i["url"]) not in usadas
                  and (i.get("dataPub") or i.get("coletadoEm", "")[:10]) >= limite]
    # título repetido entre fontes diferentes: fica o de mais pontos
    vistos, unicos = {}, []
    for i in sorted(candidatos, key=lambda x: -x["pontos"]):
        chave = cl.normalizar(i["titulo"])[:70]
        if chave in vistos:
            continue
        vistos[chave] = True
        unicos.append(i)
    print(f"      {len(unicos)} candidatas novas.")

    print("[4/8] Selecionando a edição...")
    itens = selecionar(unicos)
    for i in itens:
        i["origem"] = "auto"

    arq_hoje = RAIZ / "edicoes" / f"{dia.isoformat()}.json"
    edicao = None
    if arq_hoje.exists():
        try:
            edicao = json.loads(arq_hoje.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            edicao = None

    print("[5/8] Juntando com a edição editorial, se existir...")
    if edicao and edicao.get("itens") and any(i.get("origem") != "auto" for i in edicao["itens"]):
        # edição revisada manda: mantemos seus itens (com tipo calculado) e completamos com o automático
        editoriais = [i for i in edicao["itens"] if i.get("origem") != "auto"]
        for i in editoriais:
            fonte = por_id.get(i.get("fonteId", ""), {"escopo": i.get("escopo", "Nacional"), "peso": 2, "dicas": []})
            calc = cl.classificar(i, fonte)
            i["tipo"] = i.get("tipo") or calc["tipo"]
            i["urgente"] = calc["urgente"]
            i.setdefault("pontos", calc["pontos"])
            i["origem"] = "editorial"
        urls_ed = {coletar.url_canonica(i["url"]) for i in editoriais}
        extras = [i for i in itens if coletar.url_canonica(i["url"]) not in urls_ed][:10]
        for e in extras:
            e["relevancia"] = "radar"
        edicao["itens"] = editoriais + extras
        edicao["modo"] = "editorial"
    else:
        numero = int(edicao.get("numero", 0)) if edicao else 0
        edicao = {
            "data": dia.isoformat(),
            "numero": numero or maior + 1,
            "modo": "automatico",
            "destaque": itens[0]["titulo"][:70] if itens else "Radar SECTIES",
            "leitura": "Edição montada automaticamente a partir dos portais acompanhados. " +
                       (f"{len(itens)} notícias selecionadas por relevância, com prioridades da Paraíba, do Brasil e do mundo." if itens else "Nenhuma fonte respondeu nesta coleta."),
            "itens": itens,
            "doe": {},
            "secom": [],
            "propostas": [],
        }
        # pautas oficiais: notícias da Paraíba que citam SECTIES/FAPESQ viram "secom" também
        for i in itens:
            if i["tipo"] == "oficial" and i["escopo"] == "Paraíba":
                edicao["secom"].append({"titulo": i["titulo"], "portal": i["fonte"], "url": i["url"], "dataPub": i.get("dataPub", ""), "programas": i["programas"], "resumo": ""})

    print("[6/8] Diário Oficial do Estado...")
    if args.sem_doe:
        edicao["doeAuto"] = {"data": dia.isoformat(), "lido": False, "obs": "Leitura do Diário Oficial desligada nesta execução.", "arquivos": [], "mencoes": []}
    else:
        try:
            edicao["doeAuto"] = doe.ler_diario(dia, RAIZ / "doe")
        except Exception as exc:
            edicao["doeAuto"] = {"data": dia.isoformat(), "lido": False, "obs": f"Leitura automática falhou ({exc.__class__.__name__}).", "arquivos": [], "mencoes": []}
    print(f"      {edicao['doeAuto']['obs']}")

    print("[7/8] Camada editorial opcional...")
    if edicao["modo"] == "automatico" and editorial.disponivel():
        resposta = editorial.editar(edicao["itens"], propostas_recentes, cl.PROGRAMAS)
        if resposta:
            edicao["destaque"] = (resposta.get("destaque") or edicao["destaque"])[:70]
            edicao["leitura"] = resposta.get("leitura") or edicao["leitura"]
            for i in edicao["itens"]:
                novo = (resposta.get("itens") or {}).get(i["id"])
                if novo:
                    i["titulo"] = novo.get("titulo") or i["titulo"]
                    i["resumo"] = novo.get("resumo") or i["resumo"]
                    i["porQueImporta"] = novo.get("porQueImporta", "")
            edicao["propostas"] = [p for p in resposta.get("propostas", []) if p.get("titulo")][:8]
            edicao["modo"] = "automatico-revisado"
            print("      Textos revisados em português simples.")
    else:
        print("      Sem chave editorial: cartões com título e resumo das fontes.")

    edicao["geradoEm"] = datetime.now(FUSO).isoformat(timespec="seconds")
    edicao["saude"] = saude
    edicao["curiosidade"] = montar.curiosidade_do_dia(dia)
    for i in edicao["itens"]:
        i.setdefault("id", slug(i["titulo"]))
    (RAIZ / "edicoes").mkdir(exist_ok=True)
    arq_hoje.write_text(json.dumps(edicao, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"      Edição nº {edicao['numero']} gravada ({len(edicao['itens'])} notícias, modo {edicao['modo']}).")

    print("[8/8] Montando o site...")
    montar.montar_site(fontes)
    print("      Pronto: index.html, capa.png e whatsapp.txt atualizados")
    return 0


if __name__ == "__main__":
    sys.exit(main())
