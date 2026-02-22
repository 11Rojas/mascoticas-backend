import { Hono } from 'hono';
import { User } from '../schemas/User';
import { Pet } from '../schemas/Pet';
import { auth } from '../libs/auth';
import { Swipe } from '../schemas/Swipe';
import { Match } from '../schemas/Match';
import { Chat } from '../schemas/Chat';
import { Message } from '../schemas/Message';
import { Notification } from '../schemas/Notification';
import { NotificationType } from '../interfaces/Notifications.d';
import { MatchStatus } from '../interfaces/Match.d';
import * as webpush from 'web-push';
import { broadcastToChat } from '../libs/ws';

// Web Push Configuration
const VAPID_KEYS = {
    public: process.env.VAPID_PUBLIC_KEY,
    private: process.env.VAPID_PRIVATE_KEY
};

console.log('DEBUG: Initializing Web Push with keys:', {
    hasPublic: !!VAPID_KEYS.public,
    hasPrivate: !!VAPID_KEYS.private
});

if (VAPID_KEYS.public && VAPID_KEYS.private) {
    webpush.setVapidDetails(
        'mailto:admin@mascoticas.app',
        VAPID_KEYS.public,
        VAPID_KEYS.private
    );
} else {
    console.warn('WARNING: VAPID keys are missing from environment variables!');
}

// Global Push Notification Helper
const sendPush = async (userId: any, title: string, message: string, url: string = '/dashboard/chats', chatId?: string) => {
    console.log(`DEBUG: Sending push to user ${userId}`);

    if (!VAPID_KEYS.public || !VAPID_KEYS.private) {
        console.error('CRITICAL: VAPID keys were not initialized.');
        return;
    }

    // Check if muted
    if (chatId) {
        const chat = await Chat.findById(chatId);
        if (chat && chat.muted_by.includes(userId)) {
            console.log(`DEBUG: Push skipped, user ${userId} has muted chat ${chatId}`);
            return;
        }
    }

    const recipient = await User.findById(userId);
    if (recipient && recipient.pushSubscriptions && recipient.pushSubscriptions.length > 0) {
        const payload = JSON.stringify({ title, message, url, chatId });
        const subscriptions = recipient.pushSubscriptions;

        const pushPromises = subscriptions.map((sub, idx) =>
            webpush.sendNotification(sub, payload)
                .then(() => console.log(`DEBUG: Push sent to device ${idx}`))
                .catch(err => {
                    console.error(`DEBUG: Push error on device ${idx}:`, err.message);
                })
        );
        await Promise.all(pushPromises);
    } else {
        console.log('DEBUG: User has no push subscriptions');
    }
};

// Haversine formula to calculate distance in KM
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const userRouter = new Hono();

userRouter.post('/update-location', async (c) => {
    try {
        console.log("Headers received:", c.req.raw.headers);
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        console.log("Session found:", session);

        if (!session) {
            return c.json({ error: 'No autorizado' }, 401);
        }

        const { lat, lng, address } = await c.req.json();

        const updatedUser = await User.findOneAndUpdate(
            { email: session.user.email },
            {
                location: {
                    address,
                    coordinates: { lat, lng }
                }
            },
            { new: true }
        );

        return c.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error('Error updating location:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

userRouter.post('/pets', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const data = await c.req.json();
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const newPet = new Pet({
            owner_id: user._id,
            ...data
        });

        await newPet.save();

        user.pets.push(newPet._id as any);
        await user.save();

        return c.json({ success: true, pet: newPet });
    } catch (error) {
        console.error('Error creating pet:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

userRouter.get('/pets', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const pets = await Pet.find({ owner_id: user._id });
        return c.json({ success: true, pets });
    } catch (error) {
        console.error('Error fetching pets:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// PATCH /pets/:id/match-setup - Save match preferences and enable match mode
userRouter.patch('/pets/:id/match-setup', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const petId = c.req.param('id');
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const { matchPreferences } = await c.req.json();

        const pet = await Pet.findOneAndUpdate(
            { _id: petId, owner_id: user._id },
            { matchMode: true, matchPreferences },
            { new: true }
        );

        if (!pet) return c.json({ error: 'Mascota no encontrada' }, 404);

        return c.json({ success: true, pet });
    } catch (error) {
        console.error('Error setting up match:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// PATCH /pets/:id/match-toggle - Toggle match mode on/off
userRouter.patch('/pets/:id/match-toggle', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const petId = c.req.param('id');
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const pet = await Pet.findOne({ _id: petId, owner_id: user._id });
        if (!pet) return c.json({ error: 'Mascota no encontrada' }, 404);

        pet.matchMode = !pet.matchMode;
        await pet.save();

        return c.json({ success: true, matchMode: pet.matchMode, pet });
    } catch (error) {
        console.error('Error toggling match mode:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// GET /pets/:id/match-candidates - Fetch suitable pets for matching
userRouter.get('/pets/:id/match-candidates', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const activePetId = c.req.param('id');
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const activePet = await Pet.findById(activePetId);
        if (!activePet || activePet.owner_id.toString() !== user._id.toString()) {
            return c.json({ error: 'Mascota no válida' }, 403);
        }

        if (!activePet.matchMode || !activePet.matchPreferences) {
            console.log(`Pet ${activePetId} not in match mode or has no preferences`);
            return c.json({ success: true, pets: [] }); // Not in match mode
        }

        const prefs = activePet.matchPreferences;
        const userCoords = user.location?.coordinates;

        // 1. Get IDs of pets already swiped
        const swipedPetIds = await Swipe.find({ swiper_pet: activePetId }).distinct('swiped_pet');

        // 2. Query other pets - EXTREMELY PERMISSIVE FOR DEBUGGING
        const query: any = {
            owner_id: { $ne: user._id },
            _id: { $ne: activePetId, $nin: swipedPetIds }
        };

        console.log(`DEBUG: Finding match candidates. USER: ${user._id}, PET: ${activePetId}`);
        console.log(`DEBUG: Swiped IDs:`, swipedPetIds);

        // We also want to PRIORITIZE pets that have already liked us.
        const whoLikedMeIds = await Swipe.find({ swiped_pet: activePetId, type: 'like' }).distinct('swiper_pet');

        // Fetch ALL other pets regardless of anything else
        const candidates = await Pet.find(query).populate('owner_id', 'location');
        console.log(`DEBUG: Found ${candidates.length} potential pets from DB total`);

        const results = candidates.map(pet => {
            const owner = pet.owner_id as any;
            const ownerCoords = owner.location?.coordinates;

            let distance = 0;
            if (userCoords?.lat && userCoords?.lng && ownerCoords?.lat && ownerCoords?.lng) {
                distance = getDistance(
                    userCoords.lat, userCoords.lng,
                    ownerCoords.lat, ownerCoords.lng
                );
            }

            return {
                ...pet.toObject(),
                distanceKm: Math.round(distance * 10) / 10,
                likedMe: whoLikedMeIds.some(id => id.toString() === pet._id.toString())
            };
        });

        // Sort to show people who liked me first
        results.sort((a, b) => (b.likedMe ? 1 : 0) - (a.likedMe ? 1 : 0));

        console.log(`DEBUG: Returning ${results.length} results to frontend`);
        return c.json({ success: true, pets: results });
    } catch (error) {
        console.error('Error fetching match candidates:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// POST /pets/:id/swipe - Like or Nope another pet
userRouter.post('/pets/:id/swipe', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const activePetId = c.req.param('id');
        const { targetPetId, type } = await c.req.json(); // type: 'like' | 'nope'

        if (!['like', 'nope'].includes(type)) return c.json({ error: 'Tipo inválido' }, 400);

        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const activePet = await Pet.findById(activePetId);
        if (!activePet || activePet.owner_id.toString() !== user._id.toString()) {
            return c.json({ error: 'Operación no válida' }, 403);
        }

        // Record the swipe
        await Swipe.findOneAndUpdate(
            { swiper_pet: activePetId, swiped_pet: targetPetId },
            { type },
            { upsert: true, new: true }
        );

        let matchCreated = false;
        let matchData = null;

        if (type === 'like') {
            const targetPet = await Pet.findById(targetPetId);
            const mutualSwipe = await Swipe.findOne({
                swiper_pet: targetPetId,
                swiped_pet: activePetId,
                type: 'like'
            });

            if (mutualSwipe) {
                // IT'S A MATCH! 🐾
                matchCreated = true;

                // 1. Create Match entry
                const newMatch = new Match({
                    pet_a: activePetId,
                    pet_b: targetPetId,
                    status: MatchStatus.ACCEPTED,
                });
                await newMatch.save();

                // 2. Create Chat entry
                const newChat = new Chat({
                    participants: [activePet.owner_id, targetPet?.owner_id],
                    match_id: newMatch._id
                });
                await newChat.save();

                // 3. Link Chat back to Match
                newMatch.chat_id = newChat._id as any;
                await newMatch.save();

                // 4. Create Notifications for both users
                const notificationA = new Notification({
                    user_id: activePet.owner_id,
                    title: "¡Nuevo Match! 🐾",
                    message: `¡Match con ${targetPet?.name}! Ya pueden chatear.`,
                    type: NotificationType.MATCH
                });
                const notificationB = new Notification({
                    user_id: targetPet?.owner_id,
                    title: "¡Nuevo Match! 🐾",
                    message: `¡Tu mascota ${targetPet?.name} tiene un match con ${activePet.name}!`,
                    type: NotificationType.MATCH
                });

                await Promise.all([notificationA.save(), notificationB.save()]);

                // 5. Send Real-time Push
                sendPush(activePet.owner_id, notificationA.title, notificationA.message);
                sendPush(targetPet?.owner_id, notificationB.title, notificationB.message);

                // 6. Broadcast Real-time Event via WebSocket
                broadcastToChat(activePet.owner_id.toString(), { type: 'new_match', match: newMatch });
                broadcastToChat(targetPet?.owner_id.toString(), { type: 'new_match', match: newMatch });

                matchData = newMatch;
            } else {
                // NOT a mutual match yet, but someone liked your pet
                const notification = new Notification({
                    user_id: targetPet?.owner_id as any,
                    title: "¡Le gustas a alguien! ❤️",
                    message: `A alguien le gusta tu mascota ${targetPet?.name}. ¡Desliza para descubrir quién es!`,
                    type: NotificationType.MATCH
                });
                await notification.save();

                sendPush(targetPet?.owner_id, notification.title, notification.message);
            }
        }

        return c.json({ success: true, match: matchCreated, matchData });
    } catch (error) {
        console.error('Error recording swipe:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// PATCH /pets/:id/adoption-status
userRouter.patch('/pets/:id/adoption-status', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const petId = c.req.param('id');
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const { in_adoption, adoptionInfo } = await c.req.json();

        const pet = await Pet.findOneAndUpdate(
            { _id: petId, owner_id: user._id },
            { in_adoption, adoptionInfo: in_adoption ? adoptionInfo : null },
            { new: true }
        );

        if (!pet) return c.json({ error: 'Mascota no encontrada' }, 404);
        return c.json({ success: true, pet });
    } catch (error) {
        console.error('Error updating adoption status:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// PATCH /pets/:id/lost-status
userRouter.patch('/pets/:id/lost-status', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const petId = c.req.param('id');
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const { is_lost, lostInfo } = await c.req.json();

        const pet = await Pet.findOneAndUpdate(
            { _id: petId, owner_id: user._id },
            { is_lost, lostInfo: is_lost ? lostInfo : null },
            { new: true }
        );

        if (!pet) return c.json({ error: 'Mascota no encontrada' }, 404);
        return c.json({ success: true, pet });
    } catch (error) {
        console.error('Error updating lost status:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// GET /pets-list/lost - Public list of lost pets
userRouter.get('/pets-list/lost', async (c) => {
    try {
        const pets = await Pet.find({ is_lost: true })
            .populate('owner_id', 'name phone profile_picture location')
            .sort({ updatedAt: -1 });
        return c.json({ success: true, pets });
    } catch (error) {
        return c.json({ error: 'Error fetching lost pets' }, 500);
    }
});

// GET /pets-list/adoption - Public list of pets in adoption
userRouter.get('/pets-list/adoption', async (c) => {
    try {
        const pets = await Pet.find({ in_adoption: true })
            .populate('owner_id', 'name phone profile_picture location')
            .sort({ updatedAt: -1 });
        return c.json({ success: true, pets });
    } catch (error) {
        return c.json({ error: 'Error fetching adoption pets' }, 500);
    }
});

// POST /reports - Create a report for a lost/adoption animal
userRouter.post('/reports', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const { type, animalInfo, lostDetails, adoptionDetails, contact } = await c.req.json();

        // Create a new Pet record for this report
        const newPetData: any = {
            owner_id: user._id,
            name: animalInfo?.name || "Sin nombre",
            species: animalInfo?.species || "Otro",
            race: animalInfo?.race || "Desconocida",
            age: parseInt(animalInfo?.age) || 0,
            gender: "Desconocido",
            weight: 0,
            images: animalInfo?.imageUrl ? [animalInfo.imageUrl] : [],
        };

        if (type === 'lost') {
            newPetData.is_lost = true;
            newPetData.lostInfo = { ...lostDetails, contact };
            newPetData.description = lostDetails?.description || "";
        } else {
            newPetData.in_adoption = true;
            newPetData.adoptionInfo = { ...adoptionDetails, contact };
            newPetData.description = adoptionDetails?.description || "";
        }

        const newPet = new Pet(newPetData);
        await newPet.save();

        user.pets.push(newPet._id as any);
        await user.save();

        return c.json({ success: true, pet: newPet });
    } catch (error) {
        console.error('Error creating report:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});


// ── GET /me ──────────────────────────────────────────────────────
userRouter.get('/me', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);
        const user = await User.findOne({ email: session.user.email }).select('-password');
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);
        return c.json({ success: true, user });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// ── PATCH /me ─ Update phone and/or name ─────────────────────────
userRouter.patch('/me', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);
        const body = await c.req.json();
        const fields: Record<string, any> = {};
        if (typeof body.phone === 'string') fields.phone = body.phone.trim();
        if (typeof body.name === 'string' && body.name.trim()) fields.name = body.name.trim();
        if (typeof body.profile_picture === 'string') fields.profile_picture = body.profile_picture.trim();
        if (!Object.keys(fields).length) return c.json({ error: 'Sin campos válidos' }, 400);
        const user = await User.findOneAndUpdate(
            { email: session.user.email },
            { $set: fields },
            { new: true }
        ).select('-password');
        return c.json({ success: true, user });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// ── PATCH /preferences ───────────────────────────────────────────
userRouter.patch('/preferences', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);
        const body = await c.req.json();
        const update: Record<string, any> = {};
        if (body.notifications) {
            ['matches', 'messages', 'adoptions', 'promotions'].forEach(f => {
                if (typeof body.notifications[f] === 'boolean')
                    update[`preferences.notifications.${f}`] = body.notifications[f];
            });
        }
        if (body.privacy) {
            ['showLocation', 'showPhone', 'showOnlineStatus', 'showReadReceipts'].forEach(f => {
                if (typeof body.privacy[f] === 'boolean')
                    update[`preferences.privacy.${f}`] = body.privacy[f];
            });
        }
        if (body.language && ['es', 'en'].includes(body.language))
            update['preferences.language'] = body.language;
        if (body.theme && ['light', 'dark', 'system'].includes(body.theme))
            update['preferences.theme'] = body.theme;
        if (body.distanceUnit && ['km', 'miles'].includes(body.distanceUnit))
            update['preferences.distanceUnit'] = body.distanceUnit;
        const user = await User.findOneAndUpdate(
            { email: session.user.email },
            { $set: update },
            { new: true }
        ).select('preferences');
        return c.json({ success: true, preferences: user?.preferences });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// ── GET /payment-methods ─────────────────────────────────────────
userRouter.get('/payment-methods', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);
        const user = await User.findOne({ email: session.user.email }).select('paymentMethods');
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);
        return c.json({ success: true, paymentMethods: user.paymentMethods });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// ── POST /payment-methods ────────────────────────────────────────
userRouter.post('/payment-methods', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);
        const { type, label, phone, bank, rif, email, accountNumber, isDefault } = await c.req.json();
        if (!type || !label) return c.json({ error: 'type y label son requeridos' }, 400);
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);
        if (isDefault) user.paymentMethods.forEach((m: any) => { m.isDefault = false; });
        user.paymentMethods.push({ type, label, phone, bank, rif, email, accountNumber, isDefault: !!isDefault } as any);
        await user.save();
        return c.json({ success: true, paymentMethods: user.paymentMethods });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// ── DELETE /payment-methods/:methodId ────────────────────────────
userRouter.delete('/payment-methods/:methodId', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);
        const methodId = c.req.param('methodId');
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);
        user.paymentMethods = user.paymentMethods.filter((m: any) => m._id.toString() !== methodId) as any;
        await user.save();
        return c.json({ success: true, paymentMethods: user.paymentMethods });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// ── PATCH /payment-methods/:methodId/default ─────────────────────
userRouter.patch('/payment-methods/:methodId/default', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);
        const methodId = c.req.param('methodId');
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);
        user.paymentMethods.forEach((m: any) => { m.isDefault = m._id.toString() === methodId; });
        await user.save();
        return c.json({ success: true, paymentMethods: user.paymentMethods });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// ── POST /plan-payment ───────────────────────────────────────────
userRouter.post('/plan-payment', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);
        const { plan, fecha, referencia, cedula } = await c.req.json();
        if (!plan || !fecha || !referencia || !cedula)
            return c.json({ error: 'Todos los campos son requeridos' }, 400);
        await User.findOneAndUpdate(
            { email: session.user.email },
            { $set: { pendingPlanUpgrade: { plan, fecha, referencia, cedula, submittedAt: new Date(), status: 'pending' } } }
        );
        return c.json({ success: true, message: 'Comprobante recibido, en revisión.' });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// ── CHAT & MATCHES ───────────────────────────────────────────────

// GET /matches - List all matches for the user's pets
userRouter.get('/matches', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const matches = await Match.find({
            $or: [
                { pet_a: { $in: user.pets } },
                { pet_b: { $in: user.pets } }
            ],
            status: MatchStatus.ACCEPTED
        }).populate('pet_a pet_b');

        return c.json({ success: true, matches });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// GET /matches/pending - Swipes recibidos de tipo 'like' que el usuario aún no ha devuelto (pending matches)
userRouter.get('/matches/pending', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        // Mascotas del usuario
        const myPetIds = user.pets.map((id: any) => id.toString());

        // Swipes recibidos (alguien le dio like a una de mis mascotas)
        const receivedLikes = await Swipe.find({
            swiped_pet: { $in: myPetIds },
            type: 'like'
        }).populate({ path: 'swiper_pet', select: 'name images owner_id race species' });

        // IDs de mascotas que yo ya swipeé (en cualquier dirección)
        const mySwipedIds = await Swipe.find({
            swiper_pet: { $in: myPetIds }
        }).distinct('swiped_pet');
        const mySwipedSet = new Set(mySwipedIds.map((id: any) => id.toString()));

        // Filtrar los que yo aún NO he swipeado de vuelta
        const pending = receivedLikes.filter(s => !mySwipedSet.has(s.swiper_pet?._id?.toString()));

        const result = pending.map(s => ({
            swipeId: s._id,
            fromPet: s.swiper_pet,
            toPetId: s.swiped_pet
        }));

        return c.json({ success: true, matches: result });
    } catch (error) {
        console.error('Error fetching pending matches:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// GET /chats - List all active chats
userRouter.get('/chats', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const chats = await Chat.find({
            participants: user._id,
            deleted_by: { $ne: user._id }
        })
            .populate({
                path: 'match_id',
                populate: {
                    path: 'pet_a pet_b',
                    populate: { path: 'owner_id', select: '_id name' }
                }
            })
            .populate('participants', 'name profile_picture')
            .sort({ last_message_date: -1 });

        // Filter out chats with blocked users
        const activeChats = chats.filter(chat => {
            const otherParticipant = chat.participants.find(p => p._id.toString() !== user._id.toString());
            return !user.blockedUsers.includes(otherParticipant?._id);
        });

        return c.json({ success: true, chats: activeChats });
    } catch (error) {
        console.error('Error fetching chats:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// GET /chats/:id/messages - Get messages for a chat
userRouter.get('/chats/:id/messages', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const chatId = c.req.param('id');
        const messages = await Message.find({ chat_id: chatId }).sort({ createdAt: 1 });

        return c.json({ success: true, messages });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// POST /chats/:id/messages - Send a message
userRouter.post('/chats/:id/messages', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const chatId = c.req.param('id');
        const { content } = await c.req.json();
        const user = await User.findOne({ email: session.user.email });

        const newMessage = new Message({
            chat_id: chatId,
            sender_id: user?._id,
            content
        });
        await newMessage.save();

        // Update chat's last message
        const chat = await Chat.findByIdAndUpdate(chatId, {
            last_message: content,
            last_message_date: new Date(),
            $push: { messages: newMessage._id },
            read_by: [user?._id] // Only sender has read it now
        }, { new: true });

        // Push Notification for the recipient
        if (chat) {
            const recipientId = chat.participants.find(p => p.toString() !== user?._id.toString());
            if (recipientId) {
                // Standard Push
                sendPush(
                    recipientId,
                    `Mensaje de ${user?.name || 'Mascoticas'}`,
                    content.length > 50 ? content.substring(0, 47) + '...' : content,
                    `/dashboard`,
                    chatId
                );

                // Real-time WebSocket Broadcast
                broadcastToChat(chatId, {
                    type: 'new_message',
                    message: newMessage,
                    chatId: chatId
                });
            }
        }

        return c.json({ success: true, message: newMessage });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// POST /chats/:id/read - Mark chat as read
userRouter.post('/chats/:id/read', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const chatId = c.req.param('id');
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        await Chat.findByIdAndUpdate(chatId, {
            $addToSet: { read_by: user._id }
        });

        return c.json({ success: true });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// POST /push-subscribe - Save push notification subscription
// POST /chats/:id/mute - Mute/Unmute a chat
userRouter.post('/chats/:id/mute', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const chatId = c.req.param('id');
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const chat = await Chat.findById(chatId);
        if (!chat) return c.json({ error: 'Chat no encontrado' }, 404);

        const isMuted = chat.muted_by.includes(user._id as any);
        if (isMuted) {
            chat.muted_by = chat.muted_by.filter(id => id.toString() !== user._id.toString());
        } else {
            chat.muted_by.push(user._id as any);
        }

        await chat.save();
        return c.json({ success: true, muted: !isMuted });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// POST /chats/:id/delete - "Delete" a chat for the user
userRouter.post('/chats/:id/delete', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const chatId = c.req.param('id');
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        await Chat.findByIdAndUpdate(chatId, {
            $addToSet: { deleted_by: user._id }
        });

        return c.json({ success: true });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// POST /users/:id/block - Block/Unblock a user
userRouter.post('/users/:id/block', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const targetId = c.req.param('id');
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const isBlocked = user.blockedUsers.includes(targetId as any);
        if (isBlocked) {
            user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== targetId);
        } else {
            user.blockedUsers.push(targetId as any);
        }

        await user.save();
        return c.json({ success: true, blocked: !isBlocked });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// GET /blocked-users - Get list of blocked users
userRouter.get('/blocked-users', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const user = await User.findOne({ email: session.user.email }).populate('blockedUsers', 'name profile_picture');
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        return c.json({ success: true, blockedUsers: user.blockedUsers });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

userRouter.post('/push-subscribe', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const subscription = await c.req.json();
        console.log('DEBUG: Received push subscription request');

        const user = await User.findOne({ email: session.user.email });
        if (!user) {
            console.log('DEBUG: User not found for subscription');
            return c.json({ error: 'Usuario no encontrado' }, 404);
        }

        // Avoid duplicates
        const subExists = user.pushSubscriptions.some((s: any) =>
            s.endpoint === subscription.endpoint
        );

        if (!subExists) {
            console.log('DEBUG: Adding new push subscription to DB');
            user.pushSubscriptions.push(subscription);
            await user.save();
        } else {
            console.log('DEBUG: Push subscription already exists for this user');
        }

        return c.json({ success: true });
    } catch (error) {
        console.error('DEBUG: Error in push-subscribe:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

export default userRouter;
