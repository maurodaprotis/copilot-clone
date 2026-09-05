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
      {leading ?? <View style={styles.glyph} />}
      <View style={styles.mid}>
        <Text style={styles.merchant} numberOfLines={1}>
          {merchant}
        </Text>
        {account ? (
          <Text style={styles.account} numberOfLines={1}>
            {account}
          </Text>
        ) : null}
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 60,
  },
  selected: {
    backgroundColor: colors.bgSelection,
    borderLeftWidth: 3,
    borderLeftColor: colors.bgSelectionBar,
  },
  pressed: { backgroundColor: colors.accentBlueSoft },
  glyph: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.bgMuted,
  },
  mid: { flex: 1, minWidth: 0 },
  merchant: { ...type.headline },
  account: { ...type.footnote, marginTop: 2, color: colors.textTertiary },
});
