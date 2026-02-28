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
import { Booking } from '../schemas/Booking';
import { Vet } from '../schemas/Vet';
import { Report } from '../schemas/Report';
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

userRouter.post('/report', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const { reportedId, context, reason, details } = await c.req.json();

        const reporterId = (session.user as any).id;
        const newReport = await Report.create({
            reporterId,
            reportedId,
            context,
            reason,
            details
        });

        return c.json({ success: true, report: newReport });
    } catch (error) {
        console.error("Error creating report:", error);
        return c.json({ error: 'Error del servidor' }, 500);
    }
});

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

// PATCH /pets/:id - Update pet information
userRouter.patch('/pets/:id', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const petId = c.req.param('id');
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const data = await c.req.json();

        // Find and update if owner
        const updatedPet = await Pet.findOneAndUpdate(
            { _id: petId, owner_id: user._id },
            { $set: data },
            { new: true }
        );

        if (!updatedPet) return c.json({ error: 'Mascota no encontrada o no tienes permiso' }, 404);

        return c.json({ success: true, pet: updatedPet });
    } catch (error) {
        console.error('Error updating pet:', error);
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// DELETE /pets/:id - Remove a pet and its matches/chats/swipes
userRouter.delete('/pets/:id', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const petId = c.req.param('id');
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        // Verify ownership
        const pet = await Pet.findOne({ _id: petId, owner_id: user._id });
        if (!pet) return c.json({ error: 'Mascota no encontrada o no tienes permiso' }, 404);

        console.log(`DEBUG: Deleting pet ${petId} and all associated data...`);

        // 1. Delete associated Matches, Chats and Messages
        const matches = await Match.find({ $or: [{ pet_a: petId }, { pet_b: petId }] });
        console.log(`DEBUG: Found ${matches.length} matches to delete`);

        for (const match of matches) {
            if (match.chat_id) {
                const msgDel = await Message.deleteMany({ chat_id: match.chat_id });
                const chatDel = await Chat.findByIdAndDelete(match.chat_id);
                console.log(`DEBUG: Deleted chat ${match.chat_id} and ${msgDel.deletedCount} messages`);
            }
            await Match.findByIdAndDelete(match._id);
        }

        // 3. Delete all Swipes involving this pet (both as swiper or swiped)
        const swipeDel = await Swipe.deleteMany({ $or: [{ swiper_pet: petId }, { swiped_pet: petId }] });
        console.log(`DEBUG: Deleted ${swipeDel.deletedCount} swipes`);

        // 4. Delete associated Bookings
        const bookingDel = await Booking.deleteMany({ pet_id: petId });
        console.log(`DEBUG: Deleted ${bookingDel.deletedCount} bookings`);

        // 5. Remove pet from User's pets array
        await User.findByIdAndUpdate(user._id, { $pull: { pets: petId } });

        // 6. Delete the pet itself
        await Pet.findByIdAndDelete(petId);

        console.log(`DEBUG: Pet ${petId} deleted successfully`);

        return c.json({ success: true, message: 'Mascota y todos sus datos asociados fueron eliminados correctamente' });
    } catch (error: any) {
        console.error('Error deleting pet:', error);
        return c.json({ error: 'Error interno del servidor', details: error.message }, 500);
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
        const candidates = await Pet.find(query).populate('owner_id', 'location name username profile_picture');
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

userRouter.get('/users/search-username', async (c) => {
    try {
        const q = c.req.query('q') || '';
        if (q.length < 3) return c.json({ success: true, users: [] });

        const users = await User.find({
            username: { $regex: q, $options: 'i' }
        })
            .select('name username profile_picture')
            .limit(5);

        return c.json({ success: true, users });
    } catch (error) {
        return c.json({ error: 'Error al buscar usuarios' }, 500);
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
userRouter.get('/pets/:id/public', async (c) => {
    try {
        const petId = c.req.param('id');
        const pet = await Pet.findById(petId).populate('owner_id', 'name phone profile_picture location');
        if (!pet) return c.json({ error: 'Mascota no encontrada' }, 404);
        return c.json({ success: true, pet });
    } catch (error) {
        return c.json({ error: 'Error al obtener los detalles de la mascota' }, 500);
    }
});

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
            weight: parseFloat(animalInfo?.weight) || 0,
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

userRouter.patch('/pets/:id/found', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const { id } = c.req.param();
        const { foundBy, resolutionDetails, type, adopterId, transfer } = await c.req.json();

        // Check if pet belongs to session user
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const pet = await Pet.findById(id);
        if (!pet) return c.json({ error: 'Mascota no encontrada' }, 404);

        if (pet.owner_id.toString() !== user._id.toString()) {
            return c.json({ error: 'No tienes permiso para actualizar esta mascota' }, 403);
        }

        // Update pet status
        const updateDoc: any = {
            is_lost: false,
            in_adoption: false,
        };

        if (type === 'found' || pet.is_lost) {
            updateDoc.lostInfo = {
                ...pet.lostInfo,
                found: true,
                foundBy,
                resolutionDetails,
                foundDate: new Date()
            };
        }

        if (type === 'adopted' || pet.in_adoption) {
            updateDoc.adoptionInfo = {
                ...pet.adoptionInfo,
                adopted: true,
                adoptedBy: foundBy,
                resolutionDetails,
                adoptedDate: new Date()
            };

            // Handle internal transfer if requested
            if (transfer && adopterId) {
                const adopter = await User.findById(adopterId);
                if (adopter) {
                    updateDoc.owner_id = adopter._id;
                    // When transferring, we should also reset other modes for the new owner
                    updateDoc.matchMode = false;
                    updateDoc.in_adoption = false;
                    updateDoc.is_lost = false;

                    // Clean up: delete matches, chats and messages related to this pet
                    const petMatches = await Match.find({
                        $or: [{ pet_a: id }, { pet_b: id }]
                    });

                    const matchIds = petMatches.map(m => m._id);
                    const chatIds = petMatches.map(m => m.chat_id).filter(Boolean);

                    if (chatIds.length > 0) {
                        await Message.deleteMany({ chat_id: { $in: chatIds } });
                        await Chat.deleteMany({ _id: { $in: chatIds } });
                    }

                    if (matchIds.length > 0) {
                        await Match.deleteMany({ _id: { $in: matchIds } });
                    }

                    // Also delete swipes to start fresh
                    await Swipe.deleteMany({ $or: [{ fromPetId: id }, { targetPetId: id }] });
                }
            }
        }

        const updatedPet = await Pet.findByIdAndUpdate(id, { $set: updateDoc }, { new: true });

        return c.json({ success: true, pet: updatedPet });
    } catch (error) {
        console.error('Error reporting found/adopted pet:', error);
        return c.json({ error: 'Error al procesar resolución de mascota' }, 500);
    }
});


// POST /vets - Register a new veterinary (pending approval)
userRouter.post('/vets', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const data = await c.req.json();

        // Basic validation
        if (!data.name || !data.email || !data.phone || !data.location?.address) {
            return c.json({ error: 'Faltan campos obligatorios' }, 400);
        }

        const newVet = new Vet({
            ...data,
            owner_id: user._id, // Adding this for internal tracking if needed, though schema uses 'owner' string
            owner: user.name,
            is_verified: false // Always start as unverified (pending approval)
        });

        await newVet.save();

        return c.json({
            success: true,
            message: 'Veterinaria registrada. Pendiente por aprobación.',
            vet: newVet
        });
    } catch (error: any) {
        if (error.code === 11000) {
            return c.json({ error: 'El correo electrónico ya está registrado para otra veterinaria' }, 400);
        }
        console.error('Error registering vet:', error);
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
        if (typeof body.username === 'string' && body.username.trim()) fields.username = body.username.trim().toLowerCase();
        if (typeof body.profile_picture === 'string') fields.profile_picture = body.profile_picture.trim();
        if (typeof body.description === 'string') fields.description = body.description.trim();
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
        }).populate('pet_a pet_b chat_id');

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
        })
            .populate({ path: 'swiper_pet', select: 'name images owner_id race species age' })
            .populate({ path: 'swiped_pet', select: 'name images owner_id race species age' });

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
            toPet: s.swiped_pet
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
                    populate: { path: 'owner_id', select: '_id name username profile_picture location' }
                }
            })
            .populate('participants', 'name username profile_picture')
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
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const messages = await Message.find({
            chat_id: chatId,
            deleted_by: { $ne: user._id }
        }).sort({ createdAt: 1 });

        return c.json({ success: true, messages });
    } catch (error) {
        return c.json({ error: 'Error interno del servidor' }, 500);
    }
});

// POST /messages/:id/delete - Delete a message (for me or everyone)
userRouter.post('/messages/:id/delete', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const msgId = c.req.param('id');
        const { type } = await c.req.json(); // "me" or "everyone"

        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const message = await Message.findById(msgId);
        if (!message) return c.json({ error: 'Mensaje no encontrado' }, 404);

        if (type === 'everyone') {
            if (message.sender_id.toString() !== user._id.toString()) {
                return c.json({ error: 'No tienes permiso para eliminar este mensaje para todos' }, 403);
            }
            message.deleted_for_everyone = true;
            message.content = "Este mensaje fue eliminado";
            message.images = [];
            await message.save();

            // Notify via websockets
            broadcastToChat(message.chat_id.toString(), {
                type: 'message_deleted',
                chatId: message.chat_id.toString(),
                messageId: message._id.toString(),
                deletedForEveryone: true,
                newContent: message.content,
                newImages: message.images
            });
        } else {
            // "me"
            if (!message.deleted_by.some(id => id.toString() === user._id.toString())) {
                message.deleted_by.push(user._id as any);
                await message.save();
            }
        }

        return c.json({ success: true });
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
        const { content, images } = await c.req.json();
        const user = await User.findOne({ email: session.user.email });

        if (images && images.length > 0) {
            if (user?.plan === 'free' && images.length > 3) {
                return c.json({ error: 'Los usuarios free solo pueden enviar hasta 3 imágenes a la vez.' }, 403);
            }
        }

        const newMessage = new Message({
            chat_id: chatId,
            sender_id: user?._id,
            content: content || "",
            images: images || []
        });
        await newMessage.save();

        // Update chat's last message
        const isImageOnly = (!content || content.trim() === '') && (images && images.length > 0);
        const chat = await Chat.findByIdAndUpdate(chatId, {
            last_message: isImageOnly ? '📷 Imagen' : content,
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
                    isImageOnly ? '📷 Imagen' : (content.length > 50 ? content.substring(0, 47) + '...' : content),
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

// POST /matches/:id/unmatch - Delete a match and its associated chat
userRouter.post('/matches/:id/unmatch', async (c) => {
    try {
        const session = await auth.api.getSession({ query: c.req.query(), headers: c.req.raw.headers });
        if (!session) return c.json({ error: 'No autorizado' }, 401);

        const matchId = c.req.param('id');
        const user = await User.findOne({ email: session.user.email });
        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        const match = await Match.findById(matchId);
        if (!match) return c.json({ error: 'Match no encontrado' }, 404);

        // Check if user is owner of one of the pets in the match
        const petA = await Pet.findById(match.pet_a);
        const petB = await Pet.findById(match.pet_b);

        if (petA?.owner_id.toString() !== user._id.toString() && petB?.owner_id.toString() !== user._id.toString()) {
            return c.json({ error: 'No tienes permiso para deshacer este match' }, 403);
        }

        // Delete associated chat if exists
        if (match.chat_id) {
            await Chat.findByIdAndDelete(match.chat_id);
            await Message.deleteMany({ chat_id: match.chat_id });
        }

        await Match.findByIdAndDelete(matchId);

        return c.json({ success: true, message: 'Match eliminado correctamente' });
    } catch (error) {
        console.error('Error unmatching:', error);
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

        const user = await User.findOne({ email: session.user.email }).populate('blockedUsers', 'name username profile_picture');
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

// GET /users/:id/public - Get public user profile with pets
userRouter.get('/users/:id/public', async (c) => {
    try {
        const userId = c.req.param('id');
        const user = await User.findById(userId)
            .select('name username profile_picture location description pets badges is_verified')
            .populate('pets', 'name species race age images');

        if (!user) return c.json({ error: 'Usuario no encontrado' }, 404);

        return c.json({ success: true, user });
    } catch (error) {
        return c.json({ error: 'Error al obtener el perfil' }, 500);
    }
});

export default userRouter;
