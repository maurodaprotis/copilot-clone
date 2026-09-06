import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  INVESTMENT_RANGE_KEYS,
  buildDemoInvestmentsPayload,
  type InvestmentAccount,
  type InvestmentHolding,
  type InvestmentRangeKey,
  type InvestmentsPayload,
} from "@copilot-clone/domain";
import { API_URL, getApiUserId } from "../src/config";
import { colors, radius, spacing, type } from "../src/theme";
import {
  Card,
  EmptyState,
  MasterDetail,
  ProgressBar,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Toggle,
} from "../src/ui";

type DetailSel =
  | { kind: "account"; id: string }
  | { kind: "holding"; id: string }
  | null;

type HoldingSort = "last_price" | "my_equity" | "quantity";

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function usdExact(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function Sparkline({
  values,
  positive,
}: {
  values: number[];
  positive: boolean;
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.01, max - min);
  const w = 72;
  const h = 28;
  const color = positive ? colors.incomeGreen : colors.overBudgetRed;
  return (
    <View style={{ width: w, height: h, justifyContent: "flex-end" }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 1, height: h }}>
        {values.map((v, i) => {
          const barH = Math.max(2, ((v - min) / span) * h);
          return (
            <View
              key={i}
              style={{
                width: Math.max(2, (w - values.length) / values.length),
                height: barH,
                backgroundColor: color,
                opacity: 0.55 + (i / values.length) * 0.45,
                borderRadius: 1,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function BalanceChart({
  data,
  range,
  onRange,
  gearOpen,
  onToggleGear,
}: {
  data: InvestmentsPayload;
  range: InvestmentRangeKey;
  onRange: (r: InvestmentRangeKey) => void;
  gearOpen: boolean;
  onToggleGear: () => void;
}) {
  const points = data.chart;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const h = 120;
  const sample = points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 48)) === 0);

  return (
    <Card style={styles.balanceCard}>
      <View style={styles.balanceTop}>
        <Text style={styles.liveLabel}>Live balance estimate</Text>
        <Pressable onPress={onToggleGear} hitSlop={10} style={styles.gearBtn}>
          <Text style={styles.gear}>⚙</Text>
        </Pressable>
      </View>
      <View style={styles.balanceRow}>
        <Text style={styles.balanceValue}>{usd(data.live_balance_estimate)}</Text>
        <Text style={styles.infoI}>ⓘ</Text>
      </View>
      <Text style={styles.dayChange}>≈ {pct(data.day_change_pct)}</Text>

      <View style={[styles.chartArea, { height: h }]}>
        <View style={styles.baseline} />
        <View style={styles.lineRow}>
          {sample.map((p, i) => {
            const y = ((p.value - min) / span) * (h - 16);
            return (
              <View key={p.t + i} style={styles.lineCol}>
                <View
                  style={[
                    styles.lineDot,
                    i === sample.length - 1 && styles.lineDotActive,
                    { marginBottom: y },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </View>

      <SegmentedControl
        options={[...INVESTMENT_RANGE_KEYS]}
        value={range}
        onChange={(v) => onRange(v as InvestmentRangeKey)}
        style={{ marginTop: spacing.sm }}
      />

      {gearOpen ? (
        <View style={styles.gearPanel}>
          <Text style={styles.gearTitle}>Chart</Text>
          <View style={styles.gearRow}>
            <Text style={styles.gearLabel}>Display Balance</Text>
            <Text style={styles.gearValue}>
              {data.chart_settings.display_balance ? "On" : "Off"}
            </Text>
          </View>
          <View style={styles.gearRow}>
            <Text style={styles.gearLabel}>Benchmark</Text>
            <Text style={styles.gearValue}>{data.chart_settings.benchmark}</Text>
          </View>
          <View style={styles.gearRow}>
            <Text style={styles.gearLabel}>Live balance</Text>
            <Text style={styles.gearValue}>
              {data.chart_settings.live_balance ? "ON" : "Off"}
            </Text>
          </View>
          <View style={styles.gearRow}>
            <Text style={styles.gearLabel}>Accounts included</Text>
            <Text style={styles.gearValue}>
              {data.accounts
                .filter((a) => data.chart_settings.accounts_included.includes(a.id))
                .map((a) => a.name)
                .join(", ") || "—"}
            </Text>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function MoverCard({
  h,
  onPress,
}: {
  h: InvestmentHolding;
  onPress: () => void;
}) {
  const up = h.day_change_pct >= 0;
  return (
    <Pressable onPress={onPress} style={styles.moverCard}>
      <View style={styles.moverTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.moverSym}>{h.symbol}</Text>
          <Text style={styles.moverName} numberOfLines={1}>
            {h.name}
          </Text>
        </View>
        <Text style={styles.moon}>☾</Text>
      </View>
      <Sparkline values={h.sparkline} positive={up} />
      <View
        style={[
          styles.pctPill,
          { backgroundColor: up ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" },
        ]}
      >
        <Text style={{ color: up ? colors.incomeGreen : colors.overBudgetRed, fontWeight: "700", fontSize: 12 }}>
          {up ? "↑" : "↓"} {Math.abs(h.day_change_pct).toFixed(2)}%
        </Text>
      </View>
    </Pressable>
  );
}

function Accordion({
  title,
  open,
  onToggle,
  right,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  right?: string;
  children: ReactNode;
}) {
  return (
    <Card style={styles.accCard} padded={false}>
      <Pressable onPress={onToggle} style={styles.accHead}>
        <Text style={styles.accChevron}>{open ? "▾" : "▸"}</Text>
        <Text style={styles.accTitle}>{title}</Text>
        {right ? <Text style={styles.accRight}>{right}</Text> : null}
      </Pressable>
      {open ? <View style={styles.accBody}>{children}</View> : null}
    </Card>
  );
}

function AccountDetail({
  account,
}: {
  account: InvestmentAccount;
}) {
  const [live, setLive] = useState(account.live_balance);
  const [hidden, setHidden] = useState(account.hidden);
  const [closed, setClosed] = useState(account.closed);
  return (
    <Screen scroll flush contentStyle={{ padding: spacing.md }}>
      <Text style={styles.detailTitle}>{account.name}</Text>
      <Text style={styles.detailSub}>
        {account.mask} · {account.source}
      </Text>
      <Text style={styles.detailBalance}>{usdExact(account.balance)}</Text>
      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.chartTitle}>More</Text>
        <View style={styles.gearRow}>
          <Text style={styles.gearLabel}>Live balance</Text>
          <Toggle value={live} onChange={setLive} />
        </View>
        <View style={styles.gearRow}>
          <Text style={styles.gearLabel}>Hide</Text>
          <Toggle value={hidden} onChange={setHidden} />
        </View>
        <View style={styles.gearRow}>
          <Text style={styles.gearLabel}>Closed</Text>
          <Toggle value={closed} onChange={setClosed} />
        </View>
        <Pressable style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

function HoldingDetail({
  holding,
  sort,
  onSort,
}: {
  holding: InvestmentHolding;
  sort: HoldingSort;
  onSort: (s: HoldingSort) => void;
}) {
  const up = holding.day_change_pct >= 0;
  return (
    <Screen scroll flush contentStyle={{ padding: spacing.md }}>
      <Text style={styles.detailTitle}>
        {holding.symbol}{" "}
        <Text style={styles.detailSub}>{holding.name}</Text>
      </Text>
      <Text style={styles.typePill}>{holding.type}</Text>
      <Text style={styles.detailBalance}>{usdExact(holding.last_price)}</Text>
      <Text
        style={{
          color: up ? colors.incomeGreen : colors.overBudgetRed,
          fontWeight: "600",
          marginTop: 4,
        }}
      >
        {pct(holding.day_change_pct)} today
      </Text>
      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.chartTitle}>Positions</Text>
        <View style={styles.gearRow}>
          <Text style={styles.gearLabel}>Quantity</Text>
          <Text style={styles.gearValue}>{holding.quantity}</Text>
        </View>
        <View style={styles.gearRow}>
          <Text style={styles.gearLabel}>My equity</Text>
          <Text style={styles.gearValue}>{usdExact(holding.my_equity)}</Text>
        </View>
        <View style={styles.gearRow}>
          <Text style={styles.gearLabel}>Last price</Text>
          <Text style={styles.gearValue}>{usdExact(holding.last_price)}</Text>
        </View>
      </Card>
      <Card style={{ marginTop: spacing.sm }}>
        <Text style={styles.chartTitle}>Sort</Text>
        {(["last_price", "my_equity", "quantity"] as HoldingSort[]).map((s) => (
          <Pressable key={s} onPress={() => onSort(s)} style={styles.sortRow}>
            <Text style={[styles.gearLabel, sort === s && { color: colors.accentBlue }]}>
              {s === "last_price" ? "Last price" : s === "my_equity" ? "My equity" : "Quantity"}
            </Text>
            {sort === s ? <Text style={{ color: colors.accentBlue }}>✓</Text> : null}
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

export default function InvestmentsScreen() {
  const [range, setRange] = useState<InvestmentRangeKey>("1W");
  const [data, setData] = useState<InvestmentsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [gearOpen, setGearOpen] = useState(false);
  const [openAcc, setOpenAcc] = useState(true);
  const [openAlloc, setOpenAlloc] = useState(true);
  const [openHold, setOpenHold] = useState(true);
  const [openMovers, setOpenMovers] = useState(true);
  const [sel, setSel] = useState<DetailSel>(null);
  const [holdSort, setHoldSort] = useState<HoldingSort>("last_price");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const res = await fetch(
          `${API_URL.replace(/\/$/, "")}/investments?range=${encodeURIComponent(range)}`,
          { headers: { "x-user-id": getApiUserId() } },
        );
        if (res.ok) {
          setData((await res.json()) as InvestmentsPayload);
          return;
        }
      } catch {
        // fall through to local demo
      }
      setData(buildDemoInvestmentsPayload(range));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const holdingsSorted = useMemo(() => {
    const rows = [...(data?.holdings ?? [])];
    rows.sort((a, b) => {
      if (holdSort === "quantity") return b.quantity - a.quantity;
      if (holdSort === "my_equity") return b.my_equity - a.my_equity;
      return b.last_price - a.last_price;
    });
    return rows;
  }, [data, holdSort]);

  const selectedAccount = data?.accounts.find((a) => sel?.kind === "account" && a.id === sel.id);
  const selectedHolding = data?.holdings.find((h) => sel?.kind === "holding" && h.id === sel.id);

  const list = (
    <Screen refreshing={loading} onRefresh={() => void reload()} flush>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <ScreenHeader title="Investments" />

        {data ? (
          <BalanceChart
            data={data}
            range={range}
            onRange={setRange}
            gearOpen={gearOpen}
            onToggleGear={() => setGearOpen((g) => !g)}
          />
        ) : null}

        <Accordion
          title="Your top movers for today"
          open={openMovers}
          onToggle={() => setOpenMovers((v) => !v)}
          right="LAST PRICE"
        >
          <View style={styles.moversRow}>
            {(data?.top_movers ?? []).map((h) => (
              <MoverCard
                key={h.id}
                h={h}
                onPress={() => setSel({ kind: "holding", id: h.id })}
              />
            ))}
          </View>
        </Accordion>

        <Accordion
          title="Accounts"
          open={openAcc}
          onToggle={() => setOpenAcc((v) => !v)}
        >
          {(data?.accounts ?? []).map((a) => (
            <Pressable
              key={a.id}
              style={styles.accountRow}
              onPress={() => setSel({ kind: "account", id: a.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.catName}>{a.name}</Text>
                <Text style={styles.cardHint}>
                  {a.mask} · {a.source}
                </Text>
              </View>
              <Text style={styles.catAmt}>{usd(a.balance)}</Text>
            </Pressable>
          ))}
        </Accordion>

        <Accordion
          title="Allocation"
          open={openAlloc}
          onToggle={() => setOpenAlloc((v) => !v)}
          right="BY PERCENTAGE"
        >
          {(data?.allocation ?? []).map((slice) => (
            <View key={slice.type} style={styles.allocRow}>
              <View style={styles.catLabelRow}>
                <Text style={styles.catName}>{slice.type}</Text>
                <Text style={styles.catAmt}>
                  {slice.percent}% · {usd(slice.amount)}
                </Text>
              </View>
              <ProgressBar progress={slice.percent / 100} color={colors.accentBlue} />
            </View>
          ))}
        </Accordion>

        <Accordion
          title="Holdings"
          open={openHold}
          onToggle={() => setOpenHold((v) => !v)}
          right="LAST PRICE"
        >
          <View style={styles.sortBar}>
            {(["last_price", "my_equity", "quantity"] as HoldingSort[]).map((s) => (
              <Pressable key={s} onPress={() => setHoldSort(s)} style={styles.sortChip}>
                <Text
                  style={[
                    styles.sortChipText,
                    holdSort === s && { color: colors.accentBlue, fontWeight: "700" },
                  ]}
                >
                  {s === "last_price" ? "Last price" : s === "my_equity" ? "My equity" : "Quantity"}
                </Text>
              </Pressable>
            ))}
          </View>
          {holdingsSorted.map((h) => (
            <Pressable
              key={h.id}
              style={styles.holdingRow}
              onPress={() => setSel({ kind: "holding", id: h.id })}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.catName}>
                  {h.symbol}{" "}
                  <Text style={styles.cardHint}>{h.type}</Text>
                </Text>
                <Text style={styles.cardHint} numberOfLines={1}>
                  {h.name} · qty {h.quantity}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.catAmt}>{usdExact(h.last_price)}</Text>
                <Text style={styles.cardHint}>{usd(h.my_equity)}</Text>
              </View>
            </Pressable>
          ))}
        </Accordion>

        <Text style={styles.footnote}>
          Manual Demo Brokerage (no Plaid). Copilot web Investments — no Goals /
          no Add institution on this surface.
        </Text>
      </View>
    </Screen>
  );

  const detail = selectedAccount ? (
    <AccountDetail account={selectedAccount} />
  ) : selectedHolding ? (
    <HoldingDetail holding={selectedHolding} sort={holdSort} onSort={setHoldSort} />
  ) : (
    <View style={styles.detailEmpty}>
      <EmptyState icon="▤" title="Select to view details" />
    </View>
  );

  return <MasterDetail list={list} detail={detail} />;
}

const styles = StyleSheet.create({
  balanceCard: { marginBottom: spacing.sm, paddingVertical: spacing.md },
  balanceTop: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  liveLabel: { ...type.caption, color: colors.textTertiary, textAlign: "center" },
  gearBtn: { position: "absolute", right: 0, top: -2, padding: 4 },
  gear: { fontSize: 16, color: colors.textTertiary },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  balanceValue: { ...type.title1, fontSize: 34, lineHeight: 40, fontWeight: "700" },
  infoI: { color: colors.textTertiary, fontSize: 14 },
  dayChange: {
    ...type.footnote,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: 2,
  },
  chartArea: {
    marginTop: spacing.md,
    justifyContent: "flex-end",
    position: "relative",
  },
  baseline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 8,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
  },
  lineRow: { flexDirection: "row", alignItems: "flex-end", flex: 1, gap: 1 },
  lineCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  lineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accentBlue,
    opacity: 0.35,
  },
  lineDotActive: { width: 8, height: 8, borderRadius: 4, opacity: 1 },
  gearPanel: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  gearTitle: { ...type.sectionLabel, marginBottom: spacing.sm, color: colors.textTertiary },
  gearRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  gearLabel: { ...type.callout, fontWeight: "600" },
  gearValue: { ...type.callout, color: colors.textSecondary },
  accCard: { marginBottom: spacing.sm, overflow: "hidden" },
  accHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  accChevron: { color: colors.textTertiary, width: 14 },
  accTitle: { ...type.callout, fontWeight: "700", flex: 1 },
  accRight: { ...type.caption, color: colors.textTertiary, fontWeight: "700" },
  accBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  moversRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  moverCard: {
    width: 140,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    padding: spacing.sm,
    gap: 8,
  },
  moverTop: { flexDirection: "row", gap: 4 },
  moverSym: { ...type.callout, fontWeight: "700" },
  moverName: { ...type.caption, color: colors.textTertiary },
  moon: { color: colors.textTertiary, fontSize: 12 },
  pctPill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  allocRow: { marginBottom: spacing.sm },
  holdingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sortBar: { flexDirection: "row", gap: 8, marginBottom: spacing.sm, flexWrap: "wrap" },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.bgMuted,
  },
  sortChipText: { ...type.caption, color: colors.textSecondary },
  sortRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  catName: { ...type.callout, fontWeight: "600" },
  catAmt: { ...type.callout, fontWeight: "600" },
  catLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardHint: { ...type.footnote, color: colors.textTertiary },
  chartTitle: {
    ...type.sectionLabel,
    marginBottom: spacing.sm,
    color: colors.textTertiary,
  },
  footnote: { ...type.footnote, marginVertical: spacing.md, lineHeight: 16 },
  detailEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  detailTitle: { ...type.title2, fontWeight: "700" },
  detailSub: { ...type.footnote, color: colors.textTertiary },
  detailBalance: { ...type.title1, marginTop: spacing.sm, fontWeight: "700" },
  typePill: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accentBlueSoft,
    color: colors.accentBlue,
    overflow: "hidden",
    fontWeight: "700",
    fontSize: 12,
  },
  deleteBtn: {
    marginTop: spacing.md,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  deleteText: { color: colors.overBudgetRed, fontWeight: "700" },
});
