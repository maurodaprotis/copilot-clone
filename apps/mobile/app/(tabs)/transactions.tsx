import { useCallback, useState } from "react";
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
import {
  DEMO_ACCOUNT_CURRENCY,
  DEMO_ACCOUNT_ID,
  DEMO_REPORTING_CURRENCY,
} from "../../src/config";
import { addExpenseOffline } from "../../src/offline/addExpenseOffline";
import {
  countOutbox,
  listAllTransactions,
  listToReview,
  type LocalTransaction,
} from "../../src/offline/queries";
import { listCategories } from "../../src/offline/budgets";
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
  SectionHeader,
  SegmentedControl,
  TxnRow,
  useIsDesktopWeb,
} from "../../src/ui";

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

export default function TransactionsScreen() {
  const desktop = useIsDesktopWeb();
  const [pending, setPending] = useState<LocalTransaction[]>([]);
  const [all, setAll] = useState<LocalTransaction[]>([]);
  const [outboxCount, setOutboxCount] = useState(0);
  const [amount, setAmount] = useState("50");
  const [note, setNote] = useState("Café offline");
  const [currency, setCurrency] = useState("USD");
  const [categoryId, setCategoryId] = useState("cat-dining");
  const [txnKind, setTxnKind] = useState<"expense" | "income">("expense");
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  const [detail, setDetail] = useState<LocalTransaction | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [txnTagIds, setTxnTagIds] = useState<string[]>([]);
  const [splitCatA, setSplitCatA] = useState("cat-dining");
  const [splitCatB, setSplitCatB] = useState("cat-groceries");
  const [splitMsg, setSplitMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [p, a, o, cats, tags] = await Promise.all([
      listToReview(),
      listAllTransactions(),
      countOutbox(),
      listCategories(),
      listTags(),
    ]);
    setPending(p);
    setAll(a);
    setOutboxCount(o);
    const names: Record<string, string> = {};
    for (const c of cats) names[c.id] = `${c.emoji} ${c.name}`;
    setCategoryNames(names);
    setAllTags(tags);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function openDetail(txn: LocalTransaction) {
    setDetail(txn);
    setSplitMsg(null);
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
      // Happy path: auto-drain (web may already have POSTed; native drains SQLite).
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
      setMsg(result.pushed > 0 ? `Synced ${result.pushed}` : "Outbox empty");
      await reload();
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
    if (query && !(txn.note || "").toLowerCase().includes(query.toLowerCase()))
      return false;
    if (filter === "To Review") return txn.review_status === "needs_review";
    if (filter === "Income") return txn.type === "income";
    if (filter === "Expenses") return txn.type !== "income";
    return true;
  }

  const detailBody = detail ? (
    <View style={styles.detailInner}>
      <View style={styles.detailTop}>
        <Text style={styles.modalTitle}>{money(detail.amount, detail.currency)}</Text>
        {desktop ? (
          <Pressable onPress={() => setDetail(null)} hitSlop={8} style={styles.detailClose}>
            <Text style={styles.detailCloseText}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.txnMeta}>{detail.note || "Transaction"}</Text>
      <Text style={styles.txnMeta}>
        {(detail.category_id
          ? categoryNames[detail.category_id] ?? detail.category_id
          : "Uncategorized") +
          (detail.synced ? "" : " · pending sync")}
      </Text>

      {detail.review_status === "needs_review" ? (
        <PrimaryButton
          label="Mark reviewed"
          onPress={() => void onReview(detail.id)}
          loading={busy}
          style={{ marginTop: spacing.md }}
        />
      ) : null}

      <Text style={[styles.label, { marginTop: spacing.md }]}>Tags</Text>
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

      <Text style={[styles.label, { marginTop: spacing.md }]}>Equal 2-way split</Text>
      <View style={styles.chipRow}>
        {["cat-dining", "cat-groceries", "cat-transport", "cat-shopping"].map((id) => (
          <Chip
            key={`a-${id}`}
            label={`A: ${categoryNames[id] ?? id}`}
            selected={splitCatA === id}
            onPress={() => setSplitCatA(id)}
          />
        ))}
      </View>
      <View style={styles.chipRow}>
        {["cat-dining", "cat-groceries", "cat-transport", "cat-shopping"].map((id) => (
          <Chip
            key={`b-${id}`}
            label={`B: ${categoryNames[id] ?? id}`}
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
        Pick a row to inspect amount, category, tags, and splits.
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
              glyph="↓"
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
                setCategoryId("cat-work");
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
              ? ["cat-work", "cat-interest"]
              : ["cat-dining", "cat-groceries", "cat-transport", "cat-shopping"]
            ).map((id) => (
              <Chip
                key={id}
                label={categoryNames[id] ?? id}
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

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search merchants"
        style={{ marginBottom: spacing.sm }}
      />
      <SegmentedControl
        options={["All", "To Review", "Income", "Expenses"]}
        value={filter}
        onChange={setFilter}
        style={{ marginBottom: spacing.md }}
      />

      <SectionHeader title="To Review" count={pending.length} />
      {pending.length === 0 ? (
        <Card>
          <EmptySparkle
            title="All caught up!"
            body="You have no transactions to review. We’ll let you know when something pops up."
          />
        </Card>
      ) : (
        pending.filter(matchesFilter).map((txn) => (
          <Card key={txn.id} padded={false} style={styles.txnCard}>
            <TxnRow
              merchant={txn.note || "Expense"}
              account={
                txn.category_id
                  ? categoryNames[txn.category_id] ?? txn.category_id
                  : "Needs review"
              }
              amountLabel={money(txn.amount, txn.currency)}
              selected={detail?.id === txn.id}
              onPress={() => void openDetail(txn)}
              trailing={
                !desktop ? (
                  <PrimaryButton
                    label="Review"
                    variant="secondary"
                    onPress={() => void onReview(txn.id)}
                    style={styles.reviewBtn}
                  />
                ) : undefined
              }
            />
          </Card>
        ))
      )}

      <SectionHeader title="All" count={all.length} />
      {all.length === 0 ? (
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
        all.filter(matchesFilter).map((txn) => (
          <Card key={`all-${txn.id}`} padded={false} style={styles.txnCard}>
            <TxnRow
              merchant={txn.note || "—"}
              account={
                txn.category_id
                  ? categoryNames[txn.category_id] ?? txn.category_id
                  : txn.review_status === "needs_review"
                    ? "Needs review"
                    : "Reviewed"
              }
              categoryName={
                txn.category_id
                  ? categoryNames[txn.category_id] ?? undefined
                  : undefined
              }
              amountLabel={money(txn.amount, txn.currency)}
              selected={detail?.id === txn.id}
              onPress={() => void openDetail(txn)}
            />
          </Card>
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
            refreshing={false}
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
    <Screen refreshing={false} onRefresh={() => void reload()}>
      {listBody}
      <Modal visible={!!detail} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>{detailBody}</View>
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
  txnCard: { marginBottom: spacing.sm },
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
  detailTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  detailClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  detailCloseText: { fontSize: 14, color: colors.textSecondary, fontWeight: "600" },
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
  },
  modalTitle: { ...type.title2, marginBottom: 4 },
});
