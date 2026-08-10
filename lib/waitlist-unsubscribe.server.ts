export type WaitlistUnsubscribeRecord = {
  unsubscribedAt: string | null;
};

export type WaitlistUnsubscribeRepository = {
  markUnsubscribed(token: string, unsubscribedAt: string): Promise<boolean>;
  findByToken(token: string): Promise<WaitlistUnsubscribeRecord | null>;
};

export type WaitlistUnsubscribeStatus =
  | "unsubscribed"
  | "already_unsubscribed"
  | "not_found";

export async function unsubscribeWaitlist(
  repository: WaitlistUnsubscribeRepository,
  token: string,
  unsubscribedAt: string,
): Promise<WaitlistUnsubscribeStatus> {
  if (await repository.markUnsubscribed(token, unsubscribedAt)) {
    return "unsubscribed";
  }

  const existing = await repository.findByToken(token);
  if (!existing) return "not_found";
  if (existing.unsubscribedAt) return "already_unsubscribed";

  throw new Error("The waitlist unsubscribe update could not be confirmed.");
}
