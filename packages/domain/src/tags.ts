import type { Tag, TransactionTag } from "./types.js";

/** Tags are orthogonal to categories — no budget impact (TG1). */
export function tagsForTransaction(
  transactionId: string,
  links: TransactionTag[],
  tags: Tag[],
): Tag[] {
  const ids = new Set(
    links.filter((l) => l.transaction_id === transactionId).map((l) => l.tag_id),
  );
  return tags.filter((t) => ids.has(t.id));
}

export function withTagAssigned(
  links: TransactionTag[],
  transactionId: string,
  tagId: string,
): TransactionTag[] {
  if (links.some((l) => l.transaction_id === transactionId && l.tag_id === tagId)) {
    return links;
  }
  return [...links, { transaction_id: transactionId, tag_id: tagId }];
}

export function withTagRemoved(
  links: TransactionTag[],
  transactionId: string,
  tagId: string,
): TransactionTag[] {
  return links.filter(
    (l) => !(l.transaction_id === transactionId && l.tag_id === tagId),
  );
}
