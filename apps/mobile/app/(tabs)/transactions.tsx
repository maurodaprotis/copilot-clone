import { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { SEED_CATEGORIES } from "@copilot-clone/domain";
import {
  DEMO_ACCOUNT_CURRENCY,
  DEMO_ACCOUNT_ID,
  DEMO_REPORTING_CURRENCY,
  API_URL,
  DEMO_USER_ID,
  getApiUserId,
} from "../../src/config";
import { addExpenseOffline } from "../../src/offline/addExpenseOffline";
import {
  countOutbox,
  listAllTransactions,
  listToReview,
  type LocalTransaction,
} from "../../src/offline/queries";
import { getAccountsOverview } from "../../src/offline/accounts";
import { reviewTransaction } from "../../src/offline/reviewTransaction";
import {
  assignTagLocal,
  equalSplitAmounts,
  listSplitLegsLocal,
  listTags,
  listTxnTagIds,
  setSplitLocal,
  unassignTagLocal,
} from "../../src/offline/rulesTagsSplits";
import type { Tag } from "@copilot-clone/domain";
import { syncOutbox } from "../../src/offline/syncOutbox";
import { createApiTransport } from "../../src/sync/apiTransport";
import { colors, radius, spacing, type } from "../../src/theme";
import {
  Card,
  Chip,
  EmptySparkle,
  IconButton,
  EmptyState,
  MasterDetail,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SearchBar,
  SectionLabel,
  SegmentedControl,
  Amount,
  TxnRow,
  useIsDesktopWeb,
} from "../../src/ui";

type CatMeta = { name: string; emoji: string; color: string };

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function seedCatMeta(): Record<string, CatMeta> {
  const out: Record<string, CatMeta> = {};
  for (const c of SEED_CATEGORIES) {
    out[c.id] = { name: c.name, emoji: c.emoji, color: c.color };
  }
  return out;
}

/** Never surface raw `cat-*` ids — human label only. */
function humanCategory(
  categoryId: string | null,
  meta: Record<string, CatMeta>,
  txnType: string,
): CatMeta {
  if (categoryId && meta[categoryId]) return meta[categoryId]!;
  if (!categoryId && txnType === "income") {
    return { name: "Income", emoji: "💵", color: "#10B981" };
  }
  if (categoryId?.startsWith("cat-")) {
    const raw = categoryId.slice(4).replace(/-/g, " ");
    const name = raw.replace(/\b\w/g, (c) => c.toUpperCase());
    return { name, emoji: "📁", color: "#94a3b8" };
  }
  return { name: "Other", emoji: "👤", color: "#60a5fa" };
}

function ymdUTC(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toISOString().slice(0, 10);
}

function dateSectionLabel(iso: string, now = new Date()): string {
  const key = ymdUTC(iso);
  if (key === "Unknown") return "Unknown";
  const today = now.toISOString().slice(0, 10);
  const yest = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
    .toISOString()
    .slice(0, 10);
  if (key === today) return "Today";
  if (key === yest) return "Yesterday";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function detailDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function txnTitle(txn: LocalTransaction): string {
  return txn.note || "Transaction";
}

async function fetchCategoryMetaFromApi(): Promise<Record<string, CatMeta> | null> {
  try {
    const ym = new Date().toISOString().slice(0, 7);
    const res = await fetch(
      `${API_URL.replace(/\/$/, "")}/categories?month=${encodeURIComponent(ym)}`,
      { headers: { "x-user-id": getApiUserId() } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      categories?: Array<{ id: string; name: string; emoji?: string; color?: string }>;
      rows?: Array<{ category: { id: string; name: string; emoji?: string; color?: string } }>;
    };
    const list =
      data.categories ??
      data.rows?.map((r) => r.category) ??
      [];
    if (!list.length) return null;
    const out: Record<string, CatMeta> = {};
    for (const c of list) {
      out[c.id] = {
        name: c.name,
        emoji: c.emoji || "•",
        color: c.color || "#60a5fa",
      };
    }
    return out;
  } catch {
    return null;
  }
}

export default function TransactionsScreen() {
  const desktop = useIsDesktopWeb();
  const [pending, setPending] = useState<LocalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState<LocalTransaction[]>([]);
  const [outboxCount, setOutboxCount] = useState(0);
  const [amount, setAmount] = useState("50");
  const [note, setNote] = useState("Café offline");
  const [currency, setCurrency] = useState("USD");
  const [categoryId, setCategoryId] = useState("cat-dining");
  const [txnKind, setTxnKind] = useState<"expense" | "income">("expense");
  const [catMeta, setCatMeta] = useState<Record<string, CatMeta>>(seedCatMeta);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const [detail, setDetail] = useState<LocalTransaction | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [txnTagIds, setTxnTagIds] = useState<string[]>([]);
  const [detailNote, setDetailNote] = useState("");
  const [splitCatA, setSplitCatA] = useState("cat-dining");
  const [splitCatB, setSplitCatB] = useState("cat-groceries");
  const [splitMsg, setSplitMsg] = useState<string | null>(null);
  const [showSplit, setShowSplit] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a, o, tags, apiCats, accounts] = await Promise.all([
        listToReview().catch(() => [] as LocalTransaction[]),
        listAllTransactions().catch(() => [] as LocalTransaction[]),
        countOutbox().catch(() => 0),
        listTags().catch(() => [] as Tag[]),
        fetchCategoryMetaFromApi(),
        getAccountsOverview().catch(() => null),
      ]);
      setPending(p);
      setAll(a);
      setOutboxCount(o);
      setCatMeta(apiCats && Object.keys(apiCats).length ? apiCats : seedCatMeta());
      const names: Record<string, string> = {};
      if (accounts?.rows) {
        for (const row of accounts.rows) {
          names[row.account.id] = row.account.name;
        }
      }
      // Stable demo fallback so rows never show raw account ids.
      if (!names["acc-cash-ars"]) names["acc-cash-ars"] = "Cash ARS";
      if (!names["acc-cash"]) names["acc-cash"] = "Cash";
      if (!names[DEMO_ACCOUNT_ID]) names[DEMO_ACCOUNT_ID] = "Demo account";
      setAccountNames(names);
      setAllTags(tags);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function openDetail(txn: LocalTransaction) {
    setDetail(txn);
    setDetailNote(txn.note || "");
    setSplitMsg(null);
    setShowSplit(false);
    setTxnTagIds(await listTxnTagIds(txn.id));
    const legs = await listSplitLegsLocal(txn.id);
    if (legs.length >= 2) {
      setSplitCatA(legs[0]!.category_id);
      setSplitCatB(legs[1]!.category_id);
    }
  }

  async function toggleTag(tagId: string) {
    if (!detail) return;
    setBusy(true);
    try {
      if (txnTagIds.includes(tagId)) {
        await unassignTagLocal(detail.id, tagId);
      } else {
        await assignTagLocal(detail.id, tagId);
      }
      await syncOutbox(createApiTransport());
      setTxnTagIds(await listTxnTagIds(detail.id));
    } finally {
      setBusy(false);
    }
  }

  async function onEqualSplit() {
    if (!detail) return;
    setBusy(true);
    setSplitMsg(null);
    try {
      const amounts = equalSplitAmounts(detail.amount, 2);
      await setSplitLocal({
        transaction_id: detail.id,
        parent_amount: detail.amount,
        legs: [
          { category_id: splitCatA, amount: amounts[0]! },
          { category_id: splitCatB, amount: amounts[1]! },
        ],
      });
      await syncOutbox(createApiTransport());
      setSplitMsg(`Split ${amounts[0]} / ${amounts[1]}`);
      await reload();
    } catch (e) {
      setSplitMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAddOffline() {
    setBusy(true);
    setMsg(null);
    try {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) {
        setMsg("Enter a positive amount");
        return;
      }
      const { transactionId, queued } = await addExpenseOffline({
        account_id: DEMO_ACCOUNT_ID,
        category_id: txnKind === "income" ? "cat-work" : categoryId,
        amount: n,
        currency,
        account_currency: DEMO_ACCOUNT_CURRENCY,
        reporting_currency: DEMO_REPORTING_CURRENCY,
        note: note || null,
        rate_book: { "USD:ARS:2026-09-04": 1400 },
        type: txnKind === "income" ? "income" : "regular",
      });
      const result = await syncOutbox(createApiTransport()).catch(() => ({
        pushed: 0,
      }));
      const queuedHint = queued ? " · queued offline" : result.pushed ? " · synced" : "";
      setMsg(`Added ${transactionId.slice(0, 8)}…${queuedHint}`);
      setShowComposer(false);
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSync() {
    setBusy(true);
    setMsg(null);
    try {
      const result = await syncOutbox(createApiTransport());
      // Always re-GET from Worker (demo-user) — Sync is not required for first paint,
      // but if tapped it must refresh lists even when outbox is empty.
      await reload();
      setMsg(result.pushed > 0 ? `Synced ${result.pushed}` : "Up to date");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReview(id: string) {
    setBusy(true);
    try {
      await reviewTransaction(id);
      await syncOutbox(createApiTransport());
      await reload();
      if (detail?.id === id) setDetail(null);
    } finally {
      setBusy(false);
    }
  }

  function matchesFilter(txn: LocalTransaction): boolean {
    const title = txnTitle(txn).toLowerCase();
    if (query && !title.includes(query.toLowerCase())) return false;
    if (filter === "To Review") return txn.review_status === "needs_review";
    if (filter === "Income") return txn.type === "income";
    if (filter === "Expenses") return txn.type !== "income";
    return true;
  }

  const filtered = useMemo(() => {
    // Prefer full list; To Review filter uses needs_review rows.
    const source = filter === "To Review" ? pending : all.length ? all : pending;
    return source.filter(matchesFilter);
  }, [all, pending, filter, query, catMeta]);

  const grouped = useMemo(() => {
    const map = new Map<string, LocalTransaction[]>();
    for (const txn of filtered) {
      const label = dateSectionLabel(txn.posted_at);
      const list = map.get(label) ?? [];
      list.push(txn);
      map.set(label, list);
    }
    return [...map.entries()];
  }, [filtered]);

  function accountLabel(txn: LocalTransaction): string {
    return accountNames[txn.account_id] || "Account";
  }

  function renderTxnRow(txn: LocalTransaction) {
    const cat = humanCategory(txn.category_id, catMeta, txn.type);
    const income = txn.type === "income";
    return (
      <TxnRow
        key={txn.id}
        merchant={txnTitle(txn)}
        account={accountLabel(txn)}
        categoryEmoji={cat.emoji}
        categoryName={cat.name}
        categoryColor={cat.color}
        amountLabel={money(txn.amount, txn.currency)}
        income={income}
        showCheckbox={desktop}
        checked={!!checked[txn.id]}
        onToggleCheck={() =>
          setChecked((prev) => ({ ...prev, [txn.id]: !prev[txn.id] }))
        }
        selected={detail?.id === txn.id}
        onPress={() => void openDetail(txn)}
        trailing={
          txn.review_status === "needs_review" ? (
            <PrimaryButton
              label="Review"
              variant="secondary"
              onPress={() => void onReview(txn.id)}
              style={styles.reviewBtn}
            />
          ) : undefined
        }
      />
    );
  }

  const detailCat = detail
    ? humanCategory(detail.category_id, catMeta, detail.type)
    : null;
  const detailIncome = detail?.type === "income";

  const detailBody = detail ? (
    <View style={styles.detailInner}>
      <View style={styles.detailChrome}>
        <View style={styles.detailTypeRow}>
          <Text style={styles.detailTypeEmoji}>{detailCat?.emoji || "•"}</Text>
          <Text style={styles.detailType}>{detailCat?.name || "Transaction"}</Text>
          <Text style={styles.detailTypeChev}>▾</Text>
        </View>
        {desktop ? (
          <Pressable onPress={() => setDetail(null)} hitSlop={8} style={styles.detailClose}>
            <Text style={styles.detailCloseText}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.detailDate}>{detailDateLabel(detail.posted_at)}</Text>

      <View style={styles.detailHero}>
        <Text style={styles.detailName} numberOfLines={2}>
          {txnTitle(detail)}
        </Text>
        <Amount
          value={money(detail.amount, detail.currency)}
          variant={detailIncome ? "income" : "expense"}
          size="hero"
        />
      </View>

      <View style={styles.detailAccountRow}>
        <View style={styles.accountGlyph}>
          <Text style={styles.accountGlyphText}>🏦</Text>
        </View>
        <Text style={styles.detailAccountName}>{accountLabel(detail)}</Text>
      </View>

      {detail.review_status === "needs_review" ? (
        <PrimaryButton
          label="Mark reviewed"
          onPress={() => void onReview(detail.id)}
          loading={busy}
          style={{ marginTop: spacing.md }}
        />
      ) : null}

      <View style={styles.detailSection}>
        <View style={styles.detailSectionHead}>
          <Text style={styles.detailSectionTitle}>Tags</Text>
          <View style={styles.detailSectionAction}>
            <Text style={styles.detailSectionActionText}>+</Text>
          </View>
        </View>
        <View style={styles.chipRow}>
          {allTags.length === 0 ? (
            <Text style={styles.txnMeta}>Create tags in More → Tags</Text>
          ) : (
            allTags.map((t) => (
              <Chip
                key={t.id}
                label={t.name}
                selected={txnTagIds.includes(t.id)}
                onPress={() => void toggleTag(t.id)}
              />
            ))
          )}
        </View>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          value={detailNote}
          onChangeText={setDetailNote}
          placeholder="Add a note..."
          placeholderTextColor={colors.textTertiary}
          multiline
        />
      </View>

      <Pressable onPress={() => setShowSplit((v) => !v)} style={styles.splitToggle}>
        <Text style={styles.splitToggleText}>
          {showSplit ? "Hide split" : "Split transaction"}
        </Text>
      </Pressable>
      {showSplit ? (
        <View style={styles.splitBox}>
          <View style={styles.chipRow}>
            {["cat-dining", "cat-groceries", "cat-transport", "cat-shopping"].map((id) => (
              <Chip
                key={`a-${id}`}
                label={`A: ${humanCategory(id, catMeta, "regular").name}`}
                selected={splitCatA === id}
                onPress={() => setSplitCatA(id)}
              />
            ))}
          </View>
          <View style={styles.chipRow}>
            {["cat-dining", "cat-groceries", "cat-transport", "cat-shopping"].map((id) => (
              <Chip
                key={`b-${id}`}
                label={`B: ${humanCategory(id, catMeta, "regular").name}`}
                selected={splitCatB === id}
                onPress={() => setSplitCatB(id)}
              />
            ))}
          </View>
          <PrimaryButton
            label="Save equal split"
            variant="secondary"
            onPress={() => void onEqualSplit()}
            loading={busy}
            style={{ marginTop: spacing.sm }}
          />
          {splitMsg ? <Text style={styles.msg}>{splitMsg}</Text> : null}
        </View>
      ) : null}

      {!desktop ? (
        <PrimaryButton
          label="Close"
          variant="ghost"
          onPress={() => setDetail(null)}
          style={{ marginTop: spacing.md }}
        />
      ) : null}
    </View>
  ) : (
    <View style={styles.detailEmpty}>
      <Text style={styles.detailEmptyGlyph}>☰</Text>
      <Text style={styles.detailEmptyTitle}>Select a transaction</Text>
      <Text style={styles.detailEmptyBody}>
        Pick a row to inspect date, account, category, tags, and notes.
      </Text>
    </View>
  );

  const listBody = (
    <>
      <ScreenHeader
        title="Transactions"
        right={
          <View style={styles.headerActions}>
            <IconButton
              glyph="↻"
              accessibilityLabel="Sync"
              onPress={() => void onSync()}
              loading={busy}
            />
            <PrimaryButton
              label="+ Add"
              onPress={() => setShowComposer((v) => !v)}
              style={styles.smallBtn}
            />
          </View>
        }
      />

      {showComposer ? (
        <Card style={styles.composer}>
          <Text style={styles.composerTitle}>
            {txnKind === "income" ? "New income" : "New expense"}
          </Text>
          <Text style={styles.label}>Type</Text>
          <View style={styles.chipRow}>
            <Chip
              label="Expense"
              selected={txnKind === "expense"}
              onPress={() => {
                setTxnKind("expense");
                setCategoryId("cat-dining");
              }}
            />
            <Chip
              label="Income"
              selected={txnKind === "income"}
              onPress={() => {
                setTxnKind("income");
                setCategoryId("cat-salary");
              }}
            />
          </View>
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.label}>Currency</Text>
          <TextInput
            style={styles.input}
            value={currency}
            onChangeText={setCurrency}
            autoCapitalize="characters"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder="Merchant or note"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {(txnKind === "income"
              ? ["cat-salary", "cat-interest"]
              : ["cat-dining", "cat-groceries", "cat-transport", "cat-shopping"]
            ).map((id) => (
              <Chip
                key={id}
                label={humanCategory(id, catMeta, txnKind).name}
                selected={categoryId === id}
                onPress={() => setCategoryId(id)}
              />
            ))}
          </View>
          <PrimaryButton
            label="Add"
            onPress={() => void onAddOffline()}
            loading={busy}
          />
        </Card>
      ) : null}

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      {outboxCount > 0 ? (
        <Text style={styles.outboxHint}>{outboxCount} queued offline</Text>
      ) : null}

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search"
        style={{ marginBottom: spacing.sm }}
      />
      <SegmentedControl
        options={["All", "To Review", "Income", "Expenses"]}
        value={filter}
        onChange={setFilter}
        style={{ marginBottom: spacing.md }}
      />

      {loading && filtered.length === 0 ? (
        <Card>
          <Text style={styles.txnMeta}>Loading transactions…</Text>
        </Card>
      ) : filter === "To Review" && filtered.length === 0 ? (
        <Card>
          <EmptySparkle
            title="All caught up!"
            body="You have no transactions to review. We’ll let you know when something pops up."
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="💳"
            title="No transactions yet"
            body="Add an offline expense or import a bank CSV to get started."
            ctaLabel="Add"
            onCta={() => setShowComposer(true)}
          />
        </Card>
      ) : (
        grouped.map(([label, rows]) => (
          <View key={label} style={styles.group}>
            <SectionLabel>{label}</SectionLabel>
            <Card padded={false} style={styles.groupCard}>
              {rows.map((txn, idx) => (
                <View
                  key={txn.id}
                  style={idx < rows.length - 1 ? styles.rowDivider : undefined}
                >
                  {renderTxnRow(txn)}
                </View>
              ))}
            </Card>
          </View>
        ))
      )}
    </>
  );

  if (desktop) {
    return (
      <MasterDetail
        list={
          <Screen
            flush
            refreshing={loading}
            onRefresh={() => void reload()}
            contentStyle={styles.listPad}
          >
            {listBody}
          </Screen>
        }
        detail={
          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.detailPad}
            keyboardShouldPersistTaps="handled"
          >
            {detailBody}
          </ScrollView>
        }
      />
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={() => void reload()}>
      {listBody}
      <Modal visible={!!detail} animationType="slide" transparent>
        <View style={styles.modalBackdrop} pointerEvents="box-none">
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setDetail(null)}
          />
          <View style={styles.modalCard} pointerEvents="auto">
            {detailBody}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", gap: spacing.xs },
  smallBtn: { minHeight: 36, paddingVertical: 8, minWidth: 64 },
  composer: { marginBottom: spacing.md },
  composerTitle: { ...type.headline, marginBottom: spacing.sm },
  label: { ...type.footnote, fontWeight: "600", marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    marginBottom: spacing.sm,
    backgroundColor: colors.bgInput,
    color: colors.textPrimary,
    fontSize: 16,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  msg: { ...type.footnote, color: colors.textPrimary, marginBottom: spacing.sm },
  outboxHint: { ...type.footnote, color: colors.textTertiary, marginBottom: spacing.xs },
  group: { marginBottom: spacing.sm },
  groupCard: { overflow: "hidden" },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderHairline,
  },
  txnMeta: { ...type.footnote, marginTop: 2 },
  reviewBtn: { minWidth: 84, minHeight: 36, paddingVertical: 8 },
  listPad: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  detailScroll: { flex: 1, backgroundColor: colors.bgElevated },
  detailPad: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  detailInner: {},
  detailChrome: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  detailTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  detailTypeEmoji: { fontSize: 13 },
  detailType: { ...type.footnote, fontWeight: "600", color: colors.textPrimary },
  detailTypeChev: { fontSize: 10, color: colors.textTertiary },
  detailClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  detailCloseText: { fontSize: 14, color: colors.textSecondary, fontWeight: "600" },
  detailDate: { ...type.footnote, color: colors.textTertiary, marginBottom: spacing.sm },
  detailHero: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  detailName: { ...type.title2, flex: 1 },
  detailAccountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  accountGlyph: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  accountGlyphText: { fontSize: 14 },
  detailAccountName: { ...type.subhead, color: colors.textSecondary },
  detailSection: { marginBottom: spacing.lg },
  detailSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  detailSectionTitle: { ...type.footnote, fontWeight: "700", color: colors.textSecondary },
  detailSectionAction: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  detailSectionActionText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 18,
  },
  notesInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 72,
    backgroundColor: colors.bgInput,
    color: colors.textPrimary,
    fontSize: 15,
    textAlignVertical: "top",
  },
  splitToggle: { paddingVertical: spacing.sm },
  splitToggleText: { ...type.footnote, color: colors.accentBlue, fontWeight: "600" },
  splitBox: { marginBottom: spacing.md },
  detailEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    minHeight: 320,
  },
  detailEmptyGlyph: { fontSize: 36, color: colors.textTertiary, marginBottom: spacing.sm },
  detailEmptyTitle: { ...type.title3, marginBottom: 6 },
  detailEmptyBody: {
    ...type.subhead,
    textAlign: "center",
    color: colors.textSecondary,
    maxWidth: 260,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: "88%",
    zIndex: 2,
    elevation: 8,
  },
});
