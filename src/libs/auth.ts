import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI || "mongodb://localhost:27017/mascoticas");
const db = client.db();

// Ensure the URL always has a protocol (guards against BETTER_AUTH_URL=api.mascoticas.app)
function ensureProtocol(url: string | undefined, fallback: string): string {
    if (!url) return fallback;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
}

export const auth = betterAuth({
    database: mongodbAdapter(db, {
        usePlural: true

    }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: ensureProtocol(process.env.BETTER_AUTH_URL, 'http://localhost:3001'),
    user: {
        fields: {
            image: "profile_picture",
            emailVerified: "is_verified",
        },
        additionalFields: {
            phone: { type: "string", required: false },
            status: { type: "string", defaultValue: "active" },
            badges: { type: "string[]", required: false },
            location: { type: "string", required: false },
        }
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        }
    },
    trustedOrigins: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://mascoticas.app',
        'https://www.mascoticas.app',
        ...(process.env.ALLOWED_ORIGIN ? [process.env.ALLOWED_ORIGIN] : []),
    ]
});