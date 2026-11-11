#!/usr/bin/env python3
"""Constrói as tabelas da auditoria: uma linha por jogo, só com informação conhecida ANTES do jogo
(mais as colunas de resultado, que começam por y_ e NUNCA podem entrar numa regra)."""
import json, math, sys, os, collections
import pandas as pd

RAW = os.environ.get('AUD_RAW', 'raw')
OUT = os.environ.get('AUD_DATA', 'data')
MARKETS = {  # nome -> função(golos casa, golos fora)
    '1': lambda i, j: i > j, 'X': lambda i, j: i == j, '2': lambda i, j: i < j,
    '1X': lambda i, j: i >= j, 'X2': lambda i, j: i <= j, '12': lambda i, j: i != j,
    'O0.5': lambda i, j: i + j > 0.5, 'O1.5': lambda i, j: i + j > 1.5, 'O2.5': lambda i, j: i + j > 2.5, 'O3.5': lambda i, j: i + j > 3.5,
    'U1.5': lambda i, j: i + j < 1.5, 'U2.5': lambda i, j: i + j < 2.5, 'U3.5': lambda i, j: i + j < 3.5, 'U4.5': lambda i, j: i + j < 4.5,
    'BTTS': lambda i, j: i > 0 and j > 0,
}
def col(m): return m.replace('.', '')

def pois_cdf(lam, n):
    s, t = 0.0, math.exp(-lam)
    for k in range(n + 1):
        if k: t *= lam / k
        s += t
    return s
def derived_totals(o):
    """odds de outras linhas de golos, a partir da linha que a casa dá (mesma margem) — iguais às da app («≈»)"""
    line = next((L for L in ('2.5', '1.5', '3.5') if o.get('O' + L, 0) > 1 and o.get('U' + L, 0) > 1), None)
    if not line: return {}
    t = 1 / o['O' + line] + 1 / o['U' + line]; pO = (1 / o['O' + line]) / t; nL = int(float(line))
    lo, hi = 0.1, 7.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if 1 - pois_cdf(mid, nL) < pO: lo = mid
        else: hi = mid
    lam = (lo + hi) / 2; out = {}
    for n in (0, 1, 2, 3, 4):
        pU = pois_cdf(lam, n)
        for side, p in (('O', 1 - pU), ('U', pU)):
            k = f'{side}{n}.5'
            if 0.02 < p < 0.98: out[k] = round(1 / (p * t), 3)
    return out

def streak(seq, cond):
    n = 0
    for g in seq:
        if cond(g): n += 1
        else: break
    return n

def build(season):
    d = json.load(open(f'{RAW}/{season}.json'))
    allm = sorted(d['all'], key=lambda x: x['t'])
    for x in allm: x['ts'] = pd.Timestamp(x['t']).timestamp()
    byteam = collections.defaultdict(list)
    for x in allm:
        byteam[x['hid']].append(x); byteam[x['aid']].append(x)
    def past(tid, ts, code=None, venue=None):
        """jogos anteriores da equipa, do mais recente para o mais antigo, vistos do lado dela"""
        out = []
        for x in byteam[tid]:
            if x['ts'] >= ts: break
            if code and x['c'] != code: continue
            home = x['hid'] == tid
            if venue == 'h' and not home: continue
            if venue == 'a' and home: continue
            gf, ga = (x['i'], x['j']) if home else (x['j'], x['i'])
            out.append({'gf': gf, 'ga': ga, 'home': home, 'ts': x['ts'], 'opp': x['aid'] if home else x['hid'], 'r': 'V' if gf > ga else 'E' if gf == ga else 'D'})
        return out[::-1]
    rows = []
    for r in d['rows']:
        ts = pd.Timestamp(r['t']).timestamp(); code = r['code']; i, j = r['i'], r['j']
        o = dict(r['books'][0]['o']); prov = r['books'][0]['p']
        der = derived_totals(o)
        row = {'epoca': d['meta']['epoca'], 'liga': code, 'data': r['d'], 'id': r['id'], 'casa': r['home'], 'fora': r['away'],
               'mes': int(r['d'][5:7]), 'dia_semana': pd.Timestamp(r['t']).dayofweek, 'hora_utc': pd.Timestamp(r['t']).hour, 'fim_de_semana': int(r['f']['wk']), 'derbi': int(bool(r['f']['derby'])),
               'n_equipas': r['nt']}
        for side, tid, tinfo in (('c', r['hid'], r['th']), ('f', r['aid'], r['ta'])):
            L = past(tid, ts, code); V = past(tid, ts, code, 'h' if side == 'c' else 'a'); A = past(tid, ts)
            row[f'{side}_pos'] = tinfo['pos'] if tinfo else None; row[f'{side}_pts'] = tinfo['pts'] if tinfo else None; row[f'{side}_jogos'] = tinfo['pj'] if tinfo else None
            row[f'{side}_gm'] = tinfo['gf'] if tinfo else None; row[f'{side}_gs'] = tinfo['ga'] if tinfo else None
            row[f'{side}_forma5'] = ''.join(g['r'] for g in L[:5])
            row[f'{side}_pts5'] = sum(3 if g['r'] == 'V' else 1 if g['r'] == 'E' else 0 for g in L[:5])
            row[f'{side}_gm5'] = sum(g['gf'] for g in L[:5]); row[f'{side}_gs5'] = sum(g['ga'] for g in L[:5])
            row[f'{side}_seq_vitorias'] = streak(L, lambda g: g['r'] == 'V'); row[f'{side}_seq_sem_perder'] = streak(L, lambda g: g['r'] != 'D')
            row[f'{side}_seq_sem_ganhar'] = streak(L, lambda g: g['r'] != 'V'); row[f'{side}_seq_derrotas'] = streak(L, lambda g: g['r'] == 'D')
            row[f'{side}_seq_a_marcar'] = streak(L, lambda g: g['gf'] > 0); row[f'{side}_seq_sem_marcar'] = streak(L, lambda g: g['gf'] == 0)
            row[f'{side}_seq_sem_sofrer'] = streak(L, lambda g: g['ga'] == 0); row[f'{side}_seq_a_sofrer'] = streak(L, lambda g: g['ga'] > 0)
            row[f'{side}_seq_mais15'] = streak(L, lambda g: g['gf'] + g['ga'] > 1.5); row[f'{side}_seq_mais25'] = streak(L, lambda g: g['gf'] + g['ga'] > 2.5)
            row[f'{side}_seq_menos25'] = streak(L, lambda g: g['gf'] + g['ga'] < 2.5); row[f'{side}_seq_ambas'] = streak(L, lambda g: g['gf'] > 0 and g['ga'] > 0)
            n = len(L)
            row[f'{side}_taxa_mais25'] = round(sum(g['gf'] + g['ga'] > 2.5 for g in L) / n, 3) if n else None
            row[f'{side}_taxa_ambas'] = round(sum(g['gf'] > 0 and g['ga'] > 0 for g in L) / n, 3) if n else None
            row[f'{side}_taxa_mais15'] = round(sum(g['gf'] + g['ga'] > 1.5 for g in L) / n, 3) if n else None
            # só no seu terreno (casa em casa, fora fora)
            row[f'{side}_local_jogos'] = len(V); row[f'{side}_local_forma5'] = ''.join(g['r'] for g in V[:5])
            row[f'{side}_local_ppj'] = round(sum(3 if g['r'] == 'V' else 1 if g['r'] == 'E' else 0 for g in V) / len(V), 2) if V else None
            row[f'{side}_local_seq_sem_perder'] = streak(V, lambda g: g['r'] != 'D'); row[f'{side}_local_seq_sem_ganhar'] = streak(V, lambda g: g['r'] != 'V')
            row[f'{side}_local_seq_vitorias'] = streak(V, lambda g: g['r'] == 'V')
            row[f'{side}_descanso'] = round((ts - A[0]['ts']) / 86400, 1) if A else None
            row[f'{side}_jogos_14d'] = sum(1 for g in A if ts - g['ts'] <= 14 * 86400)
        # primeira volta desta época (mesmo par, campo trocado), do lado da equipa da casa
        h2h = [g for g in past(r['hid'], ts, code) if g['opp'] == r['aid']]
        row['volta1'] = h2h[0]['r'] if h2h else ''; row['volta1_golos'] = (h2h[0]['gf'] + h2h[0]['ga']) if h2h else None
        row['dif_pos'] = (row['c_pos'] - row['f_pos']) if row['c_pos'] and row['f_pos'] else None
        row['dif_pts'] = (row['c_pts'] - row['f_pts']) if row['c_pts'] is not None and row['f_pts'] is not None else None
        f = r['f']
        # f.* refere-se à equipa escolhida pelo Zé (quando a escolha tem lado)
        row['ze_eq_europa_a_seguir'] = None if f['euroNextP'] is None else int(f['euroNextP']); row['ze_eq_vem_da_europa'] = None if f['euroPrevP'] is None else int(f['euroPrevP'])
        row['ze_adv_europa_a_seguir'] = None if f['euroNextO'] is None else int(f['euroNextO'])
        row['ze_eq_sem_nada_em_jogo'] = None if f['nothingP'] is None else int(bool(f['nothingP'])); row['ze_adv_sem_nada_em_jogo'] = None if f['nothingO'] is None else int(bool(f['nothingO']))
        # odds da casa principal (reais) e derivadas (≈)
        row['casa_apostas'] = prov
        for k in ('1', 'X', '2', '1X', 'X2', '12', 'O2.5', 'U2.5'):
            row['o_' + col(k)] = o.get(k)
        if not row['o_1X'] and o.get('1') and o.get('X'): row['o_1X'] = round(1 / (1 / o['1'] + 1 / o['X']), 3)
        if not row['o_X2'] and o.get('2') and o.get('X'): row['o_X2'] = round(1 / (1 / o['2'] + 1 / o['X']), 3)
        if not row['o_12'] and o.get('1') and o.get('2'): row['o_12'] = round(1 / (1 / o['1'] + 1 / o['2']), 3)
        for k in ('O0.5', 'O1.5', 'O2.5', 'O3.5', 'U1.5', 'U2.5', 'U3.5', 'U4.5'):
            if row.get('o_' + col(k)) is None: row['o_' + col(k)] = der.get(k)
        row['odds_golos_derivadas'] = int(not (o.get('O2.5', 0) > 1))
        s = 1 / o['1'] + 1 / o['X'] + 1 / o['2']
        row['q_1'] = round(1 / o['1'] / s, 4); row['q_X'] = round(1 / o['X'] / s, 4); row['q_2'] = round(1 / o['2'] / s, 4); row['margem_1x2'] = round(s - 1, 4)
        oc = r['oc'] or {}
        row['abre_1'] = oc.get('oh'); row['fecha_1'] = oc.get('ch'); row['abre_2'] = oc.get('oa'); row['fecha_2'] = oc.get('ca')
        row['mexe_1'] = round(oc['ch'] / oc['oh'] - 1, 4) if oc.get('oh') and oc.get('ch') else None
        row['mexe_2'] = round(oc['ca'] / oc['oa'] - 1, 4) if oc.get('oa') and oc.get('ca') else None
        ot, ct = oc.get('ot') or {}, oc.get('ct') or {}
        row['mexe_mais'] = round(ct['o'] / ot['o'] - 1, 4) if ot.get('o') and ct.get('o') else None
        row['linha_golos'] = oc.get('line')
        # modelo do Zé (com odds) e modelo puro (sem odds)
        for k in ('1', 'X', '2', '1X', 'X2', 'O1.5', 'O2.5', 'U2.5', 'U3.5', 'BTTS'):
            row['ze_p_' + col(k)] = r['mk'].get(k)
        for k in ('1', 'X', '2', 'O2.5', 'BTTS'):
            row['puro_p_' + col(k)] = r['mk0'].get(k)
        row['lam_casa'] = r['lam']['h']; row['lam_fora'] = r['lam']['a']
        row['ze_aposta'] = r['k']; row['ze_prob'] = round(r['p'], 4) if r['k'] else None; row['ze_odd'] = r['odd']; row['ze_odd_derivada'] = int(bool(r['oddDer']))
        row['ze_selo'] = r['grade']; row['ze_casas_prob'] = round(r['q'], 4) if r['q'] is not None else None
        row['ze_logica'] = r['lk']; row['ze_logica_prob'] = round(r['lp'], 4)
        row['ze_valor_aposta'] = r['vb']['k'] if r['vb'] else ''; row['ze_valor_odd'] = r['vb']['o'] if r['vb'] else None
        row['ze_mexe'] = round(f['drift'], 4) if f['drift'] is not None else None
        # ---------- RESULTADOS (proibidos em regras) ----------
        row['y_gc'] = i; row['y_gf'] = j; row['y_golos'] = i + j; row['y_res'] = '1' if i > j else 'X' if i == j else '2'
        for k, fn in MARKETS.items(): row['y_' + col(k)] = int(fn(i, j))
        row['y_ze'] = r['win']; row['y_ze_logica'] = r['lwin']; row['y_ze_valor'] = r['vb']['w'] if r['vb'] else None
        # play-offs e jogos de desempate não são campeonato: a tabela e a forma deixam de fazer sentido
        reg = 2 * (int(r['nt']) - 1)
        if row.get('c_jogos', 0) >= reg or row.get('f_jogos', 0) >= reg: continue
        rows.append(row)
    return pd.DataFrame(rows)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for season in sys.argv[1:]:
        df = build(season)
        df.to_csv(f'{OUT}/{season}.csv', index=False)
        os.makedirs(f'{OUT}/{season}', exist_ok=True)
        for lg, g in df.groupby('liga'): g.to_csv(f'{OUT}/{season}/{lg}.csv', index=False)
        print(season, df.shape, 'ligas', df.liga.nunique(), 'selo ouro', (df.ze_selo == 'ouro').sum())
