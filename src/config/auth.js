import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";
import { MongoClient } from "mongodb";

// ========================================
// ENVIRONMENT VALIDATION
// ========================================

const isProd = process.env.NODE_ENV === "production";

const mongoUrl = process.env.MONGODB_URL;
const authSecret = process.env.BETTER_AUTH_SECRET;

if (!mongoUrl) {
  throw new Error("MONGODB_URL is missing in environment variables.");
}

if (!authSecret) {
  throw new Error("BETTER_AUTH_SECRET is missing in environment variables.");
}

// Production-e localhost fallback silently bhul jaygay niye jay, tai fail koriye dilam
if (isProd) {
  if (!process.env.FRONTEND_URL || !process.env.BETTER_AUTH_URL) {
    throw new Error(
      "FRONTEND_URL and BETTER_AUTH_URL are required in production."
    );
  }
}

// ========================================
// MONGODB CONFIGURATION
// ========================================

const mongoClient = new MongoClient(mongoUrl);
const database = mongoClient.db("property_db");

// ========================================
// URL CONFIGURATION
// ========================================

const frontendUrl = (
  process.env.FRONTEND_URL || "http://localhost:3000"
).replace(/\/+$/, "");

const backendUrl = (
  process.env.BETTER_AUTH_URL || "http://localhost:5000"
).replace(/\/+$/, "");

// ========================================
// TRUSTED ORIGINS
// ========================================

const trustedOrigins = [
  "http://localhost:3000",
  "https://rent-next-client.vercel.app",
  "https://property-rental-rosy.vercel.app",
  frontendUrl,
].filter((origin, index, origins) => {
  return origin && origins.indexOf(origin) === index;
});

// ========================================
// BETTER AUTH CONFIGURATION
// ========================================

export const auth = betterAuth({
  baseURL: backendUrl,
  secret: authSecret,

  database: mongodbAdapter(database, {
    client: mongoClient,
  }),

  trustedOrigins,

  // ======================================
  // USER FIELDS
  // ======================================

  user: {
    additionalFields: {
      role: {
        type: ["tenant", "owner", "admin"],
        required: false,
        defaultValue: "tenant",
        input: false,
        returned: true,
      },

      photo: {
        type: "string",
        required: false,
        defaultValue: "",
        input: true,
        returned: true,
      },
    },
  },

  // ======================================
  // USER ROLE ASSIGNMENT
  // ======================================

  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          let assignedRole = user.role || "tenant";

          if (ctx?.path === "/sign-up/email") {
            const requestedRole = ctx?.body?.role;

            if (!["tenant", "owner"].includes(requestedRole)) {
              throw new APIError("BAD_REQUEST", {
                message:
                  "Invalid account type. Please select Tenant or Owner.",
              });
            }

            assignedRole = requestedRole;
          }

          return {
            data: {
              ...user,
              role: assignedRole,
            },
          };
        },
      },
    },
  },

  // ======================================
  // EMAIL AND PASSWORD
  // ======================================

  emailAndPassword: {
    enabled: true,
  },

  // ======================================
  // SOCIAL LOGIN
  // ======================================

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },

    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    },
  },

  // ======================================
  // JWT CONFIGURATION
  // ======================================

  plugins: [
    jwt({
      jwt: {
        definePayload: ({ user }) => ({
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          photo: user.photo || user.image || "",
        }),

        expirationTime: "7d",
      },
    }),
  ],

  // ======================================
  // COOKIE CONFIGURATION (cross-domain fix)
  // ======================================
  // Frontend (vercel.app) ar backend (onrender.com) alada site,
  // tai production-e SameSite=None + Secure lagbe.
  // Local-e (http) Lax + non-secure.

  advanced: {
    useSecureCookies: isProd,
    defaultCookieAttributes: {
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      httpOnly: true,
    },
  },
});