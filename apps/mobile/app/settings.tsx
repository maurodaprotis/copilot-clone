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

  const generalBody = (
    <>
      {!desktop ? (
        <View style={styles.navPills}>
          {["General", "Account", "Banks", "About"].map((p, i) => (
            <View key={p} style={[styles.navPill, i === 0 && styles.navPillOn]}>
              <Text style={[styles.navPillText, i === 0 && styles.navPillTextOn]}>
                {p}
              </Text>
            </View>
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
            <Text style={styles.rowDesc}>Set monthly budgets for categories</Text>
          </View>
          <Toggle value={budgetingOn} onChange={setBudgetingOn} />
        </View>
        <SettingsDivider />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Enable rollover</Text>
            <Text style={styles.rowDesc}>Allow budgets across months</Text>
          </View>
          <Toggle value={rolloverOn} onChange={setRolloverOn} />
        </View>
      </SettingsGroup>

      <SettingsGroup label="Reporting & FX">
        <View style={[styles.row, styles.col]}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Reporting currency</Text>
            <Text style={styles.rowDesc}>USD-first · ARS supported</Text>
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
              Used when converting to reporting currency
            </Text>
          </View>
          <View style={styles.pills}>
            {SERIES.map((s) => (
              <Chip
                key={s}
                label={s}
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
        <ListRow
          title="Locale"
          subtitle={settings?.locale ?? "en-US"}
          chevron
        />
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
              label={s}
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

  const stub = (label: string, body: string) => (
    <SettingsGroup label={label}>
      <View style={styles.stub}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDesc}>{body}</Text>
      </View>
    </SettingsGroup>
  );

  const pane =
    nav === "general" || nav === "fx"
      ? generalBody
      : nav === "account"
        ? stub("Account", "Profile and security — coming soon.")
        : nav === "subscription"
          ? stub("Subscription", "Copilot Pro stub — out of polish scope.")
          : nav === "banks"
            ? stub("Banks", "Manual accounts only — no Plaid in this clone.")
            : stub("About", "Copilot Money clone · USD-first · multi-currency ARS.");

  if (desktop) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, presentation: "transparentModal" }} />
        <SettingsSheet
          activeNav={nav}
          onNavChange={setNav}
          title={
            nav === "fx"
              ? "FX & Import"
              : nav.charAt(0).toUpperCase() + nav.slice(1)
          }
        >
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
        {generalBody}
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
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 10 },
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
});
