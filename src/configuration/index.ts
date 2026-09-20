import * as dotenv from 'dotenv';

dotenv.config();

export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  connectionString: process.env.CONNECTION_STRING,
  jwtSecret: process.env.JWT_SECRET,

  // Single source of truth for how long a login is good for - used both as
  // the JWT's own fixed expiry (JwtModule, via constants()) and as the
  // sliding inactivity timeout enforced against UserAuthSession (see
  // AuthMiddleware/UserAuthSessionRepository). No longer admin-editable via
  // Settings - a login's lifetime is an env/ops concern, not a per-tenant one.
  sessionTimeoutMinutes:
    parseInt(process.env.SESSION_TIMEOUT_MINUTES, 10) || 480,

  application: {
    name: process.env.APP_NAME,
    apiBaseUrl: process.env.API_BASE_URL,
    clientBaseUrl: process.env.CLIENT_BASE_URL || 'http://localhost:3000',
  },

  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,

  paystack: {
    key: process.env.PAYSTACK_SECRET_KEY,
    url: process.env.PAYSTACK_BASE_URL,
    // Paystack expects amounts in the smallest currency unit (pesewas for
    // GHS) - this is that conversion factor. `0` (or unset) falls back to
    // 1 via the `||` below, i.e. no conversion, so a dev/test charge for
    // "99" is sent as 99 pesewas (~GHS 1) rather than the full GHS 99 -
    // deliberately trivial even if this ever ran against a live key by
    // mistake. Set to 100 in production to get real pesewas amounts.
    amountMultiplier: Number(process.env.PAYSTACK_AMOUNT_MULTIPLIER) || 1,
  },
});
