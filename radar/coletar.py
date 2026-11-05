"""
Coleta de notícias do Radar SECTIES.

Lê fontes/fontes.json, tenta os feeds RSS de cada fonte (com reservas e descoberta
automática pela página inicial), e devolve itens no formato padrão:

  {id, titulo, url, resumo, fonte, fonteId, dataPub, coletadoEm}

Tudo que falhar é registrado em "saude" (saúde das fontes), que vai para o site,
para o Victor ver quais fontes responderam hoje sem precisar abrir nada técnico.
"""

import concurrent.futures as cf
import hashlib
import html
import re
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin, urlparse, urlunparse, parse_qsl, urlencode

import feedparser
import requests
from bs4 import BeautifulSoup

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 RadarSECTIES/2.0")
TIMEOUT = 20
MAX_POR_FONTE = 40


# ----------------------------------------------------------------------------
# utilidades
# ----------------------------------------------------------------------------
def limpar_html(texto: str, limite: int = 320) -> str:
    if not texto:
        return ""
    texto = BeautifulSoup(html.unescape(texto), "html.parser").get_text(" ")
    texto = re.sub(r"\s+", " ", texto).strip()
    texto = re.sub(r"(Leia mais|Read more|Continue reading|The post .* appeared first on .*)$", "", texto, flags=re.I).strip()
    if len(texto) > limite:
        corte = texto[:limite].rsplit(" ", 1)[0]
        texto = corte.rstrip(",;:") + "…"
    return texto


def url_canonica(url: str) -> str:
    """Tira parâmetros de rastreio (utm etc.) para a mesma matéria não entrar duas vezes."""
    try:
        p = urlparse(url.strip())
        q = [(k, v) for k, v in parse_qsl(p.query) if not k.lower().startswith(("utm_", "fbclid", "gclid", "mc_", "ref"))]
        return urlunparse((p.scheme or "https", p.netloc.lower(), p.path.rstrip("/") or "/", "", urlencode(q), ""))
    except Exception:
        return url


def id_de(url: str) -> str:
    return hashlib.sha1(url_canonica(url).encode("utf-8")).hexdigest()[:12]


def data_do_item(entrada) -> str:
    for campo in ("published_parsed", "updated_parsed", "created_parsed"):
        t = entrada.get(campo)
        if t:
            try:
                return time.strftime("%Y-%m-%d", t)
            except Exception:
                pass
    for campo in ("published", "updated"):
        bruto = entrada.get(campo)
        if bruto:
            m = re.search(r"(\d{4})-(\d{2})-(\d{2})", bruto)
            if m:
                return m.group(0)
    return ""


def baixar(url: str) -> bytes | None:
    try:
        r = requests.get(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5"}, timeout=TIMEOUT, allow_redirects=True)
        if r.status_code == 200 and r.content:
            return r.content
    except requests.RequestException:
        pass
    return None


def descobrir_feed(site: str) -> list[str]:
    """Procura <link rel="alternate" type="application/rss+xml"> na página inicial."""
    pagina = baixar(site)
    if not pagina:
        return []
    try:
        sopa = BeautifulSoup(pagina, "html.parser")
    except Exception:
        return []
    achados = []
    for link in sopa.find_all("link", rel=lambda v: v and "alternate" in v):
        tipo = (link.get("type") or "").lower()
        href = link.get("href")
        if href and ("rss" in tipo or "atom" in tipo or "xml" in tipo):
            achados.append(urljoin(site, href))
    return achados[:3]


def imagem_do_item(entrada) -> str:
    """Imagem da notícia, quando o feed traz uma (media:content, media:thumbnail, enclosure ou <img> no resumo)."""
    for campo in ("media_content", "media_thumbnail"):
        for m in entrada.get(campo, []) or []:
            url = m.get("url", "")
            if url.startswith("http") and not url.lower().endswith(".mp4"):
                return url
    for e in entrada.get("enclosures", []) or []:
        if (e.get("type", "") or "").startswith("image") and e.get("href", "").startswith("http"):
            return e["href"]
    for campo in ("summary", "description"):
        bruto = entrada.get(campo) or ""
        m = re.search(r'<img[^>]+src="(https?://[^"]+)"', bruto)
        if m:
            return m.group(1)
    if entrada.get("content"):
        m = re.search(r'<img[^>]+src="(https?://[^"]+)"', entrada["content"][0].get("value", ""))
        if m:
            return m.group(1)
    return ""


def ler_feed(conteudo: bytes):
    feed = feedparser.parse(conteudo)
    if feed.bozo and not feed.entries:
        return None
    return feed


# ----------------------------------------------------------------------------
# coleta de uma fonte
# ----------------------------------------------------------------------------
def coletar_fonte(fonte: dict, dias: int = 10) -> tuple[list, dict]:
    limite = (datetime.now(timezone.utc) - timedelta(days=dias)).strftime("%Y-%m-%d")
    tentativas = list(fonte.get("feeds", []))
    feed = None
    usado = None
    for url in tentativas:
        conteudo = baixar(url)
        if conteudo:
            feed = ler_feed(conteudo)
            if feed and feed.entries:
                usado = url
                break
    if feed is None or not feed.entries:
        for url in descobrir_feed(fonte.get("site", "")):
            conteudo = baixar(url)
            if conteudo:
                feed = ler_feed(conteudo)
                if feed and feed.entries:
                    usado = url
                    break
    if feed is None or not feed.entries:
        return [], {"id": fonte["id"], "nome": fonte["nome"], "ok": False, "itens": 0, "feed": None,
                    "obs": "Sem feed acessível hoje"}

    itens = []
    for e in feed.entries[:MAX_POR_FONTE]:
        link = e.get("link") or ""
        titulo = limpar_html(e.get("title", ""), 200)
        if not link or not titulo:
            continue
        data = data_do_item(e)
        if data and data < limite:
            continue  # velha demais
        resumo = ""
        if e.get("summary"):
            resumo = e.get("summary")
        elif e.get("content"):
            resumo = e["content"][0].get("value", "")
        elif e.get("description"):
            resumo = e.get("description")
        itens.append({
            "id": id_de(link),
            "titulo": titulo,
            "url": url_canonica(link),
            "resumo": limpar_html(resumo),
            "fonte": fonte["nome"],
            "fonteId": fonte["id"],
            "dataPub": data,
            "imagem": imagem_do_item(e),
            "coletadoEm": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        })
    return itens, {"id": fonte["id"], "nome": fonte["nome"], "ok": True, "itens": len(itens), "feed": usado,
                   "obs": "" if itens else "Feed respondeu, mas sem notícias recentes"}


def coletar_tudo(fontes: list[dict], dias: int = 10, paralelo: int = 8) -> tuple[list, list]:
    """Coleta todas as fontes em paralelo. Devolve (itens, saude)."""
    itens, saude = [], []
    with cf.ThreadPoolExecutor(max_workers=paralelo) as pool:
        futuros = {pool.submit(coletar_fonte, f, dias): f for f in fontes}
        for fut in cf.as_completed(futuros):
            f = futuros[fut]
            try:
                its, st = fut.result()
            except Exception as exc:  # nunca derruba a coleta inteira
                its, st = [], {"id": f["id"], "nome": f["nome"], "ok": False, "itens": 0, "feed": None, "obs": f"Erro: {exc.__class__.__name__}"}
            itens.extend(its)
            saude.append(st)
    saude.sort(key=lambda s: (not s["ok"], s["nome"].lower()))
    # dedup por url canônica
    vistos, unicos = set(), []
    for i in itens:
        if i["id"] in vistos:
            continue
        vistos.add(i["id"])
        unicos.append(i)
    return unicos, saude
