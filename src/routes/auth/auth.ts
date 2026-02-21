import { Hono } from 'hono';
import { auth } from '../../libs/auth';

const authRouter = new Hono();

authRouter.on(['POST', 'GET'], '/auth/*', (c) => {
    return auth.handler(c.req.raw);
});

export default authRouter;