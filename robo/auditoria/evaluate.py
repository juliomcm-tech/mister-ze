#!/usr/bin/env python3
"""Avalia regras da auditoria. Uso:
  python3 evaluate.py regras.json --epocas 2024 [--liga por.1] [--json saida.json]
regras.json = lista de {"id", "descricao", "regra", "aposta", "tipo"} (ou um objeto com a chave "regras").
  regra  : expressão pandas (df.query) só com colunas de ANTES do jogo (nada de y_*)
  aposta : 1, X, 2, 1X, X2, 12, O0.5, O1.5, O2.5, O3.5, U1.5, U2.5, U3.5, U4.5, BTTS (BTTS não tem odds → só taxa)
           ZE = seguir a aposta que o Zé faria (ze_aposta @ ze_odd) · ZE_LOGICA = aposta lógica do Zé (sem odd)
  tipo   : "apostar" (espera-se lucro) ou "evitar" (espera-se prejuízo)
Colunas de saída: n, acertos, taxa, odd média, taxa precisa para empatar, lucro por € (ROI) e z (lucro em desvios-padrão; >2 é raro por acaso)."""
import json, sys, argparse, math
import pandas as pd

import os
DATA = os.environ.get('AUD_DATA', 'data')
MK = ['1', 'X', '2', '1X', 'X2', '12', 'O0.5', 'O1.5', 'O2.5', 'O3.5', 'U1.5', 'U2.5', 'U3.5', 'U4.5', 'BTTS']
col = lambda m: m.replace('.', '')

def load(epocas):
    return {e: pd.read_csv(f'{DATA}/{e}.csv', dtype={'id': str}) for e in epocas}

def run_rule(df, rule, liga=None):
    pre = df[[c for c in df.columns if not c.startswith('y_')]]
    try:
        idx = pre.query(rule['regra'], engine='python').index
    except Exception as e:
        return {'erro': f'{type(e).__name__}: {e}'[:200]}
    b = df.loc[idx]
    if liga: b = b[b.liga == liga]
    ap = rule.get('aposta', 'ZE')
    if ap == 'ZE':
        b = b[b.ze_aposta.notna() & b.y_ze.notna()]; y = b.y_ze; o = b.ze_odd
    elif ap == 'ZE_LOGICA':
        y = b.y_ze_logica; o = pd.Series([float('nan')] * len(b), index=b.index)
    elif ap in MK:
        y = b['y_' + col(ap)]; o = b['o_' + col(ap)] if ('o_' + col(ap)) in b.columns else pd.Series([float('nan')] * len(b), index=b.index)
    else:
        return {'erro': 'aposta desconhecida: ' + str(ap)}
    n = len(b); out = {'n': int(n)}
    if not n: return out
    out['acertos'] = int(y.sum()); out['taxa'] = round(float(y.mean()), 4)
    w = o.notna() & (o > 1)
    if w.sum():
        ow, yw = o[w], y[w]
        profit = float((yw * ow - 1).sum()); var = float((ow - 1).sum())
        out.update({'n_odds': int(w.sum()), 'odd_media': round(float(ow.mean()), 3), 'precisa': round(float((1 / ow).mean()), 4), 'roi': round(profit / int(w.sum()), 4), 'z': round(profit / math.sqrt(var), 2) if var > 0 else None})
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('regras'); ap.add_argument('--epocas', nargs='+', default=['2024']); ap.add_argument('--liga'); ap.add_argument('--json')
    a = ap.parse_args()
    R = json.load(open(a.regras)); R = (R.get('regras') or R.get('padroes') or R.get('testes') or []) if isinstance(R, dict) else R
    D = load(a.epocas); res = []
    for r in R:
        line = {'id': r.get('id'), 'aposta': r.get('aposta'), 'tipo': r.get('tipo'), 'regra': r.get('regra')}
        for e, df in D.items(): line[e] = run_rule(df, r, a.liga)
        res.append(line)
        txt = ' | '.join(f"{e}: " + (v['erro'] if 'erro' in v else f"n={v.get('n')} taxa={v.get('taxa')} odd={v.get('odd_media')} precisa={v.get('precisa')} roi={v.get('roi')} z={v.get('z')}") for e, v in ((e, line[e]) for e in D))
        print(f"{str(r.get('id'))[:28]:28s} [{r.get('aposta')}] {txt}")
    if a.json: json.dump(res, open(a.json, 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main()
