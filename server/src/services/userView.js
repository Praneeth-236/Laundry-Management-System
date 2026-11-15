export function userView(user) {
  return {
    id: user.id ?? user._id.toString(),
    username: user.username,
    email: user.email ?? null,
    emailVerified: Boolean(user.emailVerifiedAt),
    laundryDays: user.laundryDays,
    categories: user.categories,
  };
}
