import glob,json,os,sys,random
from playwright.sync_api import sync_playwright
OUT='captures/tough'; os.makedirs(OUT,exist_ok=True); rep={}
random.seed(1)
with sync_playwright() as p:
  b=p.chromium.launch()
  for d in sorted(glob.glob('runs_tough/R10/*')):
    m=d.split('/')[-1]; f=d+'/work/index.html'; key=f'{m}_R10'; errs=[]; r={}
    ctx=b.new_context(viewport={'width':1280,'height':800},record_video_dir=f'{OUT}/vid_{key}',record_video_size={'width':1280,'height':800})
    pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append('pageerror: '+str(e))); pg.on('console',lambda c: errs.append(c.text) if c.type=='error' else None)
    pg.goto('file://'+os.path.abspath(f)); pg.wait_for_timeout(1500); pg.mouse.click(640,400)
    st=lambda: pg.evaluate("window.game&&window.game.getState?window.game.getState():null")
    s0=st(); r['api']=s0 is not None; r['start_state']=s0
    pg.screenshot(path=f'{OUT}/{key}_start.png')
    moved={}
    for k in ['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','d','s','a','w']:
      a=st(); pg.keyboard.down(k); pg.wait_for_timeout(350); pg.keyboard.up(k); bb=st()
      moved[k]= bool(a and bb and (a['player']['x'],a['player']['y'])!=(bb['player']['x'],bb['player']['y']))
    r['moved']=moved; r['move_ok']=all(moved.values())
    pg.keyboard.press('Space'); pg.wait_for_timeout(200)
    pg.screenshot(path=f'{OUT}/{key}_play.png')
    # wander until game over (max 90 s)
    t=0; keys=['ArrowRight','ArrowDown','ArrowLeft','ArrowUp']
    while t<90000:
      s=st()
      if s and s.get('gameOver'): break
      k=random.choice(keys); pg.keyboard.down(k); pg.wait_for_timeout(500); pg.keyboard.up(k); t+=500
    s=st(); r['gameover_reached']=bool(s and s.get('gameOver')); r['gameover_after_s']=t/1000; r['gameover_state']=s
    pg.screenshot(path=f'{OUT}/{key}_gameover.png')
    pg.keyboard.press('r'); pg.wait_for_timeout(600); s2=st(); r['after_restart']=s2
    r['restart_ok']=bool(s2 and not s2['gameOver'] and s2['score']==0 and s0 and s2['health']==s0['health'])
    pg.screenshot(path=f'{OUT}/{key}_restart.png')
    r['console_errors']=errs[:5]; r['no_errors']=not errs
    r['smoke_pass']=r['api'] and r['move_ok'] and r['gameover_reached'] and r['restart_ok'] and r['no_errors']
    rep[m]=r; ctx.close(); print(m,json.dumps({k:v for k,v in r.items() if k not in('start_state','gameover_state','after_restart')}))
json.dump(rep,open(f'{OUT}/r10_report.json','w'),indent=1)
