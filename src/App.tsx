import { useEffect, useMemo, useState } from "react";

type WeightPoint = {
  date: string; // yyyy-mm-dd
  weight: number;
  note?: string;
};

const STORAGE_KEY = "vibecoding-fitness-weight";
const PERIOD_DATES_KEY = "vibecoding-fitness-period-dates";
const USER_NAME_KEY = "vibecoding-fitness-user-name";
const GOAL_WEIGHT_KEY = "vibecoding-fitness-goal-weight";

function loadInitialData(userName: string): WeightPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // 兼容旧版本：直接存数组
    if (Array.isArray(parsed)) {
      return parsed.map((p: WeightPoint) => ({
        date: p.date,
        weight: Number(p.weight),
        note: p.note
      }));
    }
    if (!parsed || typeof parsed !== "object") return [];
    const byName = parsed as Record<string, WeightPoint[]>;
    const list = Array.isArray(byName[userName]) ? byName[userName] : [];
    return list.map((p) => ({
      date: p.date,
      weight: Number(p.weight),
      note: p.note
    }));
  } catch {
    return [];
  }
}

function loadGoalWeight(userName: string): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(GOAL_WEIGHT_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed;
    if (!parsed || typeof parsed !== "object") return "";
    const byName = parsed as Record<string, string>;
    return typeof byName[userName] === "string" ? byName[userName] : "";
  } catch {
    return "";
  }
}

function saveGoalWeight(userName: string, goal: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(GOAL_WEIGHT_KEY);
    let base: Record<string, string> = {};
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") {
        base[userName] = parsed;
      } else if (parsed && typeof parsed === "object") {
        base = parsed as Record<string, string>;
      }
    }
    base[userName] = goal;
    window.localStorage.setItem(GOAL_WEIGHT_KEY, JSON.stringify(base));
  } catch {
    window.localStorage.setItem(
      GOAL_WEIGHT_KEY,
      JSON.stringify({ [userName]: goal })
    );
  }
}

function saveData(userName: string, data: WeightPoint[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    let base: Record<string, WeightPoint[]> = {};
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        base[userName] = parsed as WeightPoint[];
      } else if (parsed && typeof parsed === "object") {
        base = parsed as Record<string, WeightPoint[]>;
      }
    }
    base[userName] = data;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ [userName]: data }));
  }
}

function loadPeriodDates(userName: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PERIOD_DATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((d: unknown) => typeof d === "string") as string[];
    }
    if (!parsed || typeof parsed !== "object") return [];
    const byName = parsed as Record<string, string[]>;
    const list = Array.isArray(byName[userName]) ? byName[userName] : [];
    return list.filter((d) => typeof d === "string");
  } catch {
    return [];
  }
}

function savePeriodDates(userName: string, dates: string[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(PERIOD_DATES_KEY);
    let base: Record<string, string[]> = {};
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        base[userName] = parsed as string[];
      } else if (parsed && typeof parsed === "object") {
        base = parsed as Record<string, string[]>;
      }
    }
    base[userName] = dates;
    window.localStorage.setItem(PERIOD_DATES_KEY, JSON.stringify(base));
  } catch {
    window.localStorage.setItem(
      PERIOD_DATES_KEY,
      JSON.stringify({ [userName]: dates })
    );
  }
}

async function fetchFromServer(
  userName: string
): Promise<{ weight: WeightPoint[]; periodDates: string[] } | null> {
  try {
    const resp = await fetch(`/api/data?name=${encodeURIComponent(userName)}`);
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      weight?: WeightPoint[];
      periodDates?: string[];
    };
    return {
      weight: Array.isArray(json.weight) ? json.weight : [],
      periodDates: Array.isArray(json.periodDates) ? json.periodDates : []
    };
  } catch {
    return null;
  }
}

function syncToServer(
  userName: string,
  weight: WeightPoint[],
  periodDates: string[]
) {
  void fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: userName, weight, periodDates })
  }).catch(() => {});
}

export function App() {
  const [view, setView] = useState<"home" | "weight" | "period">("home");
  const [userName, setUserName] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(USER_NAME_KEY);
      return stored && stored.trim() ? stored.trim() : null;
    } catch {
      return null;
    }
  });
  const [nameInput, setNameInput] = useState<string>("");
  const [data, setData] = useState<WeightPoint[]>([]);
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [weight, setWeight] = useState<string>("");
  const [periodDates, setPeriodDates] = useState<string[]>([]);
  const [goalWeight, setGoalWeight] = useState<string>("");
  const [weightNote, setWeightNote] = useState<string>("");

  useEffect(() => {
    if (!userName) return;
    const localWeight = loadInitialData(userName);
    const localPeriods = loadPeriodDates(userName);
    const localGoal = loadGoalWeight(userName);
    setData(localWeight);
    setPeriodDates(localPeriods);
    setGoalWeight(localGoal);

    void (async () => {
      const fromServer = await fetchFromServer(userName);
      if (!fromServer) return;
      // 简单合并：把两边的日期去重合并
      const weightMap = new Map<string, number>();
      [...localWeight, ...fromServer.weight].forEach((w) => {
        weightMap.set(w.date, w.weight);
      });
      const mergedWeight: WeightPoint[] = Array.from(weightMap.entries()).map(
        ([date, weight]) => ({ date, weight })
      );
      const mergedPeriods = Array.from(
        new Set<string>([...localPeriods, ...fromServer.periodDates])
      ).sort();
      setData(mergedWeight);
      setPeriodDates(mergedPeriods);
      saveData(userName, mergedWeight);
      savePeriodDates(userName, mergedPeriods);
    })();
  }, [userName]);

  const sortedData = useMemo(
    () =>
      [...data].sort((a, b) => a.date.localeCompare(b.date)),
    [data]
  );

  const minWeight = useMemo(() => {
    if (sortedData.length === 0) return 40;
    return Math.min(...sortedData.map((p) => p.weight)) - 1;
  }, [sortedData]);

  const maxWeight = useMemo(() => {
    if (sortedData.length === 0) return 60;
    return Math.max(...sortedData.map((p) => p.weight)) + 1;
  }, [sortedData]);

  const handleAdd = () => {
    if (!userName) return;
    const v = Number(weight);
    if (!date || Number.isNaN(v)) return;
    const next = [
      ...data.filter((p) => p.date !== date),
      { date, weight: v, note: weightNote.trim() || undefined }
    ];
    setData(next);
    saveData(userName, next);
    syncToServer(userName, next, periodDates);
    setWeight("");
    setWeightNote("");
  };

  const handleClear = () => {
    if (!window.confirm("确定要清空所有体重记录吗？")) return;
    setData([]);
    if (userName) {
      saveData(userName, []);
      syncToServer(userName, [], periodDates);
    }
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setUserName(trimmed);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(USER_NAME_KEY, trimmed);
    }
  };

  const latestWeight = useMemo(() => {
    if (sortedData.length === 0) return null;
    return sortedData[sortedData.length - 1];
  }, [sortedData]);

  const goalNumber = useMemo(() => {
    const v = Number(goalWeight);
    return Number.isFinite(v) && v > 0 ? v : null;
  }, [goalWeight]);

  return (
    <div className="app-root">
      <div className="app-shell">
        {!userName ? (
          <>
            <header className="app-header">
              <div>
                <div className="app-title">轻绿生活</div>
                <div className="app-subtitle">先给自己取一个温柔的小名</div>
              </div>
            </header>
            <main className="app-main">
              <section className="card home-card">
                <div className="card-header">
                  <div>
                    <div className="card-title">你想让我怎么称呼你？</div>
                    <div className="card-subtitle">
                      这个名字只保存在你自己的设备里
                    </div>
                  </div>
                </div>
                <label className="field">
                  <span className="field-label">昵称</span>
                  <input
                    className="field-input"
                    placeholder="例如：小月 / Lili / 自己喜欢的称呼"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                  />
                </label>
                <button className="primary-button" onClick={handleSaveName}>
                  确认这个名字
                </button>
              </section>
            </main>
          </>
        ) : (
          <>
        <header className="app-header">
          {(view === "weight" || view === "period") && (
            <button
              className="nav-back-button"
              type="button"
              onClick={() => setView("home")}
            >
              <span className="nav-back-chevron">‹</span>
              <span className="nav-back-text">主页</span>
            </button>
          )}
          <div>
            <div className="app-title">轻绿生活</div>
            <div className="app-subtitle">
              {view === "home"
                ? `你好，${userName}，一起记录一点点好状态`
                : view === "weight"
                ? "记录体重 · 记录状态"
                : "记录生理期 · 照顾身体"}
            </div>
          </div>
        </header>

        {view === "home" ? (
          <main className="app-main">
            <section className="card home-card">
              <div className="card-header">
                <div>
                  <div className="card-title">今天，先关心一下自己</div>
                  <div className="card-subtitle">
                    小小的记录，也是在对自己温柔一点
                  </div>
                </div>
              </div>
              <button
                className="primary-button"
                onClick={() => setView("weight")}
              >
                去记录体重
              </button>
            </section>
            <section className="card home-card">
              <div className="card-header">
                <div>
                  <div className="card-title">生理期小记</div>
                  <div className="card-subtitle">
                    记下来，下一次就大概知道什么时候来了
                  </div>
                </div>
              </div>
              <button
                className="primary-button"
                onClick={() => setView("period")}
              >
                去记录生理期
              </button>
            </section>
          </main>
        ) : view === "weight" ? (
          <main className="app-main">
            <section className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">今日体重</div>
                  <div className="card-subtitle">
                    轻点一下，留下今天的数字
                  </div>
                </div>
                <button className="ghost-button" onClick={handleClear}>
                  清空
                </button>
              </div>

              <div className="form-row">
                <label className="field">
                  <span className="field-label">日期</span>
                  <input
                    className="field-input"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="field-label">体重 (kg)</span>
                  <input
                    className="field-input"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    placeholder="例如 52.3"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                </label>
              </div>

              <div className="form-row">
                <label className="field">
                  <span className="field-label">目标体重 (kg，可选)</span>
                  <input
                    className="field-input"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    placeholder="例如 49"
                    value={goalWeight}
                    onChange={(e) => {
                      setGoalWeight(e.target.value);
                      if (userName) {
                        saveGoalWeight(userName, e.target.value);
                      }
                    }}
                  />
                </label>
              </div>

              <label className="field">
                <span className="field-label">今天的小备注（可选）</span>
                <input
                  className="field-input"
                  placeholder="例如：吃了火锅 / 运动后 / 来例假中"
                  value={weightNote}
                  onChange={(e) => setWeightNote(e.target.value)}
                />
              </label>

              <button className="primary-button" onClick={handleAdd}>
                记录今天
              </button>
            </section>

            <section className="card chart-card">
              <div className="card-header">
                <div className="card-title">体重变化</div>
                <div className="card-subtitle">
                  纵向为体重，横向为日期
                  {goalNumber !== null && latestWeight && (
                    <>
                      ，当前 {latestWeight.weight.toFixed(1)}kg，距离目标{" "}
                      {goalNumber.toFixed(1)}kg 约{" "}
                      {Math.abs(
                        latestWeight.weight - goalNumber
                      ).toFixed(1)}
                      kg
                    </>
                  )}
                </div>
              </div>

              <WeightChart
                data={sortedData}
                minWeight={minWeight}
                maxWeight={maxWeight}
                goal={goalNumber}
              />
            </section>
          </main>
        ) : (
          <main className="app-main">
            <PeriodView
              dates={periodDates}
              onChange={(next) => {
                setPeriodDates(next);
                savePeriodDates(userName, next);
                syncToServer(userName, data, next);
              }}
            />
          </main>
        )}
          </>
        )}
      </div>
    </div>
  );
}

type ChartProps = {
  data: WeightPoint[];
  minWeight: number;
  maxWeight: number;
  goal: number | null;
};

function WeightChart({ data, minWeight, maxWeight, goal }: ChartProps) {
  const padding = 16;
  const width = 320;
  const height = 200;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  if (data.length === 0) {
    return (
      <div className="chart-empty">
        还没有记录，先在上面添加一条体重吧。
      </div>
    );
  }

  const xStep =
    data.length > 1 ? innerWidth / (data.length - 1) : 0;
  const weightRange = maxWeight - minWeight || 1;

  const points = data.map((p, index) => {
    const x = padding + index * xStep;
    const y =
      padding +
      innerHeight -
      ((p.weight - minWeight) / weightRange) * innerHeight;
    return { x, y, ...p };
  });

  return (
    <div className="chart-container">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="chart-svg"
        preserveAspectRatio="none"
      >
        {/* 背景渐变 */}
        <defs>
          <linearGradient
            id="chart-bg"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#b0f2d0" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#0f7960" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <rect
          x={padding}
          y={padding}
          width={innerWidth}
          height={innerHeight}
          fill="url(#chart-bg)"
          rx="14"
        />

        {/* 竖线：每个日期一条 */}
        {points.map((p, index) => (
          <line
            key={`v-${index}`}
            x1={p.x}
            y1={padding}
            x2={p.x}
            y2={padding + innerHeight}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
        ))}

        {/* 折线：上涨为红色，其余为绿色 */}
        {points.map((p, index) => {
          if (index === 0) return null;
          const prev = points[index - 1];
          const isUp = p.weight > prev.weight;
          const color = isUp ? "#ff6b6b" : "#0f7960";
          return (
            <line
              key={`seg-${index}`}
              x1={prev.x}
              y1={prev.y}
              x2={p.x}
              y2={p.y}
              stroke={color}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          );
        })}

        {/* 目标体重线 */}
        {goal !== null && goal >= minWeight && goal <= maxWeight && (
          <line
            x1={padding}
            x2={padding + innerWidth}
            y1={
              padding +
              innerHeight -
              ((goal - minWeight) / (maxWeight - minWeight || 1)) * innerHeight
            }
            y2={
              padding +
              innerHeight -
              ((goal - minWeight) / (maxWeight - minWeight || 1)) * innerHeight
            }
            stroke="rgba(255, 255, 255, 0.9)"
            strokeWidth={1.4}
            strokeDasharray="6 4"
          />
        )}

        {/* 圆点 */}
        {points.map((p, index) => (
          <g key={`p-${index}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r={4.5}
              fill="#ffffff"
              stroke="#0f7960"
              strokeWidth={1.4}
            />
          </g>
        ))}
      </svg>

      <div className="chart-footer">
        {points.map((p, index) => (
          <div className="chart-tick" key={index}>
            <div className="chart-tick-date">
              {p.date.slice(5).replace("-", "/")}
            </div>
            <div className="chart-tick-weight">
              {p.weight.toFixed(1)}
            </div>
            {p.note && (
              <div className="chart-tick-note">{p.note}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type PeriodViewProps = {
  dates: string[];
  onChange: (next: string[]) => void;
};

function PeriodView({ dates, onChange }: PeriodViewProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-11

  const monthLabel = `${year}年${String(month + 1).padStart(2, "0")}月`;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay(); // 0-6, 0=周日

  const cells = useMemo(() => {
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    const result: (number | null)[] = [];
    for (let i = 0; i < totalCells; i += 1) {
      const day = i - firstWeekday + 1;
      result.push(day >= 1 && day <= daysInMonth ? day : null);
    }
    return result;
  }, [firstWeekday, daysInMonth]);

  const toggleDate = (day: number) => {
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    const dateStr = `${year}-${m}-${d}`;
    const exists = dates.includes(dateStr);
    const next = exists
      ? dates.filter((v) => v !== dateStr)
      : [...dates, dateStr].sort();
    onChange(next);
  };

  const goMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setYear(newYear);
    setMonth(newMonth);
  };

  const sortedAsc = useMemo(() => [...dates].sort(), [dates]);
  const sortedDates = [...sortedAsc].reverse();

  const cycleSummary = useMemo(() => {
    if (sortedAsc.length === 0) return null;
    const parse = (d: string) => new Date(d + "T00:00:00");
    const clusters: { start: Date; end: Date }[] = [];
    let currentStart: Date | null = null;
    let prev: Date | null = null;
    sortedAsc.forEach((d) => {
      const cur = parse(d);
      if (!currentStart) {
        currentStart = cur;
        prev = cur;
        return;
      }
      if (
        prev &&
        (cur.getTime() - prev.getTime()) / 86400000 <= 1.1
      ) {
        prev = cur;
      } else {
        clusters.push({ start: currentStart, end: prev! });
        currentStart = cur;
        prev = cur;
      }
    });
    if (currentStart && prev) {
      clusters.push({ start: currentStart, end: prev });
    }
    if (clusters.length === 0) return null;
    const lengths = clusters.map(
      (c) => (c.end.getTime() - c.start.getTime()) / 86400000 + 1
    );
    const avgLength =
      lengths.reduce((s, v) => s + v, 0) / lengths.length;
    if (clusters.length < 2) return { avgGap: null as number | null, avgLength };
    const starts = clusters.map((c) => c.start);
    const gaps: number[] = [];
    for (let i = 1; i < starts.length; i += 1) {
      gaps.push(
        (starts[i].getTime() - starts[i - 1].getTime()) / 86400000
      );
    }
    const avgGap = gaps.reduce((s, v) => s + v, 0) / gaps.length;
    return { avgGap, avgLength };
  }, [sortedAsc]);

  return (
    <>
      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">生理期日历</div>
            <div className="card-subtitle">
              在日历上点一下这一天，表示有来
            </div>
          </div>
          {dates.length > 0 && (
            <button
              className="ghost-button"
              onClick={() => {
                if (window.confirm("确定要清空所有生理期记录吗？")) {
                  onChange([]);
                }
              }}
            >
              清空
            </button>
          )}
        </div>

        <div className="period-calendar-header">
          <button
            type="button"
            className="calendar-nav"
            onClick={() => goMonth(-1)}
          >
            ‹
          </button>
          <div className="period-calendar-title">{monthLabel}</div>
          <button
            type="button"
            className="calendar-nav"
            onClick={() => goMonth(1)}
          >
            ›
          </button>
        </div>

        <div className="period-calendar-week">
          {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
            <div key={w} className="period-calendar-weekday">
              {w}
            </div>
          ))}
        </div>

        <div className="period-calendar-grid">
          {cells.map((day, idx) => {
            if (!day) {
              return <div key={idx} className="period-day empty" />;
            }
            const m = String(month + 1).padStart(2, "0");
            const d = String(day).padStart(2, "0");
            const dateStr = `${year}-${m}-${d}`;
            const selected = dates.includes(dateStr);
            const isToday =
              dateStr ===
              `${today.getFullYear()}-${String(
                today.getMonth() + 1
              ).padStart(2, "0")}-${String(today.getDate()).padStart(
                2,
                "0"
              )}`;
            return (
              <button
                key={idx}
                type="button"
                className={`period-day${selected ? " selected" : ""}${
                  isToday ? " today" : ""
                }`}
                onClick={() => toggleDate(day)}
              >
                <span className="period-day-number">{day}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card chart-card">
        <div className="card-header">
          <div className="card-title">已记录的日期</div>
          <div className="card-subtitle">
            方便大致回顾这几个月的节奏
            {cycleSummary && (
              <>
                ，平均每{" "}
                {cycleSummary.avgGap
                  ? cycleSummary.avgGap.toFixed(0)
                  : "？"}
                天来一次，每次大约{" "}
                {cycleSummary.avgLength.toFixed(0)} 天
              </>
            )}
          </div>
        </div>
        {sortedDates.length === 0 ? (
          <div className="chart-empty">
            还没有生理期记录，可以先在上面的日历里点一下有来的一天。
          </div>
        ) : (
          <div className="period-list">
            {sortedDates.map((d) => (
              <div className="period-item" key={d}>
                <div className="period-main">
                  <div className="period-dates">{d}</div>
                </div>
                <button
                  className="period-delete"
                  type="button"
                  onClick={() => onChange(dates.filter((v) => v !== d))}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

