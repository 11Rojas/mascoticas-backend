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

adminRouter.get("/vets/approved", async (c) => {
    try {
        const vets = await Vet.find({ is_verified: true }).sort({ createdAt: -1 });
        return c.json({ success: true, approved: vets });
    } catch (error) {
        console.error("Error fetching approved vets:", error);
        return c.json({ error: "Error interno del servidor" }, 500);
    }
});

adminRouter.delete("/vets/:id", async (c) => {
    try {
        const vetId = c.req.param("id");
        const vet = await Vet.findByIdAndDelete(vetId);
        if (!vet) {
            return c.json({ error: "Veterinaria no encontrada" }, 404);
        }
        return c.json({ success: true });
    } catch (error) {
        console.error("Error deleting vet:", error);
        return c.json({ error: "Error interno del servidor" }, 500);
    }
});

adminRouter.get("/logs", async (c) => {
    try {
        // Fetch latest data from various collections to build a timeline
        const latestUsers = await User.find().sort({ createdAt: -1 }).limit(10).select('name email createdAt plan');
        const latestMatches = await Match.find().sort({ createdAt: -1 }).limit(10).populate('pet_a', 'name').populate('pet_b', 'name').select('createdAt status pet_a pet_b');
        const latestVets = await Vet.find().sort({ createdAt: -1 }).limit(10).select('name owner is_verified createdAt');

        let logs: any[] = [];

        latestUsers.forEach(u => {
            logs.push({
                id: `u-${u._id}`,
                type: 'NEW_USER',
                title: 'Nuevo Usuario Registrado',
                description: `${u.name} se unió a Mascoticas.`,
                date: u.createdAt
            });
            if (u.plan && u.plan !== 'free') {
                // Fake a subscription/transfer log for demo purposes using user updated/created time
                logs.push({
                    id: `p-${u._id}`,
                    type: 'TRANSFER',
                    title: 'Suscripción / Pago',
                    description: `${u.name} activó el plan ${u.plan.toUpperCase()}.`,
                    date: u.createdAt // In a real app we'd use a transaction date
                });
            }
        });

        latestMatches.forEach((m: any) => {
            logs.push({
                id: `m-${m._id}`,
                type: 'NEW_MATCH',
                title: '¡Nuevo Match!',
                description: `Hubo un match temporal o permanente. (${m.status})`, // we can refine this later if needed
                date: m.createdAt
            });
        });

        latestVets.forEach(v => {
            logs.push({
                id: `v-${v._id}`,
                type: 'NEW_VET',
                title: v.is_verified ? 'Veterinaria Aprobada' : 'Solicitud Veterinaria',
                description: `${v.owner} registró la clínica "${v.name}".`,
                date: v.createdAt
            });
        });

        // Sort combined logs by date descending
        logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        logs = logs.slice(0, 30); // Return top 30 recent events

        return c.json({ success: true, logs });
    } catch (error) {
        console.error("Error fetching admin logs:", error);
        return c.json({ error: "Error fetching logs" }, 500);
    }
});

