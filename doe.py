"""
Diário Oficial do Estado da Paraíba (DOE-PB), leitura automática de reserva.

Tenta baixar a edição do dia no site do A União, converte o PDF em texto
(pdftotext) e procura menções à área da SECTIES. Se o site bloquear ou não
houver edição nova, a seção do site mostra isso em uma frase e segue.

Resultado (vai para a edição em "doeAuto"):
  {"data": "AAAA-MM-DD", "lido": true/false, "obs": "...", "arquivos": [{"nome", "url", "paginas"}],
   "mencoes": [{"termo", "pagina", "trecho", "arquivo", "url"}]}

Regra do site público: menções a atos de pessoal (nomeação, exoneração, férias,
diárias) são descartadas automaticamente.
"""

import re
import subprocess
import tempfile
from datetime import date
from pathlib import Path

import requests
from bs4 import BeautifulSoup

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]

TERMOS = [
    "Ciência, Tecnologia", "SECTIES", "FAPESQ", "Fundação de Apoio à Pesquisa", "Universidade Estadual da Paraíba", "UEPB",
    "CIATox", "Toxicol", "CODATA", "IPHAEP", "Patrimônio Histórico", "Museu", "Inovação", "Startup", "Parque Tecnológico",
    "Inteligência Artificial", "Dados Abertos", "Transformação Digital", "Conectividade", "Ensino Superior", "Pesquisa Científica",
    "Bolsa", "Edital", "Lei nº", "Lei Nº", "Decreto nº", "Decreto Nº", "Medida Provisória",
]
PESSOAL = re.compile(r"nomear|nomeia|exonera|designa|f[eé]rias|di[aá]ria|licen[cç]a|aposentad|remove|cede|substitui", re.I)


def listar_pdfs(dia: date) -> list[dict]:
    url = f"https://auniao.pb.gov.br/servicos/doe/{dia.year}/{MESES[dia.month - 1]}"
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=30)
        r.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(f"Lista do Diário indisponível ({exc.__class__.__name__})")
    sopa = BeautifulSoup(r.text, "html.parser")
    alvo = dia.strftime("%d-%m-%Y")
    achados = []
    for a in sopa.find_all("a", href=True):
        href = a["href"]
        if alvo in href and ".pdf" in href.lower():
            base = href.split("/@@download")[0]
            if base not in [x["url"] for x in achados]:
                achados.append({"nome": base.rsplit("/", 1)[-1], "url": base})
    return achados


def baixar_pdf(url: str, destino: Path) -> bool:
    try:
        r = requests.get(url + "/@@download/file", headers={"User-Agent": UA}, timeout=120)
        if r.status_code != 200 or not r.content.startswith(b"%PDF"):
            r = requests.get(url, headers={"User-Agent": UA}, timeout=120)
        if r.status_code == 200 and r.content.startswith(b"%PDF"):
            destino.write_bytes(r.content)
            return True
    except requests.RequestException:
        pass
    return False


def pdf_para_texto(pdf: Path) -> str:
    try:
        saida = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True, timeout=300)
        return saida.stdout
    except Exception:
        return ""


def procurar_mencoes(texto: str, arquivo: str, url: str) -> list[dict]:
    paginas = texto.split("\f")
    mencoes, vistos = [], set()
    for n, pag in enumerate(paginas, start=1):
        for termo in TERMOS:
            for m in re.finditer(re.escape(termo), pag, flags=re.I):
                ini = max(0, m.start() - 140)
                fim = min(len(pag), m.end() + 220)
                trecho = re.sub(r"\s+", " ", pag[ini:fim]).strip()
                if PESSOAL.search(trecho):
                    continue  # ato de pessoal: fica fora do site público
                chave = (n, trecho[:80])  # mesmo trecho com vários termos entra uma vez
                if chave in vistos:
                    continue
                vistos.add(chave)
                mencoes.append({"termo": termo, "pagina": n, "trecho": trecho[:360], "arquivo": arquivo, "url": url})
    return mencoes[:60]


def ler_diario(dia: date, pasta_doe: Path) -> dict:
    resultado = {"data": dia.isoformat(), "lido": False, "obs": "", "arquivos": [], "mencoes": []}
    try:
        pdfs = listar_pdfs(dia)
    except RuntimeError as exc:
        resultado["obs"] = f"Não foi possível abrir a lista do Diário Oficial hoje ({exc})."
        return resultado
    if not pdfs:
        resultado["obs"] = "Nenhuma edição do Diário Oficial publicada para esta data até o momento da coleta."
        return resultado
    pasta_doe.mkdir(parents=True, exist_ok=True)
    texto_total = []
    with tempfile.TemporaryDirectory() as tmp:
        for p in pdfs:
            destino = Path(tmp) / p["nome"]
            if not baixar_pdf(p["url"], destino):
                resultado["arquivos"].append({**p, "paginas": 0, "ok": False})
                continue
            texto = pdf_para_texto(destino)
            n_pag = texto.count("\f") + 1 if texto else 0
            resultado["arquivos"].append({**p, "paginas": n_pag, "ok": bool(texto)})
            if texto:
                texto_total.append(f"===== ARQUIVO: {p['nome']}\n===== URL: {p['url']}\n{texto}")
                resultado["mencoes"].extend(procurar_mencoes(texto, p["nome"], p["url"]))
    if texto_total:
        (pasta_doe / f"{dia.isoformat()}.txt").write_text("\n".join(texto_total), encoding="utf-8")
        resultado["lido"] = True
        total = sum(a["paginas"] for a in resultado["arquivos"])
        resultado["obs"] = f"Edição lida por inteiro ({total} páginas em {len(resultado['arquivos'])} arquivo(s)). {len(resultado['mencoes'])} menção(ões) à área encontradas."
    else:
        resultado["obs"] = "A lista do Diário apareceu, mas o download dos PDFs foi bloqueado. Leia pelo link da edição."
    return resultado
