import 'dotenv/config';
import { auth } from '../libs/auth';
import { User } from '../schemas/User';
import mongoose from 'mongoose';

async function seedAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/mascoticas?authSource=admin");
        console.log("Connected to MongoDB");

        const existingAdmin = await User.findOne({ email: "admin@mascoticas.app" });

        if (existingAdmin) {
            console.log("Admin user already exists. Updating role...");
            // Update better-auth table
            await mongoose.connection.collection("users").updateOne({ email: "admin@mascoticas.app" }, { $set: { role: "admin" } });
            // Update mongoose
            existingAdmin.role = "admin";
            await existingAdmin.save();
            console.log("Admin role updated.");
        } else {
            console.log("Creating admin user...");
            // Use better-auth to create user with email & password
            const newAdmin = await auth.api.signUpEmail({
                body: {
                    name: "Administrador Mascoticas",
                    email: "admin@mascoticas.app",
                    password: "Mascoticas.2412",
                }
            });
            console.log("User created in better-auth.");

            // Make them an admin
            await mongoose.connection.collection("users").updateOne(
                { email: "admin@mascoticas.app" },
                { $set: { role: "admin", emailVerified: true, profile_picture: "https://ui-avatars.com/api/?name=Admin+Mascoticas&background=f97316&color=fff" } }
            );

            console.log("Admin user seeded successfully!");
        }
    } catch (e) {
        console.error("Error seeding admin:", e);
    } finally {
        process.exit(0);
    }
}

seedAdmin();
