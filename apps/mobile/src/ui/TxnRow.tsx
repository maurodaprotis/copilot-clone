import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type } from "../theme";
import { Amount } from "./Amount";
import { CategoryPill } from "./CategoryPill";

type Props = {
  merchant: string;
  account?: string;
  categoryEmoji?: string;
  categoryName?: string;
  categoryColor?: string;
  amountLabel: string;
  income?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  /** Copilot web multi-select chrome (audit 11-transactions). */
  showCheckbox?: boolean;
  checked?: boolean;
  onToggleCheck?: () => void;
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(96,165,250,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function TxnRow({
  merchant,
  account,
  categoryEmoji,
  categoryName,
  categoryColor,
  amountLabel,
  income,
  leading,
  trailing,
  onPress,
  selected,
  showCheckbox,
  checked,
  onToggleCheck,
}: Props) {
  const glyphBg = categoryColor
    ? hexToRgba(categoryColor, 0.2)
    : colors.bgMuted;

  const main = (
    <>
      {selected ? <View style={styles.selBar} /> : null}
      {showCheckbox ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onToggleCheck?.();
          }}
          hitSlop={6}
          style={[styles.checkbox, (checked || selected) && styles.checkboxOn]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!(checked || selected) }}
        >
          {checked || selected ? <Text style={styles.checkMark}>✓</Text> : null}
        </Pressable>
      ) : null}
      {leading ?? (
        <View style={[styles.glyph, { backgroundColor: glyphBg }]}>
          <Text style={styles.glyphEmoji}>{categoryEmoji || (income ? "$" : "•")}</Text>
        </View>
      )}
      <View style={styles.mid}>
        <View style={styles.titleLine}>
          <Text style={styles.merchant} numberOfLines={1}>
            {merchant}
          </Text>
          {account ? (
            <Text style={styles.account} numberOfLines={1}>
              {account}
            </Text>
          ) : null}
        </View>
      </View>
      {categoryName ? (
        <CategoryPill emoji={categoryEmoji} name={categoryName} color={categoryColor} />
      ) : null}
      <Amount value={amountLabel} variant={income ? "income" : "expense"} />
    </>
  );

  // Trailing (e.g. Review) must be a SIBLING of the row Pressable on web —
  // nested Pressables swallow / miss clicks (pointer-events).
  if (onPress) {
    return (
      <View style={[styles.row, selected && styles.selected]}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.rowPress, pressed && styles.pressed]}
        >
          {main}
        </Pressable>
        {trailing ? <View style={styles.trailingSlot}>{trailing}</View> : null}
      </View>
    );
  }
  return (
    <View style={[styles.row, selected && styles.selected]}>
      {main}
      {trailing ? <View style={styles.trailingSlot}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    position: "relative",
  },
  rowPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 0,
  },
  trailingSlot: {
    flexShrink: 0,
    zIndex: 2,
  },
  selected: {
    backgroundColor: colors.bgSelection,
  },
  selBar: {
    position: "absolute",
    left: 0,
    top: 4,
    bottom: 4,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.bgSelectionBar,
  },
  pressed: { backgroundColor: colors.accentBlueSoft },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  checkMark: { color: "#fff", fontSize: 11, fontWeight: "700", lineHeight: 12 },
  glyph: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  glyphEmoji: { fontSize: 13 },
  mid: { flex: 1, minWidth: 0 },
  titleLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "nowrap",
  },
  merchant: { ...type.headline, fontSize: 14, lineHeight: 18, flexShrink: 1 },
  account: {
    ...type.footnote,
    fontSize: 12,
    color: colors.textTertiary,
    flexShrink: 2,
  },
});
