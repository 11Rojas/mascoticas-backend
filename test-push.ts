import mongoose from 'mongoose';
import * as webpush from 'web-push';
import { User } from './src/schemas/User';

const MONGODB_URI = "mongodb://localhost:27017/mascoticas";
const VAPID_PUBLIC_KEY = "BMZbBWSqtuWaoDJmF9rnEXefeNu-Ex4cGdnFJ8rTdhe5XqbyKTMDqjZFtb1wVzIkejgidin1J_te-me1sMM9RmU";
const VAPID_PRIVATE_KEY = "EKsY3a0xymqplwwSy8HsdmOHGXuma2VKLK5oJDoaaD8";

async function testPush() {
    try {
        console.log('--- Probador de Notificaciones Push ---');

        // 1. Configurar Web Push
        webpush.setVapidDetails(
            'mailto:admin@mascoticas.app',
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        );

        // 2. Conectar a DB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Conectado a MongoDB');

        // 3. Buscar un usuario con suscripciones
        const user = await User.findOne({ pushSubscriptions: { $exists: true, $not: { $size: 0 } } });

        if (!user) {
            console.log('❌ No se encontró ningún usuario con suscripciones activas.');
            console.log('Asegúrate de haber activado las notificaciones en el perfil de la app.');
            process.exit(1);
        }

        console.log(`📡 Enviando notificación de prueba a: ${user.name} (${user.email})`);
        console.log(`📱 Cantidad de dispositivos suscritos: ${user.pushSubscriptions.length}`);

        const payload = JSON.stringify({
            title: '¡Prueba de Mascoticas! 🐾',
            message: 'Si estás viendo esto, tu sistema de notificaciones funciona perfectamente.',
            url: '/dashboard'
        });

        // 4. Enviar a todas sus suscripciones
        const results = await Promise.all(
            user.pushSubscriptions.map(sub =>
                webpush.sendNotification(sub, payload)
                    .then(() => ({ success: true }))
                    .catch(err => ({ success: false, error: err }))
            )
        );

        const successCount = results.filter(r => r.success).length;
        console.log(`\n✨ Resultado: ${successCount}/${results.length} notificaciones enviadas con éxito.`);

        if (successCount > 0) {
            console.log('¡Revisa tu navegador! Deberías ver la notificación ahora mismo.');
        } else {
            console.log('Algo falló. Revisa si los tokens han expirado o si el navegador bloqueó el mensaje.');
        }

    } catch (error) {
        console.error('❌ Error fatal:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

testPush();
