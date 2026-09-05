import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type } from "../theme";

type Props = {
  emoji?: string;
  name: string;
  /** Soft tint behind emoji so category icons aren’t gray. */
  color?: string;
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

export function CategoryPill({ emoji, name, color }: Props) {
  return (
    <View style={styles.pill}>
      {emoji ? (
        <View
          style={[
            styles.emojiWrap,
            color ? { backgroundColor: hexToRgba(color, 0.22) } : null,
          ]}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </View>
      ) : null}
      <Text style={styles.text} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.categoryPillBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    maxWidth: 140,
  },
  emojiWrap: {
    width: 16,
    height: 16,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 10 },
  text: {
    ...type.captionEmphasized,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    color: colors.textSecondary,
  },
});
