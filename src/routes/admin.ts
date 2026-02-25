import { Hono } from "hono";
import { auth } from "../libs/auth";
import { User } from "../schemas/User";
import { Pet } from "../schemas/Pet";
import { Match } from "../schemas/Match";
import { Vet } from "../schemas/Vet";

export const adminRouter = new Hono();

// Add middleware to check admin role
adminRouter.use("/*", async (c, next) => {
    const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
    if (!session) {
        return c.json({ error: "No autorizado" }, 401);
    }
    const userRole = (session.user as any).role;
    if (userRole !== "admin") {
        return c.json({ error: "Acceso denegado" }, 403);
    }
    await next();
});

adminRouter.get("/stats", async (c) => {
    try {
        const [totalUsers, totalPets, totalMatches, totalVets, pendingVets] = await Promise.all([
            User.countDocuments(),
            Pet.countDocuments(),
            Match.countDocuments(),
            Vet.countDocuments(),
            Vet.countDocuments({ is_verified: false }),
        ]);

        return c.json({
            success: true,
            stats: {
                totalUsers,
                totalPets,
                totalMatches,
                totalVets,
                pendingVets
            }
        });
    } catch (error) {
        console.error("Error fetching admin stats:", error);
        return c.json({ error: "Error fetchinig stats" }, 500);
    }
});

adminRouter.get("/vets/pending", async (c) => {
    try {
        const vets = await Vet.find({ is_verified: false }).sort({ createdAt: -1 });
        return c.json({ success: true, pending: vets });
    } catch (error) {
        console.error("Error fetching pending vets:", error);
        return c.json({ error: "Error interno del servidor" }, 500);
    }
});

adminRouter.patch("/vets/:id/approve", async (c) => {
    try {
        const vetId = c.req.param("id");
        const vet = await Vet.findByIdAndUpdate(vetId, { is_verified: true }, { new: true });

        if (!vet) {
            return c.json({ error: "Veterinaria no encontrada" }, 404);
        }

        return c.json({ success: true, vet });
    } catch (error) {
        console.error("Error approving vet:", error);
        return c.json({ error: "Error interno del servidor" }, 500);
    }
});
