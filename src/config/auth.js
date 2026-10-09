
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";
import { MongoClient } from "mongodb";

const mongoUrl = process.env.MONGODB_URL;

if (!mongoUrl) {
  throw new Error("MONGODB_URL is missing in environment variables.");
}

const mongoClient = new MongoClient(mongoUrl);
const database = mongoClient.db("property_db");

const frontendUrl = (
  process.env.FRONTEND_URL || "http://localhost:3000"
).replace(/\/+$/, "");

const backendUrl = (
  process.env.BETTER_AUTH_URL || "http://localhost:5000"
).replace(/\/+$/, "");

export const auth = betterAuth({
  baseURL: backendUrl,

  secret: process.env.BETTER_AUTH_SECRET,

  database: mongodbAdapter(database, {
    client: mongoClient,
  }),

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

  emailAndPassword: {
    enabled: true,
  },

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

  trustedOrigins: [
    "http://localhost:3000",
    frontendUrl,
    "https://rent-next-client.vercel.app",
    "https://property-rental-rosy.vercel.app",
  ],
});
