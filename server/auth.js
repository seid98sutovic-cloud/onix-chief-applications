import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const COOKIE_NAME = "onix_admin_token";

export function authMiddleware(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || extractBearer(req);
  if (!token) {
    return res.status(401).json({ error: "Niste prijavljeni." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Sesija je istekla. Prijavite se ponovo." });
  }
}

export function signToken(admin) {
  return jwt.sign({ id: admin.id, username: admin.username }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export { cookieParser, COOKIE_NAME };

function extractBearer(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return null;
}
