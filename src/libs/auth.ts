import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI || "mongodb://localhost:27017/mascoticas");
const db = client.db();

export const auth = betterAuth({
    database: mongodbAdapter(db, {
        usePlural: true
        
    }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
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
    trustedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000', "https://mascoticas.app"]
});