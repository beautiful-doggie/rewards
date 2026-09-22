'use client';
import { readPrizeImage } from '@/lib/prize-image';
import { selectWinner } from '@/lib/lottery';
import { useEffect, useRef, useState } from 'react';
import { Settings2, Maximize, Sparkles, ArrowRight, Trophy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

type Winner = { number: number; prize: string; time: string; prizeImageId?: string };
type State = { total: number; prize: string; winners: Winner[]; prizeImageId: string; prizeImages: Record<string, string> };
const KEY = 'spacemit-lottery-2026-v1';
const initial: State = { total: 150, prize : 'K1 MUSE PI PRO', winners: [], prizeImageId: '', prizeImages: {} };
export default function Home() {
  const [state, setState] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(false);
  const [history, setHistory] = useState(false);
  const [total, setTotal] = useState('150');
  const [prize, setPrize] = useState(initial.prize);
  const [prizeImage, setPrizeImage] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  const uploadVersion = useRef(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rolling, setRolling] = useState(false);
  const [number, setNumber] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [reset, setReset] = useState(false);
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: object, options: { signal: AbortSignal }) => unknown } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(context.registerTool({
        name: 'get_lottery_status', title: '查看本场抽奖状态',
        description: 'Read configured participant count, prize and committed winners for this local lottery. Does not draw or change settings.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input: unknown) {
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Expected an empty object');
          const current = stateRef.current;
          return { total: current.total, prize: current.prize, winners: current.winners, hasPrizeImage: Boolean(current.prizeImageId), remaining: current.total - current.winners.length };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  const lastWinner = state.winners.at(-1);
  const awardedPrize = lastWinner?.prize ?? state.prize;
  const awardedImage = lastWinner?.prizeImageId ? state.prizeImages[lastWinner.prizeImageId] : '';
  const remaining = state.total - state.winners.length;
  const digits = (n: number) => String(n).padStart(Math.max(3, String(state.total).length), '0');
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (!Number.isInteger(s.total) || s.total < 1 || s.total > 10000 || typeof s.prize !== 'string' || !s.prize.trim() || !Array.isArray(s.winners) || s.winners.some((w: Winner) => !Number.isInteger(w.number) || w.number < 1 || w.number > s.total || typeof w.prize !== 'string' || typeof w.time !== 'string') || new Set(s.winners.map((w: Winner) => w.number)).size !== s.winners.length) throw Error();
        // v1 records without images remain valid; discard malformed optional image fields.
        const images: Record<string, string> = Object.fromEntries(Object.entries(s.prizeImages ?? {}).filter((entry): entry is [string, string] => /^img-[a-f0-9]+$/.test(entry[0]) && typeof entry[1] === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(entry[1])));
        const imageId = typeof s.prizeImageId === 'string' && images[s.prizeImageId] ? s.prizeImageId : '';
        setState({ ...s, prizeImages: images, prizeImageId: imageId }); setTotal(String(s.total)); setPrize(s.prize); setPrizeImage(images[imageId] ?? '');
        if (s.winners.length) { setNumber(s.winners.at(-1).number); setRevealed(true); }
      }
    } catch { setNotice('无法读取本机记录。请确认人数与中奖记录后再开始。'); }
    setReady(true);
    return () => { timers.current.forEach(clearTimeout); uploadVersion.current++; };
  }, []);
  function save(s: State): boolean {
    try { localStorage.setItem(KEY, JSON.stringify(s)); }
    catch { setNotice('本机存储失败，操作未保存。请减小奖品图片或释放浏览器存储空间后重试。'); return false; }
    setState(s);
    return true;
  }
  function closeSettings(open: boolean) {
    if (!open) { uploadVersion.current++; setImageLoading(false); }
    setSettings(open);
  }
  async function uploadImage(file: File) {
    const version = ++uploadVersion.current;
    setImageLoading(true); setError('');
    try {
      const image = await readPrizeImage(file);
      if (version === uploadVersion.current) setPrizeImage(image);
    } catch (e) {
      if (version === uploadVersion.current) setError(e instanceof Error ? e.message : '图片读取失败');
    } finally {
      if (version === uploadVersion.current) setImageLoading(false);
    }
  }
  function draw() {
    if (!ready || busy.current || settings || history || !remaining) return;
    busy.current = true; setRolling(true); setRevealed(false);
    const excluded = new Set(state.winners.map(w => w.number));
    const pool = Array.from({ length: state.total }, (_, i) => i + 1).filter(n => !excluded.has(n));
    const winner = selectWinner(pool);
    // Commit before animation so reloading cannot silently discard a winner.
    if (!save({ ...state, winners: [...state.winners, { number: winner, prize: state.prize, prizeImageId: state.prizeImageId, time: new Date().toISOString() }] })) { busy.current = false; setRolling(false); setNumber(null); return; }
    let tick = 0;
    const animate = () => {
      setNumber(selectWinner(pool));
      tick++;
      if (tick < 34) timers.current.push(setTimeout(animate, 45 + tick * 4));
      else { setNumber(winner); setRolling(false); setRevealed(true); busy.current = false; }
    };
    animate();
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLElement && (e.target.closest('button,input,textarea,select,[role="dialog"]') || e.target.isContentEditable))) { e.preventDefault(); draw(); }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  function apply() {
    if (imageLoading) return;
    const n = Number(total);
    if (!/^\d+$/.test(total) || !Number.isInteger(n) || n < 1 || n > 10000) { setError('请输入 1–10000 之间的整数。'); return; }
    if (state.winners.some(w => w.number > n)) { setError('新人数不能小于已中奖的最大号码；如需重新开始，请先重置。'); return; }
    if (!prize.trim()) { setError('请填写本轮奖项名称。'); return; }
    const images = { ...state.prizeImages };
    let imageId = '';
    if (prizeImage) {
      imageId = Object.keys(images).find(id => images[id] === prizeImage) ?? '';
      if (!imageId) {
        imageId = 'img-' + Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
        images[imageId] = prizeImage;
      }
    }
    const referenced = new Set([imageId, ...state.winners.map(w => w.prizeImageId)]);
    const prizeImages = Object.fromEntries(Object.entries(images).filter(([id]) => referenced.has(id)));
    if (!save({ ...state, total: n, prize: prize.trim(), prizeImageId: imageId, prizeImages })) return;
    closeSettings(false); setError(''); setRevealed(false); setNumber(null);
  }
  function exportRecords() {
    const rows = ['中奖号码,奖项,时间', ...state.winners.map(w => [w.number, w.prize, w.time].map(v => '"' + String(v).replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"').join(','))];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = '开发者大会中奖名单.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className={revealed ? 'stage revealed' : 'stage'}>
    <div className="ambient" aria-hidden="true" />
    {revealed && <div className="confetti" aria-hidden="true" key={state.winners.length}>{Array.from({ length: 90 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: ['#ffe7a6', '#d6a652', '#fff8e8', '#e89053'][i % 4], animationDelay: `${(i % 13) * .09}s`, animationDuration: `${3 + (i % 5) * .45}s`, transform: `rotate(${i * 17}deg)` }} />)}</div>}
    <header><div className="brand"><span className="brandmark" aria-hidden="true" /><div>进迭时空<span>SPACEMIT · DEVELOPERS 2026</span></div></div><div className="toolbar"><span className="live"><i /> 现场幸运时刻</span><Button variant="ghost" aria-label="全屏展示" title="全屏展示" onClick={async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { setNotice('当前浏览器不支持全屏，请使用浏览器菜单进入全屏。'); } }}><Maximize /></Button><Button variant="ghost" disabled={rolling || !ready} onClick={() => { setTotal(String(state.total)); setPrize(state.prize); setPrizeImage(state.prizeImages[state.prizeImageId] ?? ''); setError(''); setReset(false); setSettings(true); }}><Settings2 /> 后台设置</Button></div></header>
    <section className="center">
      <div className="eyebrow"><span /> THE LUCKY MOMENT <span /></div>
      <h1>进迭时空开发者大会 <em>2026</em></h1>
      <p className="tagline">Open Source, Build Things</p>
      <div className="prize"><Sparkles size={16} /> {revealed ? awardedPrize : state.prize}</div>
      <div className={`reveal-layout ${revealed ? 'has-prize' : ''}`}>
        <div className={`number-area ${rolling ? 'rolling' : ''}`}>
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="number-label">{rolling ? '幸运号码正在诞生' : revealed ? '恭 喜 中 奖' : '下 一 位 幸 运 开 发 者'}</div>
          <div className="number" aria-hidden="true">{number === null ? '???' : digits(number)}</div>
                 </div>
        {revealed && <section className="awarded-prize" aria-label="本轮中奖奖品" key={lastWinner?.time}>
          <div className="prize-art">{awardedImage ? <img src={awardedImage} alt={awardedPrize} /> : <Trophy aria-hidden="true" className="prize-trophy" />}</div>
          <p className="prize-caption">你的专属幸运好礼</p>
          <h2>{awardedPrize}</h2>
          <span className="prize-congrats">CONGRATULATIONS</span>
        </section>}
      </div>
      <div role="status" className="sr-only">{!rolling && revealed && number !== null ? `恭喜 ${number} 号中奖，获得 ${awardedPrize}` : rolling ? '抽奖中' : '等待抽奖'}</div>
      <Button className="draw" disabled={!ready || rolling || remaining === 0} onClick={draw}><Sparkles size={22} />{rolling ? '好运即将揭晓…' : remaining === 0 ? '全部号码已抽完' : revealed ? '抽取下一位' : '开启幸运时刻'}{!rolling && <ArrowRight size={22} />}</Button>
      <p className="shortcut" aria-hidden="true">&nbsp;</p>
      <div className="stats"><div>参与号码 <strong>001 — {digits(state.total)}</strong></div><span /><div>待抽取 <strong>{remaining}<small> 位</small></strong></div><span /><Button variant="ghost" disabled={rolling} onClick={() => setHistory(true)}>已中奖 <strong>{state.winners.length}<small> 位</small></strong><ArrowRight size={14} /></Button></div>
    </section>
    <footer><span>Open Source, Build Things</span></footer>
    {notice && <div className="notice" role="alert">{notice}<Button variant="ghost" onClick={() => setNotice('')}>知道了</Button></div>}
    <Dialog open={settings} onOpenChange={closeSettings}><DialogContent className="settings"><DialogTitle>抽奖后台设置</DialogTitle><DialogDescription>现场按 1 至到场人数连续发号。设置和中奖记录仅保存在本机此浏览器，请只使用一个抽奖页面。</DialogDescription><label htmlFor="total">现场到场人数</label><Input id="total" type="number" min={1} max={10000} value={total} onChange={e => setTotal(e.target.value)} /><label htmlFor="prize">本轮奖品名称</label><Input id="prize" maxLength={40} value={prize} onChange={e => setPrize(e.target.value)} /><label htmlFor="prize-image">奖品图片（可选）</label>
      <Input id="prize-image" type="file" accept="image/png,image/jpeg,image/webp" disabled={imageLoading} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void uploadImage(file); }} />
      <p className="hint">支持 PNG、JPG、WebP，单张不超过 500 KB。图片仅保存在本机浏览器，中奖时和名称一起展示。</p>
      {imageLoading && <p role="status">正在读取图片…</p>}
      {prizeImage && <div className="prize-preview"><img src={prizeImage} alt="奖品图片预览" /><Button variant="ghost" disabled={imageLoading} onClick={() => setPrizeImage('')}>移除图片</Button></div>}
      <p className="hint">修改人数会保留已有中奖记录；新增号码自动加入抽奖池。演练结束后，请重置记录再正式抽奖。</p>{error && <p role="alert" className="error">{error}</p>}<Button disabled={imageLoading} onClick={apply}>保存并返回大屏</Button><div className="reset-area">{reset ? <><p>确定清空全部 {state.winners.length} 条中奖记录？此操作无法撤销。</p><Button variant="destructive" onClick={() => { if (!save({ ...state, winners: [], prizeImages: state.prizeImageId ? { [state.prizeImageId]: state.prizeImages[state.prizeImageId] } : {} })) return; setNumber(null); setRevealed(false); setReset(false); }}>确认清空记录</Button><Button variant="ghost" onClick={() => setReset(false)}>取消</Button></> : <Button variant="ghost" disabled={!state.winners.length} onClick={() => setReset(true)}>重置本场抽奖记录</Button>}</div></DialogContent></Dialog>
    <Dialog open={history} onOpenChange={setHistory}><DialogContent className="settings"><DialogTitle>本场幸运名单</DialogTitle><DialogDescription>共 {state.winners.length} 位中奖开发者 · 已中奖号码不再参与后续抽奖</DialogDescription><div className="winner-list">{!state.winners.length ? <p>好运还在等待，开始第一轮抽奖吧。</p> : state.winners.slice().reverse().map((w, i) => <div key={w.number}><Trophy size={18} /><strong>{digits(w.number)}</strong><span>{w.prize}</span><small>第 {state.winners.length - i} 轮</small></div>)}</div><Button disabled={!state.winners.length} onClick={exportRecords}><Download /> 导出中奖名单</Button></DialogContent></Dialog>
  </main>;
}
