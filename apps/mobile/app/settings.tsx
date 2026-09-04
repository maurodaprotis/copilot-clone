import { useCallback, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
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
  Card,
  Chip,
  PrimaryButton,
  Screen,
  SectionHeader,
} from "../src/ui";

const SERIES: FxSeries[] = ["official", "parallel", "custom"];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [rates, setRates] = useState<FxRate[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
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

  return (
    <>
      <Stack.Screen options={{ title: "Settings" }} />
      <Screen refreshing={false} onRefresh={() => void reload()}>
        <Text style={styles.lead}>
          Reporting currency, FX series, and manual rates — the same product
          surface as Copilot Settings.
        </Text>

        <Text style={styles.groupLabel}>General</Text>
        <Card>
          <Text style={styles.label}>Reporting currency</Text>
          <View style={styles.row}>
            {["USD", "ARS", "EUR"].map((c) => (
              <Chip
                key={c}
                label={c}
                selected={settings?.reporting_currency === c}
                onPress={() => void saveSettings({ reporting_currency: c })}
              />
            ))}
          </View>

          <Text style={styles.label}>Default FX series</Text>
          <View style={styles.row}>
            {SERIES.map((s) => (
              <Chip
                key={s}
                label={s}
                selected={settings?.default_fx_series === s}
                onPress={() => void saveSettings({ default_fx_series: s })}
              />
            ))}
          </View>

          <Text style={styles.label}>Timezone</Text>
          <TextInput
            style={styles.input}
            value={settings?.timezone ?? ""}
            onChangeText={(timezone) =>
              setSettings((p) => (p ? { ...p, timezone } : p))
            }
            onBlur={() =>
              settings && void saveSettings({ timezone: settings.timezone })
            }
            placeholder="America/Argentina/Salta"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.label}>Locale</Text>
          <TextInput
            style={styles.input}
            value={settings?.locale ?? ""}
            onChangeText={(locale) =>
              setSettings((p) => (p ? { ...p, locale } : p))
            }
            onBlur={() =>
              settings && void saveSettings({ locale: settings.locale })
            }
            placeholder="en-US"
            placeholderTextColor={colors.textTertiary}
          />
        </Card>

        <SectionHeader title="Manual FX rates" />
        <Card>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.flex]}
              value={base}
              onChangeText={setBase}
              placeholder="Base"
              autoCapitalize="characters"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.input, styles.flex]}
              value={quote}
              onChangeText={setQuote}
              placeholder="Quote"
              autoCapitalize="characters"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.flex]}
              value={asOf}
              onChangeText={setAsOf}
              placeholder="as_of"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.input, styles.flex]}
              value={rate}
              onChangeText={setRate}
              placeholder="Rate"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={styles.row}>
            {SERIES.map((s) => (
              <Chip
                key={s}
                label={s}
                selected={book === s}
                onPress={() => setBook(s)}
              />
            ))}
          </View>
          <PrimaryButton
            label="Save FX rate"
            onPress={() => void onAddFx()}
            loading={busy}
          />
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        </Card>

        {rates.slice(0, 12).map((r) => (
          <Card
            key={`${r.from}:${r.to}:${r.on_date}:${r.rate_book}`}
            style={styles.rateCard}
          >
            <Text style={styles.rateTitle}>
              {r.from}/{r.to} = {r.rate}
            </Text>
            <Text style={styles.rateMeta}>
              {r.on_date} · {r.rate_book} · {r.source ?? "manual"}
            </Text>
          </Card>
        ))}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  lead: { ...type.subhead, marginBottom: spacing.lg, lineHeight: 18 },
  groupLabel: { ...type.caption, marginBottom: spacing.sm, marginLeft: 4 },
  label: {
    ...type.footnote,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: spacing.sm,
    color: colors.text,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    marginBottom: spacing.sm,
    backgroundColor: colors.chipBg,
    color: colors.text,
    fontSize: 15,
  },
  flex: { flex: 1 },
  row: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm,
    flexWrap: "wrap",
  },
  msg: { ...type.footnote, marginTop: spacing.sm, color: colors.text },
  rateCard: { marginBottom: spacing.sm },
  rateTitle: { ...type.headline },
  rateMeta: { ...type.footnote, marginTop: 4 },
});
