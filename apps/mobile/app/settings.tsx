import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import type { FxRate, FxSeries, UserSettings } from "@copilot-clone/domain";
import {
  getSettingsLocal,
  listFxLocal,
  pullFxFromApi,
  pullSettingsFromApi,
  pushFxToApi,
  pushSettingsToApi,
} from "../src/offline/settingsImport";
import { colors, radius, spacing, type } from "../src/theme";
import {
  Chip,
  ListRow,
  PrimaryButton,
  Screen,
  SegmentedControl,
  SettingsDivider,
  SettingsGroup,
  SettingsSheet,
  Toggle,
  useIsDesktopWeb,
  type SettingsNavId,
} from "../src/ui";

const SERIES: FxSeries[] = ["official", "parallel", "custom"];
const APP_VERSION = "0.0.1";
const DEMO_EMAIL = "mauroborrower@gmail.com";

function ActionRow({
  title,
  subtitle,
  button,
  onPress,
  stub,
}: {
  title: string;
  subtitle?: string;
  button: string;
  onPress: () => void;
  stub?: boolean;
}) {
  return (
    <View style={styles.actionRow}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{title}</Text>
        {subtitle ? <Text style={styles.rowDesc}>{subtitle}</Text> : null}
        {stub ? <Text style={styles.stubTag}>Stub — UI only</Text> : null}
      </View>
      <Pressable style={styles.actionBtn} onPress={onPress}>
        <Text style={styles.actionBtnText}>{button}</Text>
      </Pressable>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const desktop = useIsDesktopWeb();
  const [nav, setNav] = useState<SettingsNavId>("general");
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [rates, setRates] = useState<FxRate[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState("Light");
  const [budgetingOn, setBudgetingOn] = useState(true);
  const [rolloverOn, setRolloverOn] = useState(false);
  const [base, setBase] = useState("USD");
  const [quote, setQuote] = useState("ARS");
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [rate, setRate] = useState("1400");
  const [book, setBook] = useState<FxSeries>("parallel");
  const [email] = useState(DEMO_EMAIL);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    await pullSettingsFromApi().catch(() => null);
    await pullFxFromApi().catch(() => []);
    setSettings(await getSettingsLocal());
    setRates(await listFxLocal());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  function flash(text: string) {
    setToast(text);
    setMsg(text);
    setTimeout(() => setToast(null), 2200);
  }

  async function saveSettings(patch: Partial<UserSettings>) {
    setBusy(true);
    setMsg(null);
    try {
      setSettings(await pushSettingsToApi(patch));
      setMsg("Saved");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAddFx() {
    setBusy(true);
    setMsg(null);
    try {
      await pushFxToApi({
        base,
        quote,
        as_of: asOf,
        rate: Number(rate),
        rate_book: book,
      });
      setMsg("FX rate saved");
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function copyEmail() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(email);
      }
    } catch {
      // ignore
    }
    flash("Email copied");
  }

  function clearLocalCache() {
    try {
      if (typeof localStorage !== "undefined") {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith("copilot") || k.includes("outbox"))) keys.push(k);
        }
        for (const k of keys) localStorage.removeItem(k);
      }
    } catch {
      // ignore
    }
    flash("Local cache cleared (stub)");
  }

  const generalBody = (
    <>
      {!desktop ? (
        <View style={styles.navPills}>
          {(
            [
              ["general", "General"],
              ["account", "Account"],
              ["subscription", "Subscription"],
              ["banks", "Banks"],
              ["about", "About"],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setNav(id)}
              style={[styles.navPill, nav === id && styles.navPillOn]}
            >
              <Text
                style={[styles.navPillText, nav === id && styles.navPillTextOn]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <SettingsGroup label="Appearance">
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Theme</Text>
            <Text style={styles.rowDesc}>Customize how Copilot looks</Text>
          </View>
          <SegmentedControl
            options={["Light", "Auto", "Dark"]}
            value={themeMode}
            onChange={setThemeMode}
            tone="light"
            style={{ flex: 0, minWidth: 168 }}
          />
        </View>
      </SettingsGroup>

      <SettingsGroup label="Budgeting">
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Enable budgeting</Text>
            <Text style={styles.rowDesc}>
              Set monthly budgets for your categories
            </Text>
          </View>
          <Toggle value={budgetingOn} onChange={setBudgetingOn} />
        </View>
        <SettingsDivider />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Enable rollover</Text>
            <Text style={styles.rowDesc}>
              Carry leftover budget into the next month
            </Text>
          </View>
          <Toggle value={rolloverOn} onChange={setRolloverOn} />
        </View>
      </SettingsGroup>

      <SettingsGroup label="Tags">
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Manage tags</Text>
            <Text style={styles.rowDesc}>
              Use tags to group together any transactions
            </Text>
          </View>
          <Pressable
            style={styles.tagChip}
            onPress={() => router.push("/tags" as never)}
          >
            <Text style={styles.tagChipText}>0 tags ▾</Text>
          </Pressable>
        </View>
      </SettingsGroup>

      <SettingsGroup label="Reporting & FX">
        <View style={[styles.row, styles.col]}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Reporting currency</Text>
            <Text style={styles.rowDesc}>Amounts convert into this currency</Text>
          </View>
          <View style={styles.pills}>
            {["USD", "ARS", "EUR"].map((c) => (
              <Chip
                key={c}
                label={c}
                tone="filled"
                selected={settings?.reporting_currency === c}
                onPress={() => void saveSettings({ reporting_currency: c })}
              />
            ))}
          </View>
        </View>
        <SettingsDivider />
        <View style={[styles.row, styles.col]}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Default FX series</Text>
            <Text style={styles.rowDesc}>
              Official, parallel, or your custom book for conversions
            </Text>
          </View>
          <View style={styles.pills}>
            {SERIES.map((s) => (
              <Chip
                key={s}
                label={s.charAt(0).toUpperCase() + s.slice(1)}
                tone="filled"
                selected={settings?.default_fx_series === s}
                onPress={() => void saveSettings({ default_fx_series: s })}
              />
            ))}
          </View>
        </View>
        <SettingsDivider />
        <ListRow
          title="Timezone"
          subtitle={settings?.timezone ?? "America/Argentina/Salta"}
          chevron
        />
        <SettingsDivider />
        <ListRow title="Locale" subtitle={settings?.locale ?? "en-US"} chevron />
      </SettingsGroup>

      <SettingsGroup label="Manual FX rates">
        <View style={styles.fieldGrid}>
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>Base</Text>
            <TextInput
              style={styles.field}
              value={base}
              onChangeText={setBase}
              autoCapitalize="characters"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>Quote</Text>
            <TextInput
              style={styles.field}
              value={quote}
              onChangeText={setQuote}
              autoCapitalize="characters"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>
        <View style={styles.fieldGrid}>
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>Date</Text>
            <TextInput
              style={styles.field}
              value={asOf}
              onChangeText={setAsOf}
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>Rate</Text>
            <TextInput
              style={styles.field}
              value={rate}
              onChangeText={setRate}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>
        <View
          style={[
            styles.pills,
            { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
          ]}
        >
          {SERIES.map((s) => (
            <Chip
              key={s}
              label={s.charAt(0).toUpperCase() + s.slice(1)}
              tone="filled"
              selected={book === s}
              onPress={() => setBook(s)}
            />
          ))}
        </View>
        <PrimaryButton
          label="Save FX rate"
          onPress={() => void onAddFx()}
          loading={busy}
          style={styles.saveBtn}
        />
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </SettingsGroup>

      {rates.slice(0, 8).map((r) => (
        <SettingsGroup key={`${r.from}:${r.to}:${r.on_date}:${r.rate_book}`}>
          <ListRow
            title={`${r.from}/${r.to} = ${r.rate}`}
            subtitle={`${r.on_date} · ${r.rate_book} · ${r.source ?? "manual"}`}
          />
        </SettingsGroup>
      ))}
    </>
  );

  const accountBody = (
    <>
      <SettingsGroup label="Information">
        <View style={styles.actionRow}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Email</Text>
          </View>
          <Pressable style={styles.actionBtn} onPress={copyEmail}>
            <Text style={styles.actionBtnText}>Copy</Text>
          </Pressable>
          <View style={styles.emailBox}>
            <Text style={styles.emailText} numberOfLines={1}>
              {email}
            </Text>
          </View>
        </View>
        <SettingsDivider />
        <ActionRow
          title="Reset password"
          button="Contact support"
          stub
          onPress={() => flash("Reset password — stub (contact support)")}
        />
        <SettingsDivider />
        <ActionRow
          title="Two-factor authentication"
          subtitle="Add an extra layer of security by requiring a code when you sign in."
          button="Enable 2FA"
          stub
          onPress={() => flash("2FA — stub (not in Worker yet)")}
        />
      </SettingsGroup>

      <SettingsGroup label="Actions">
        <ActionRow
          title="Restart onboarding"
          subtitle="Go through the onboarding without logging out."
          button="Restart"
          stub
          onPress={() => flash("Restart onboarding — stub")}
        />
        <SettingsDivider />
        <ActionRow
          title="Export all transactions"
          subtitle="Download a detailed CSV file of your data."
          button="Download"
          stub
          onPress={() => flash("Export CSV — stub (Worker export not wired)")}
        />
        <SettingsDivider />
        <ActionRow
          title="Clear local cache"
          subtitle="If you contacted us about an issue and we told you to clear the local cache."
          button="Clear cache"
          onPress={clearLocalCache}
        />
      </SettingsGroup>

      <SettingsGroup label="Privacy">
        <ActionRow
          title="Your privacy choices"
          subtitle="We don't ever sell your financial data."
          button="Manage"
          stub
          onPress={() => flash("Privacy choices — stub")}
        />
      </SettingsGroup>
      {toast ? <Text style={styles.msg}>{toast}</Text> : null}
    </>
  );

  const subscriptionBody = (
    <SettingsGroup label="Subscription">
      <View style={styles.paywall}>
        <Text style={styles.paywallEmoji}>✨</Text>
        <Text style={styles.paywallTitle}>Copilot Money</Text>
        <Text style={styles.paywallBody}>
          Unlock Intelligence, unlimited institutions, and priority support.
        </Text>
        <Text style={styles.stubTag}>Stub — paywall UI only (no billing)</Text>
        <PrimaryButton
          label="Start free trial"
          variant="accent"
          onPress={() => flash("Subscription paywall — stub")}
          style={{ marginTop: spacing.md, alignSelf: "stretch" }}
        />
      </View>
    </SettingsGroup>
  );

  const banksBody = (
    <SettingsGroup label="Banks & institutions">
      <View style={styles.stub}>
        <Text style={styles.rowLabel}>No institutions connected</Text>
        <Text style={styles.rowDesc}>
          Manual accounts only — no Plaid in this clone. Add accounts from the
          Accounts tab.
        </Text>
        <PrimaryButton
          label="Open Accounts"
          variant="secondary"
          onPress={() => router.push("/accounts" as never)}
          style={{ marginTop: spacing.md, alignSelf: "flex-start" }}
        />
      </View>
    </SettingsGroup>
  );

  const aboutBody = (
    <>
      <SettingsGroup label="About">
        <ListRow title="Version" subtitle={APP_VERSION} />
        <SettingsDivider />
        <ListRow
          title="Help"
          subtitle="Docs & support (stub)"
          chevron
          onPress={() => flash("Help — stub")}
        />
        <SettingsDivider />
        <ListRow
          title="Legal"
          subtitle="Terms & privacy (stub)"
          chevron
          onPress={() => flash("Legal — stub")}
        />
      </SettingsGroup>
      <SettingsGroup>
        <View style={styles.stub}>
          <Text style={styles.rowDesc}>
            Copilot Money clone · USD-first · multi-currency ARS.
          </Text>
        </View>
      </SettingsGroup>
    </>
  );

  const pane =
    nav === "general" || nav === "fx"
      ? generalBody
      : nav === "account"
        ? accountBody
        : nav === "subscription"
          ? subscriptionBody
          : nav === "banks"
            ? banksBody
            : aboutBody;

  const title =
    nav === "fx"
      ? "General"
      : nav === "banks"
        ? "Banks & institutions"
        : nav.charAt(0).toUpperCase() + nav.slice(1);

  if (desktop) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: false, presentation: "transparentModal" }}
        />
        <SettingsSheet activeNav={nav} onNavChange={setNav} title={title}>
          {pane}
        </SettingsSheet>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Settings",
          presentation: "modal",
          headerShown: true,
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          ),
        }}
      />
      <Screen refreshing={false} onRefresh={() => void reload()}>
        {pane}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  close: {
    fontSize: 16,
    color: colors.textSecondary,
    backgroundColor: colors.bgMuted,
    width: 30,
    height: 30,
    borderRadius: 15,
    textAlign: "center",
    lineHeight: 30,
    overflow: "hidden",
  },
  navPills: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
    flexWrap: "wrap",
  },
  navPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  navPillOn: {
    backgroundColor: colors.accentBlueSoft,
    borderColor: "transparent",
  },
  navPillText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  navPillTextOn: { color: colors.accentBlue },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  col: { flexDirection: "column", alignItems: "stretch" },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { ...type.headline },
  rowDesc: { ...type.footnote, marginTop: 2, color: colors.textTertiary },
  stubTag: {
    ...type.footnote,
    marginTop: 4,
    color: colors.accentBlue,
    fontWeight: "600",
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: 10,
  },
  fieldGrid: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
  },
  fieldCol: { flex: 1 },
  fieldLabel: { ...type.sectionLabel, marginBottom: 6, marginLeft: 0 },
  field: {
    height: 40,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgInput,
    paddingHorizontal: 12,
    color: colors.textPrimary,
    fontSize: 14,
  },
  saveBtn: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    marginTop: 4,
  },
  msg: {
    ...type.footnote,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },
  stub: { padding: spacing.lg },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgCard,
  },
  tagChipText: {
    ...type.callout,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgCard,
  },
  actionBtnText: {
    ...type.callout,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  emailBox: {
    minWidth: 180,
    maxWidth: 260,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.input,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  emailText: { ...type.callout, fontSize: 13 },
  paywall: {
    padding: spacing.xl,
    alignItems: "center",
  },
  paywallEmoji: { fontSize: 36, marginBottom: spacing.sm },
  paywallTitle: { ...type.title2, marginBottom: 6 },
  paywallBody: {
    ...type.footnote,
    textAlign: "center",
    color: colors.textSecondary,
    maxWidth: 320,
  },
});
