export function userView(user) {
  return {
    id: user.id ?? user._id.toString(),
    username: user.username,
    laundryDays: user.laundryDays,
    categories: user.categories,
  };
}
