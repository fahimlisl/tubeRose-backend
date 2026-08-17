import { createClient } from 'redis';

const client = createClient({
    username: 'default',
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_URL,
        port: 11179
    }
});

client.on('error', err => console.log('Redis Client Error', err));


export const ConnectRedis = async () => {
    await client.connect();
}
    console.log("redis connected succesfully!")

export default client
