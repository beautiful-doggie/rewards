'use client';
import { selectWinner } from '@/lib/lottery';
import {
  INITIAL_STATE,
  LEGACY_STORAGE_KEY,
  ROUNDS,
  STORAGE_KEY,
  formatUnissuedNumbers,
  isLotteryState,
  parseUnissuedNumbers,
  prizeImage,
  type LotteryState,
} from '@/lib/rounds';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import {
  Settings2,
  Maximize,
  Sparkles,
  ArrowRight,
  Trophy,
  Download,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function loadSession(ready: boolean) {
  const session = { state: INITIAL_STATE, notice: '', blocked: false };
  if (!ready) return session;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const stored: unknown = JSON.parse(raw);
      if (!isLotteryState(stored)) throw new Error('Invalid lottery state');
      session.state = {
        ...stored,
        unissued: stored.unissued ?? [],
        unclaimed: stored.unclaimed ?? [],
      };
    } else {
      // A new event starts from round one; never rewrite the old free-form records.
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const previous = JSON.parse(legacy);
        if (
          previous &&
          Number.isInteger(previous.total) &&
          previous.total >= ROUNDS.length &&
          previous.total <= 10000
        ) {
          session.state = {
            total: previous.total,
            winners: [],
            unissued: [],
            unclaimed: [],
          };
        }
        if (previous?.winners?.length)
          session.notice =
            '已启用新的六轮抽奖。旧版记录仍保留在此浏览器中，不计入本场进度。';
      }
    }
  } catch {
    session.blocked = true;
    session.notice =
      '无法读取本场记录，已暂停抽奖以免重复中奖。请恢复浏览器存储，或在活动设置中确认重置后开始新一场。';
  }
  return session;
}

export default function Home() {
  const ready = useSyncExternalStore(
    subscribeToHydration,
    clientReady,
    serverReady,
  );
  return <Lottery key={ready ? 'ready' : 'loading'} ready={ready} />;
}

function Lottery({ ready }: { ready: boolean }) {
  const [session] = useState(() => loadSession(ready));
  const [state, setState] = useState<LotteryState>(session.state);
  const [settings, setSettings] = useState(false);
  const [history, setHistory] = useState(false);
  const [total, setTotal] = useState(String(session.state.total));
  const [unissued, setUnissued] = useState(
    formatUnissuedNumbers(session.state.unissued),
  );
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(session.notice);
  const [storageBlocked, setStorageBlocked] = useState(session.blocked);
  const [rolling, setRolling] = useState(false);
  const [number, setNumber] = useState<number | null>(
    session.state.winners.at(-1)?.number ?? null,
  );
  const [revealed, setRevealed] = useState(
    session.state.winners.length > 0,
  );
  const [reset, setReset] = useState(false);
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completed = state.winners.length;
  const finished = completed === ROUNDS.length;
  // Saving happens before the animation; keep that round's prize on screen until the next click.
  const displayRound =
    (rolling || revealed) && completed
      ? completed - 1
      : Math.min(completed, ROUNDS.length - 1);
  const displayedPrize = ROUNDS[displayRound];
  const digits = (n: number) =>
    String(n).padStart(Math.max(3, String(state.total).length), '0');

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => pendingTimers.forEach(clearTimeout);
  }, []);

  function save(next: LotteryState): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setNotice(
        '本机记录保存失败，本次操作未生效。请释放浏览器存储空间后重试。',
      );
      return false;
    }
    setState(next);
    return true;
  }

  function draw(redraw = false) {
    if (
      !ready ||
      storageBlocked ||
      busy.current ||
      settings ||
      history ||
      (redraw ? !revealed || !completed : finished)
    )
      return;
    // Ref guard also blocks multiple clicks before React updates the disabled button.
    busy.current = true;
    const winners = redraw ? state.winners.slice(0, -1) : state.winners;
    const unclaimed = redraw
      ? [...state.unclaimed, state.winners[completed - 1].number]
      : state.unclaimed;
    const excluded = new Set(state.winners.map((w) => w.number));
    for (const n of state.unissued) excluded.add(n);
    for (const n of state.unclaimed) excluded.add(n);
    const pool = Array.from({ length: state.total }, (_, i) => i + 1).filter(
      (n) => !excluded.has(n),
    );
    if (!pool.length) {
      busy.current = false;
      setNotice('暂无可抽号码，请在活动设置中增加参与人数或核对未发出号码后重试。');
      return;
    }
    let winner: number;
    try {
      winner = selectWinner(pool);
    } catch {
      busy.current = false;
      setNotice('无法生成中奖号码，请确认浏览器支持随机数生成后重试。');
      return;
    }
    if (
      !save({
        ...state,
        unclaimed,
        winners: [
          ...winners,
          {
            number: winner,
            prize: ROUNDS[winners.length].name,
            time: new Date().toISOString(),
          },
        ],
      })
    ) {
      busy.current = false;
      return;
    }
    setRolling(true);
    setRevealed(false);
    setNotice('');
    timers.current.forEach(clearTimeout);
    timers.current.length = 0;
    let tick = 0;
    const animate = () => {
      setNumber(pool[Math.floor(Math.random() * pool.length)]);
      tick++;
      if (tick < 34) timers.current.push(setTimeout(animate, 10 + tick));
      else {
        setNumber(winner);
        setRolling(false);
        setRevealed(true);
        busy.current = false;
      }
    };
    animate();
  }

  function apply() {
    const n = Number(total);
    if (
      !/^\d+$/.test(total) ||
      !Number.isInteger(n) ||
      n < ROUNDS.length ||
      n > 10000
    ) {
      setError('请输入 6–10000 之间的整数，确保六轮各有一位中奖者。');
      return;
    }
    if (state.winners.some((w) => w.number > n)) {
      setError('人数不能小于已中奖号码；如需重新开始，请先重置记录。');
      return;
    }
    if (state.unclaimed.some((number) => number > n)) {
      setError('人数不能小于无人认领号码；如需重新开始，请先重置本场记录。');
      return;
    }
    let unissuedNumbers: number[];
    try {
      unissuedNumbers = parseUnissuedNumbers(unissued, n);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未发出号码格式无效。');
      return;
    }
    if (state.winners.some((winner) => unissuedNumbers.includes(winner.number))) {
      setError('未发出号码不能包含已抽中的中奖号码。');
      return;
    }
    const excludedNumbers = new Set([...unissuedNumbers, ...state.unclaimed]);
    if (n - excludedNumbers.size < ROUNDS.length) {
      setError(`扣除未发出及无人认领号码后，至少需要 ${ROUNDS.length} 个号码才能完成六轮抽奖。`);
      return;
    }
    if (!save({ ...state, total: n, unissued: unissuedNumbers })) return;
    setSettings(false);
    setError('');
  }

  function resetEvent() {
    if (!save({ ...state, winners: [], unclaimed: [] })) return;
    setNumber(null);
    setRevealed(false);
    setReset(false);
    setStorageBlocked(false);
    setNotice('');
    setSettings(false);
  }

  function exportRecords() {
    const rows = [
      '轮次,中奖号码,奖项,时间',
      ...state.winners.map((w, i) =>
        [i + 1, w.number, w.prize, w.time]
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(','),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + rows.join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = '开发者大会中奖名单.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className={revealed ? 'stage revealed' : 'stage'}>
      <div className="ambient" aria-hidden="true" />
      {revealed && (
        <div className="confetti" aria-hidden="true" key={completed}>
          {Array.from({ length: 90 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                background: ['#ffe7a6', '#d6a652', '#fff8e8', '#e89053'][i % 4],
                animationDelay: `${(i % 13) * 0.09}s`,
                animationDuration: `${3 + (i % 5) * 0.45}s`,
                transform: `rotate(${i * 17}deg)`,
              }}
            />
          ))}
        </div>
      )}
      <header>
        <div className="brand">
          <span
            className="brandmark"
            aria-hidden="true"
            style={{
              backgroundImage: `url(${prizeImage('/spacemit-mark.svg')})`,
            }}
          />
          <div>
            进迭时空<span>SPACEMIT · DEVELOPERS 2026</span>
          </div>
        </div>
        <div className="toolbar">
          <span className="live">
            <i /> 现场幸运时刻
          </span>
          <Button
            variant="ghost"
            aria-label="全屏展示"
            title="全屏展示"
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
              } catch {
                setNotice('当前浏览器不支持全屏，请使用浏览器菜单进入全屏。');
              }
            }}
          >
            <Maximize />
          </Button>
          <Button
            variant="ghost"
            disabled={rolling || !ready}
            onClick={() => {
              setTotal(String(state.total));
              setUnissued(formatUnissuedNumbers(state.unissued));
              setError('');
              setReset(false);
              setSettings(true);
            }}
          >
            <Settings2 /> 活动设置
          </Button>
        </div>
      </header>
      <section className="center">
        <h1>
          进迭时空开发者大会 <em>2026</em>
        </h1>
        <p className="tagline">Open Source, Build Things</p>
        <div className="prize">
          <Sparkles size={16} />
          <span>第 {displayRound + 1} / 6 轮</span>
          <b>{displayedPrize.name}</b>
        </div>
        <div className="reveal-layout has-prize">
          <div className={`number-area ${rolling ? 'rolling' : ''}`}>
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="number-label">
              {rolling
                ? '幸运号码正在诞生'
                : revealed
                  ? '恭 喜 中 奖'
                  : '下 一 位 幸 运 开 发 者'}
            </div>
            <div className="number" aria-hidden="true">
              {number === null ? '???' : digits(number)}
            </div>
          </div>
          <section
            className="awarded-prize"
            aria-label={revealed ? '本轮中奖奖品' : '本轮待抽奖品'}
            key={displayRound}
          >
            <div className="prize-art">
              <Image
                unoptimized
                src={prizeImage(displayedPrize.image)}
                alt={displayedPrize.name}
                width={520}
                height={360}
              />
            </div>
            <p className="prize-caption">
              {revealed ? '你的专属幸运好礼' : '本轮幸运好礼 · 1 位中奖者'}
            </p>
            <h2>{displayedPrize.name}</h2>
            <span className="prize-congrats">
              {revealed ? 'CONGRATULATIONS' : 'GOOD LUCK, DEVELOPERS'}
            </span>
          </section>
        </div>
        <output className="sr-only">
          {!rolling && revealed && number !== null
            ? `第 ${displayRound + 1} 轮，恭喜 ${number} 号中奖，获得 ${displayedPrize.name}${finished ? '，六轮抽奖已完成' : ''}`
            : rolling
              ? '抽奖中'
              : '等待抽奖'}
        </output>
        <div className="draw-actions">
          {(revealed || rolling) && completed > 0 && (
            <Button
              variant="outline"
              className="redraw"
              disabled={!ready || storageBlocked || rolling}
              onClick={() => draw(true)}
            >
              <RotateCcw size={18} /> 重抽本轮
            </Button>
          )}
          <Button
            className="draw"
            disabled={!ready || storageBlocked || rolling || finished}
            onClick={() => draw()}
          >
            <Sparkles size={22} />
            {rolling
              ? '好运即将揭晓…'
              : finished
                ? '六轮抽奖已完成'
                : completed
                  ? `抽下一轮 · ${completed + 1} / 6`
                  : '抽奖 · 第 1 / 6 轮'}
            {!rolling && !finished && <ArrowRight size={22} />}
          </Button>
        </div>
        <div className="stats">
          <div>
            参与号码 <strong>001 — {digits(state.total)}</strong>
          </div>
          <span />
          <div>
            抽奖进度{' '}
            <strong>
              {completed} / 6<small> 轮</small>
            </strong>
          </div>
          <span />
          <Button
            variant="ghost"
            disabled={rolling || !ready}
            onClick={() => setHistory(true)}
          >
            中奖名单{' '}
            <strong>
              {completed}
              <small> 位</small>
            </strong>
            <ArrowRight size={14} />
          </Button>
        </div>
      </section>
      <footer>
        <span>Open Source, Build Things</span>
      </footer>
      {notice && (
        <div className="notice" role="alert">
          {notice}
          <Button variant="ghost" onClick={() => setNotice('')}>
            知道了
          </Button>
        </div>
      )}
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="settings">
          <DialogTitle>活动设置</DialogTitle>
          <DialogDescription>
            奖品与六轮顺序已预设。返回大屏后，每点击一次抽奖完成一轮，无需切换奖品。
          </DialogDescription>
          <label htmlFor="total">现场到场人数</label>
          <Input
            id="total"
            type="number"
            min={6}
            max={10000}
            value={total}
            disabled={storageBlocked}
            onChange={(e) => setTotal(e.target.value)}
          />
          <label htmlFor="unissued">未发出号码</label>
          <Input
            id="unissued"
            type="text"
            placeholder="例如：40-50, 83-100"
            value={unissued}
            disabled={storageBlocked}
            onChange={(e) => setUnissued(e.target.value)}
          />
          <p className="hint">
            用逗号分隔号码或区间，例如 40-50, 83-100。未发出的号码不会参与抽奖；号码从 001 开始，已中奖号码不会再次抽中。设置和进度保存在此浏览器，请保持一个抽奖页面。演练后可重置为第 1 轮。
          </p>
          {state.unclaimed.length > 0 && (
            <p className="hint">
              本场无人认领号码：{formatUnissuedNumbers(state.unclaimed)}。这些号码不再参与抽奖，重置本场抽奖记录后清除。
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Button disabled={storageBlocked} onClick={apply}>
            保存并返回大屏
          </Button>
          <div className="reset-area">
            {reset ? (
              <>
                <p>
                  确定清空本场 {completed} 条中奖记录并回到第 1
                  轮？无人认领号码也会清除，未发出号码设置保留。此操作无法撤销。
                </p>
                <Button variant="destructive" onClick={resetEvent}>
                  确认重置为第 1 轮
                </Button>
                <Button variant="ghost" onClick={() => setReset(false)}>
                  取消
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                disabled={!completed && !state.unclaimed.length && !storageBlocked}
                onClick={() => setReset(true)}
              >
                重置本场抽奖记录
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={history} onOpenChange={setHistory}>
        <DialogContent className="settings">
          <DialogTitle>本场幸运名单</DialogTitle>
          <DialogDescription>
            已完成 {completed} / 6 轮 · 已中奖号码不再参与后续抽奖
          </DialogDescription>
          <div className="winner-list">
            {!completed ? (
              <p>好运还在等待，开始第一轮抽奖吧。</p>
            ) : (
              state.winners.map((w, i) => (
                <div key={w.number}>
                  <Trophy size={18} />
                  <strong>{digits(w.number)}</strong>
                  <span>{w.prize}</span>
                  <small>第 {i + 1} 轮</small>
                </div>
              ))
            )}
          </div>
          <Button disabled={!completed} onClick={exportRecords}>
            <Download /> 导出中奖名单
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
