/** Turns Supabase/Postgres error messages into something friendly. */
export const friendlyError = (err: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  const msg = (err as { message?: string })?.message ?? '';
  if (msg.includes('invalid_code')) return "That code doesn't match any space. Check it and try again.";
  if (msg.includes('space_full')) return 'That space already has two people in it.';
  if (msg.includes('already_member')) return "You're already part of a space.";
  if (msg.includes('not_allowed')) return "You can only change things you created.";
  if (msg.includes('row-level security')) return "You don't have permission to do that.";
  return msg || fallback;
};
