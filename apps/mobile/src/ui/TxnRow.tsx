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
  amountLabel: string;
  income?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  selected?: boolean;
};

export function TxnRow({
  merchant,
  account,
  categoryEmoji,
  categoryName,
  amountLabel,
  income,
  leading,
  trailing,
  onPress,
  selected,
}: Props) {
  const content = (
    <View style={[styles.row, selected && styles.selected]}>
      {selected ? <View style={styles.selBar} /> : null}
      {leading ?? <View style={styles.glyph} />}
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
        <CategoryPill emoji={categoryEmoji} name={categoryName} />
      ) : null}
      <Amount value={amountLabel} variant={income ? "income" : "expense"} />
      {trailing}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }
  return content;
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
  glyph: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.bgMuted,
  },
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
