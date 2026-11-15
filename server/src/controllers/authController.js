import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { userView } from "../services/userView.js";
import { credentialsSchema } from "../validation/schemas.js";

function rotateSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.userId = userId.toString();
      req.session.save((saveError) => saveError ? reject(saveError) : resolve());
    });
  });
}

export async function register(req, res) {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Use a 3-20 character username and a password of at least 12 characters.", "INVALID_CREDENTIALS");
  const { username, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    username,
    usernameNormalized: username.toLowerCase(),
    passwordHash,
  });
  await rotateSession(req, user._id);
  res.status(201).json({ user: userView(user) });
}

export async function login(req, res) {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Invalid username or password.", "INVALID_CREDENTIALS");
  const { username, password } = parsed.data;
  const user = await User.findOne({ usernameNormalized: username.toLowerCase() }).select("+passwordHash");
  const matches = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!matches) throw new HttpError(401, "Invalid username or password.", "INVALID_CREDENTIALS");
  await rotateSession(req, user._id);
  res.json({ user: userView(user) });
}

export async function currentUser(req, res) {
  if (!req.session.userId) return res.json({ user: null });
  const user = await User.findById(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.json({ user: null });
  }
  res.json({ user: userView(user) });
}

export async function logout(req, res) {
  await new Promise((resolve, reject) => {
    req.session.destroy((error) => error ? reject(error) : resolve());
  });
  res.clearCookie("laundry.sid", { httpOnly: true, sameSite: "lax", secure: req.secure });
  res.status(204).end();
}
